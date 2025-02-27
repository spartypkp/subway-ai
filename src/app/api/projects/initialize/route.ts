import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import SubwayLayoutService from '@/lib/layout/subwayLayoutService';

export async function POST(req: Request) {
	const { title, description, created_by } = await req.json();
	const userId = created_by || 'user123'; // In a real app, this would come from authentication
	
	try {
		// Create a transaction
		await query('BEGIN');
		
		try {
			// Create project
			const projectId = uuidv4();
			const timestamp = new Date().toISOString();
			
			const projectResult = await query(
				`INSERT INTO projects (id, name, description, created_at, updated_at, created_by)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 RETURNING *`,
				[projectId, title || 'New Project', description || null, timestamp, timestamp, userId]
			);
			
			if (projectResult.rows.length === 0) {
				throw new Error('Failed to create project');
			}
			
			// Create main branch
			const mainBranchId = uuidv4();
			
			await query(
				`INSERT INTO branches (id, project_id, name, color, depth, is_active, created_by, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[mainBranchId, projectId, 'Main Line', '#3b82f6', 0, true, userId, timestamp]
			);
			
			// Create root node in main branch
			const rootNodeId = uuidv4();
			
			await query(
				`INSERT INTO timeline_nodes 
				 (id, project_id, branch_id, type, status, position, created_by, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					rootNodeId,
					projectId,
					mainBranchId,
					'root',
					'active',
					0,
					userId,
					timestamp
				]
			);
			
			// Create initial welcome message
			const welcomeNodeId = uuidv4();
			
			await query(
				`INSERT INTO timeline_nodes 
				 (id, project_id, branch_id, parent_id, type, status,
				  message_text, message_role, position, created_by, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
				[
					welcomeNodeId,
					projectId,
					mainBranchId,
					rootNodeId,
					'assistant-message',
					'active',
					'Welcome to your new project! Start by sending a message.',
					'assistant',
					1,
					'ai',
					timestamp
				]
			);
			
			// Initialize layout for the main branch
			try {
				const layoutService = new SubwayLayoutService();
				await layoutService.updateBranchPositions(projectId);
			} catch (layoutError) {
				console.warn('Initial layout calculation failed but proceeding with project creation', layoutError);
				// Non-critical error - continue with project creation even if layout fails
			}
			
			// Commit transaction
			await query('COMMIT');
			
			// Map name to title in the response
			const project = projectResult.rows[0];
			project.title = project.name;
			
			return NextResponse.json({
				...project,
				mainBranchId,
				rootNodeId,
				welcomeNodeId
			});
		} catch (error) {
			// Rollback on error
			await query('ROLLBACK');
			throw error;
		}
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json(
			{ 
				error: 'Failed to initialize project',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
} 