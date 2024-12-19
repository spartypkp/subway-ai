import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const projectId = searchParams.get('project_id');

	try {
		const result = await query(
			`SELECT * FROM experts 
       WHERE project_id = $1 
       ORDER BY position`,
			[projectId]
		);
		return NextResponse.json(result.rows);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		// Start transaction
		await query('BEGIN');

		const {
			project_id,
			name,
			role,
			color,
			position,
			instructions = null,
			settings = null,
				metadata = null
		} = await req.json();

		// Create expert
		const expertResult = await query(
			`INSERT INTO experts (
				project_id, name, role, color, position, 
				instructions, settings, metadata
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING *`,
			[
				project_id,
				name,
				role,
				color,
				position,
				instructions ? JSON.stringify(instructions) : null,
				settings ? JSON.stringify(settings) : null,
				metadata ? JSON.stringify(metadata) : null
			]
		);

		const expert = expertResult.rows[0];

		// Create root node
		const rootNodeResult = await query(
			`INSERT INTO timeline_nodes (
				project_id,
				expert_id,
				parent_id,
				node_type,
				content,
				status,
				metadata
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING *`,
			[
				project_id,
				expert.id,
				null,
				'root',
				JSON.stringify({
					title: `${name}'s Timeline`,
					context: {}
				}),
				null,
				null
			]
		);

		const rootNode = rootNodeResult.rows[0];

		// Create initial empty message node
		await query(
			`INSERT INTO timeline_nodes (
				project_id,
				expert_id,
				parent_id,
				node_type,
				content,
				status,
				metadata
			) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[
				project_id,
				expert.id,
				rootNode.id,
				'message',
				JSON.stringify({
					text: '',
					role: 'user'
				}),
				null,
				null
			]
		);

		await query('COMMIT');

		return NextResponse.json(expert);
	} catch (error) {
		await query('ROLLBACK');
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
} 