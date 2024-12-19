import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
	req: Request,
	context: { params: { id: string; }; }
) {
	const id = context.params.id;
	if (!id) {
		return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
	}

	try {
		const result = await query(
			'SELECT * FROM projects WHERE id = $1',
			[id]
		);

		if (result.rows.length === 0) {
			return NextResponse.json(
				{ error: 'Project not found' },
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
	context: { params: { id: string; }; }
) {
	const id = context.params.id;
	if (!id) {
		return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
	}

	try {
		const data = await req.json();
		const result = await query(
			`UPDATE projects 
			 SET name = $1, 
				 description = $2,
				 settings = $3,
				 context = $4,
				 metadata = $5,
				 updated_at = NOW()
			 WHERE id = $6
			 RETURNING *`,
			[
				data.name,
				data.description,
				data.settings ? JSON.stringify(data.settings) : null,
				data.context ? JSON.stringify(data.context) : null,
				data.metadata ? JSON.stringify(data.metadata) : null,
				id
			]
		);

		if (result.rows.length === 0) {
			return NextResponse.json(
				{ error: 'Project not found' },
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