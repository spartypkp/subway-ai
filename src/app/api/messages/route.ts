import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint for creating new USER messges
 * 
 * This endpoint creates a user message only
 */
export async function POST(req: Request) {
	try {
		const {
			project_id,
			branch_id,
			parent_id,
			text,
			created_by = 'anonymous'
		} = await req.json();

		// Validate required fields except branch_id (which we'll handle specially)
		if (!project_id || !parent_id || !text) {
			return NextResponse.json(
				{ error: 'Missing required fields: project_id, parent_id, and text are required' },
				{ status: 400 }
			);
		}

		// Start a transaction
		await query('BEGIN');

		try {
			// Check that parent node exists
			const parentNodeCheck = await query(
				'SELECT id, type FROM timeline_nodes WHERE id = $1',
				[parent_id]
			);

			if (parentNodeCheck.rows.length === 0) {
				await query('ROLLBACK');
				return NextResponse.json({ error: 'Parent node not found' }, { status: 404 });
			}

			// Get parent node type
			const parentNodeType = parentNodeCheck.rows[0].type;

			// Handle missing or empty branch_id for new projects
			let effectiveBranchId = branch_id;

			if (!effectiveBranchId || effectiveBranchId.trim() === '') {
				console.log('No branch_id provided, checking if this is a first message with root parent');

				// If parent is a root node, this might be the first message in a new project
				if (parentNodeType === 'root') {
					console.log('Parent is root node, creating main branch for project');

					// Create a new main branch for this project
					const mainBranchId = uuidv4();
					await query(`
            INSERT INTO branches (
              id, project_id, name, depth, color, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `, [
						mainBranchId,
						project_id,
						'Main Line',
						0, // Depth 0 for main branch
						'#3b82f6', // Blue color for main branch
						'system'
					]);

					// Set the effective branch ID to the new main branch
					effectiveBranchId = mainBranchId;
					console.log(`Created main branch with ID: ${effectiveBranchId}`);
				} else {
					// If parent is not a root node but branch_id is still missing, return error
					await query('ROLLBACK');
					return NextResponse.json(
						{ error: 'branch_id is required for non-root parent nodes' },
						{ status: 400 }
					);
				}
			}

			// Get the max position in the branch
			const maxPosResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM timeline_nodes
        WHERE branch_id = $1
      `, [effectiveBranchId]);

			const userMessagePosition = maxPosResult.rows[0].next_position;

			// Create a new user-message node
			const userMessageId = uuidv4();
			await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id,
          type, message_text, message_role, created_by, created_at, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      `, [
				userMessageId,
				project_id,
				effectiveBranchId,
				parent_id,
				'user-message',
				text,
				'user',
				created_by,
				userMessagePosition
			]);



			// Commit the transaction
			await query('COMMIT');

			// Return both messages
			return NextResponse.json({
				user_message: {
					id: userMessageId,
					type: 'user-message',
					message_text: text,
					message_role: 'user',
					branch_id: effectiveBranchId,
					project_id: project_id,
					parent_id: parent_id,
					position: userMessagePosition
				},

			});

		} catch (error) {
			// Rollback on error
			await query('ROLLBACK');
			throw error;
		}
	} catch (error) {
		console.error('Error creating message:', error);
		return NextResponse.json(
			{
				error: 'Failed to create message',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}