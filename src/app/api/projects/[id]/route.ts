import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * API endpoint for retrieving and updating a specific project
 */
export async function GET(
	req: Request,
	context: { params: { id: string; }; }
) {
	const {id} = await context.params;
	if (!id) {
		return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
	}

	try {
		// Get project with branch and message counts
		const result = await query(`
			SELECT p.*, 
				(SELECT COUNT(DISTINCT b.id) FROM branches b WHERE b.project_id = p.id) AS branch_count,
				(SELECT COUNT(*) FROM timeline_nodes t WHERE t.project_id = p.id AND t.type IN ('user-message', 'assistant-message')) AS message_count
			FROM projects p 
			WHERE p.id = $1
		`, [id]);

		if (result.rows.length === 0) {
			return NextResponse.json(
				{ error: 'Project not found' },
				{ status: 404 }
			);
		}

		// Get branches for this project
		const branchesResult = await query(`
			SELECT b.*, 
				(SELECT COUNT(*) FROM timeline_nodes t 
				 WHERE t.branch_id = b.id AND t.type IN ('user-message', 'assistant-message')) AS message_count
			FROM branches b
			WHERE b.project_id = $1
			ORDER BY b.depth ASC, b.created_at ASC
		`, [id]);

		return NextResponse.json({
			...result.rows[0],
			branches: branchesResult.rows
		});
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json(
			{ 
				error: 'Failed to fetch project',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
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
				data.settings ? JSON.stringify(data.settings) : '{}',
				data.context ? JSON.stringify(data.context) : '{}',
				data.metadata ? JSON.stringify(data.metadata) : '{}',
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
			{ 
				error: 'Failed to update project',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}

export async function DELETE(
	req: Request,
	context: { params: { id: string; }; }
) {
	const id = context.params.id;
	if (!id) {
		return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
	}

	try {
		// Start a transaction
		await query('BEGIN');
		
		try {
			// Delete will cascade to timeline_nodes and branches due to foreign key constraints
			const result = await query(
				`DELETE FROM projects WHERE id = $1 RETURNING id, name`,
				[id]
			);

			if (result.rows.length === 0) {
				return NextResponse.json(
					{ error: 'Project not found' },
					{ status: 404 }
				);
			}
			
			// Commit the transaction
			await query('COMMIT');

			return NextResponse.json({ 
				deleted: true,
				project: result.rows[0]
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
				error: 'Failed to delete project',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
} 