import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import SubwayLayoutService from '@/lib/layout/subwayLayoutService';

/**
 * API endpoint for retrieving and creating projects
 */
export async function GET() {
	try {
		const result = await query(`
			SELECT p.*, 
				  (SELECT COUNT(DISTINCT b.id) FROM branches b WHERE b.project_id = p.id) AS branch_count,
				  (SELECT COUNT(*) FROM timeline_nodes t WHERE t.project_id = p.id AND t.type IN ('user-message', 'assistant-message')) AS message_count
			FROM projects p
			ORDER BY p.created_at DESC
		`);
		
		return NextResponse.json(result.rows);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json(
			{ 
				error: 'Failed to fetch projects',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		);
	}
}

export async function POST(req: Request) {
	try {
		const { name, description, created_by } = await req.json();
		const userId = created_by || 'user123'; // In a real app, this would come from authentication
		
		// Start a transaction
		await query('BEGIN');
		
		try {
			// Create project
			const projectId = uuidv4();
			const timestamp = new Date().toISOString();
			
			const projectResult = await query(
				`INSERT INTO projects (id, name, description, created_at, updated_at, created_by)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 RETURNING *`,
				[projectId, name || 'New Project', description || null, timestamp, timestamp, userId]
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
			
			return NextResponse.json({
				...projectResult.rows[0],
				mainBranchId,
				rootNodeId
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
				error: 'Failed to create project',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		);
	}
} 