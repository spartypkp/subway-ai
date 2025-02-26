import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
	const { title, description } = await req.json();
	
	try {
		// Create a transaction
		await query('BEGIN');
		
		// Create project
		const projectId = uuidv4();
		const timestamp = new Date().toISOString();
		
		const projectResult = await query(
			`INSERT INTO projects (id, name, description, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING *`,
			[projectId, title || 'New Project', description || null, timestamp, timestamp]
		);
		
		if (projectResult.rows.length === 0) {
			throw new Error('Failed to create project');
		}
		
		// Create root node
		const rootNodeId = uuidv4();
		
		await query(
			`INSERT INTO timeline_nodes 
			 (id, project_id, expert_id, parent_id, type, status, content, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				rootNodeId,
				projectId,
				null, // Using NULL instead of empty string for expert_id
				null,
				'root',
				null,
				JSON.stringify({ 
					title: title || 'New Project', 
					context: {}
				}),
				timestamp,
				timestamp
			]
		);
		
		// Create initial welcome message
		const welcomeNodeId = uuidv4();
		
		await query(
			`INSERT INTO timeline_nodes 
			 (id, project_id, expert_id, parent_id, type, status, content, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				welcomeNodeId,
				projectId,
				null, // Using NULL instead of empty string for expert_id
				rootNodeId,
				'message',
				null,
				JSON.stringify({ 
					text: 'Welcome to your new project! Start by sending a message.', 
					role: 'assistant'
				}),
				timestamp,
				timestamp
			]
		);
		
		// Commit transaction
		await query('COMMIT');
		
		// Map name to title in the response
		const project = projectResult.rows[0];
		project.title = project.name;
		
		return NextResponse.json(project);
	} catch (error) {
		// Rollback on error
		await query('ROLLBACK');
		console.error('Database error:', error);
		return NextResponse.json(
			{ error: 'Failed to initialize project' },
			{ status: 500 }
		);
	}
} 