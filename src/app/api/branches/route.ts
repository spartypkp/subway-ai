import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint for creating new branches from existing messages
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Extract branch creation parameters
    const { 
      project_id, 
      parent_branch_id, 
      branch_point_node_id, 
      name, 
      color = '#6366f1', // Default to indigo if no color provided
      created_by = 'anonymous', // Default user ID if not provided
      depth
    } = body;

    // Validate required fields
    if (!project_id || !branch_point_node_id || !parent_branch_id) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, parent_branch_id, and branch_point_node_id are required' },
        { status: 400 }
      );
    }

    // Begin transaction
    await query('BEGIN');

    try {
      // Check that parent branch exists
      const branchCheck = await query(
        'SELECT depth FROM branches WHERE id = $1',
        [parent_branch_id]
      );

      if (branchCheck.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ error: 'Parent branch not found' }, { status: 404 });
      }

      // Calculate depth or use provided value
      const parentDepth = branchCheck.rows[0].depth;
      const branchDepth = depth !== undefined ? depth : parentDepth + 1;

      // Check that branch point node exists and is valid for branching
      const nodeCheck = await query(
        'SELECT type, branch_id FROM timeline_nodes WHERE id = $1',
        [branch_point_node_id]
      );

      if (nodeCheck.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ error: 'Branch point node not found' }, { status: 404 });
      }

      // Only allow branching from assistant messages
      if (nodeCheck.rows[0].type !== 'assistant-message') {
        await query('ROLLBACK');
        return NextResponse.json(
          { error: 'Branches can only be created from assistant messages' },
          { status: 400 }
        );
      }

      // Check that branch point belongs to parent branch
      if (nodeCheck.rows[0].branch_id !== parent_branch_id) {
        await query('ROLLBACK');
        return NextResponse.json(
          { error: 'Branch point node does not belong to the specified parent branch' },
          { status: 400 }
        );
      }

      // Generate new branch ID
      const branchId = uuidv4();
      const branchName = name || `Branch ${branchDepth}-${branchId.slice(0, 4)}`;
      
      // Create the new branch
      const branchResult = await query(
        `INSERT INTO branches (
          id, project_id, parent_branch_id, branch_point_node_id,
          name, color, depth, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`,
        [
          branchId, project_id, parent_branch_id, branch_point_node_id,
          branchName, color, branchDepth, created_by
        ]
      );

      const newBranch = branchResult.rows[0];

      // Create a branch-root node in the new branch
      const rootNodeId = uuidv4();
      await query(
        `INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id,
          type, text, role, created_by, created_at, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
        [
          rootNodeId, project_id, branchId, branch_point_node_id,
          'branch-root', 'Branch starting point', 'system', created_by, 0
        ]
      );

      // Mark the original node as a branch point
      await query(
        `UPDATE timeline_nodes 
        SET type = 'branch-point'
        WHERE id = $1`,
        [branch_point_node_id]
      );

      // Commit transaction
      await query('COMMIT');

      // Return the created branch with its root node
      return NextResponse.json({
        ...newBranch,
        root_node_id: rootNodeId
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create branch',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 