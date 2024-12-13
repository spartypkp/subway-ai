import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
	try {
		const result = await query(`
      SELECT * FROM projects 
      ORDER BY created_at DESC
    `);
		return NextResponse.json(result.rows);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const { name, description, instructions, context } = await req.json();
		const result = await query(
			`INSERT INTO projects (name, description, instructions, context)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
			[name, description, instructions, JSON.stringify(context)]
		);
		return NextResponse.json(result.rows[0]);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
} 