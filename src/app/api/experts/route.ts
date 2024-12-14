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

		const result = await query(
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

		return NextResponse.json(result.rows[0]);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
} 