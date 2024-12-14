import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
	req: Request,
	{ params }: { params: { id: string; }; }
) {
	const { id } = params;
	if (!id) {
		return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
	}

	try {
		const result = await query(
			'SELECT * FROM experts WHERE id = $1',
			[id]
		);

		if (result.rows.length === 0) {
			return NextResponse.json(
				{ error: 'Expert not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json(result.rows[0]);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json(
			{ error: 'Database error' },
			{ status: 500 }
		);
	}
}

export async function PUT(
	req: Request,
	{ params }: { params: { id: string; }; }
) {
	const { id } = params;
	if (!id) {
		return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
	}

	try {
		const data = await req.json();
		const result = await query(
			`UPDATE experts 
       SET name = $1, role = $2, color = $3, position = $4,
           active = $5, instructions = $6, settings = $7,
           metadata = $8, updated_at = NOW()
       WHERE id = $9 AND project_id = $10
       RETURNING *`,
			[
				data.name,
				data.role,
				data.color,
				data.position,
				data.active ?? true,
				data.instructions ? JSON.stringify(data.instructions) : null,
				data.settings ? JSON.stringify(data.settings) : null,
				data.metadata ? JSON.stringify(data.metadata) : null,
				id,
				data.project_id
			]
		);

		if (result.rows.length === 0) {
			return NextResponse.json(
				{ error: 'Expert not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json(result.rows[0]);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json(
			{ error: 'Database error' },
			{ status: 500 }
		);
	}
} 