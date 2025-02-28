import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { BranchColorManager } from '@/lib/utils/branchColorManager';

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
      created_by = 'system',
      direction = 'auto'
    } = body;

    // Validate required fields
    if (!project_id || !parent_branch_id || !branch_point_node_id) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, parent_branch_id, branch_point_node_id' },
        { status: 400 }
      );
    }

    // Validate direction if provided
    if (direction && !['left', 'right', 'auto'].includes(direction)) {
      return NextResponse.json(
        { error: 'Invalid direction. Must be one of: left, right, auto' },
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

      // Check if a branch point already exists for this message
      const branchPointCheck = await query(
        `SELECT id FROM timeline_nodes 
         WHERE parent_id = $1 AND type = 'branch-point'`,
        [branch_point_node_id]
      );
      
      let branchPointNodeId;
      
      if (branchPointCheck.rows.length > 0) {
        // Branch point already exists
        branchPointNodeId = branchPointCheck.rows[0].id;
        
        // Check if a branch already exists in the requested direction
        const existingBranchesCheck = await query(
          `SELECT id, metadata FROM branches 
           WHERE branch_point_node_id = $1`,
          [branchPointNodeId]
        );
        
        // Check if the direction is already taken
        const directionTaken = existingBranchesCheck.rows.some(branch => {
          try {
            const metadata = branch.metadata || {};
            return metadata.layout?.direction === direction;
          } catch {
            return false;
          }
        });
        
        if (directionTaken) {
          await query('ROLLBACK');
          return NextResponse.json(
            { error: `A branch already exists in the ${direction} direction` },
            { status: 409 }
          );
        }
      } else {
        // Create a new branch point node
        branchPointNodeId = uuidv4();
        
        await query(
          `INSERT INTO timeline_nodes (
            id, project_id, branch_id, parent_id,
            type, message_text, message_role, created_by, created_at, position
          ) 
          SELECT 
            $1, project_id, branch_id, id,
            'branch-point', NULL, 'system', $2, NOW(), position + 0.5
          FROM timeline_nodes
          WHERE id = $3`,
          [
            branchPointNodeId, created_by, branch_point_node_id
          ]
        );
      }

      // Calculate depth or use provided value
      const parentDepth = branchCheck.rows[0].depth;
      const branchDepth = parentDepth + 1;

      // Fetch ALL branches for the project to initialize color manager properly
      const allBranchesResult = await query(
        'SELECT id, parent_branch_id, depth, color FROM branches WHERE project_id = $1',
        [project_id]
      );
      
      // Initialize color manager with ALL existing branches
      const colorManager = new BranchColorManager(allBranchesResult.rows);

      // Generate new branch ID
      const branchId = uuidv4();
      const branchName = name || `Branch ${branchDepth}-${branchId.slice(0, 4)}`;
      
      // Use the BranchColorManager to get a color for the new branch
      const color = colorManager.getColorForBranch(branchId, parent_branch_id, branchDepth);
      
      console.log(`Assigned color for new branch ${branchId}: ${color} (depth: ${branchDepth})`);

      // Create the new branch, referencing the branch point
      const branchResult = await query(
        `INSERT INTO branches (
          id, project_id, parent_branch_id, branch_point_node_id,
          name, color, depth, created_by, created_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
        RETURNING *`,
        [
          branchId, project_id, parent_branch_id, branchPointNodeId,
          branchName, color, branchDepth, created_by,
          JSON.stringify({ layout: { direction } })
        ]
      );

      const newBranch = branchResult.rows[0];

      // Create a branch-root node in the new branch
      const rootNodeId = uuidv4();
      await query(
        `INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id,
          type, message_text, message_role, created_by, created_at, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
        [
          rootNodeId, project_id, branchId, branchPointNodeId,
          'branch-root', 'Branch starting point', 'system', created_by, 0
        ]
      );

      // Normalize positions after insertion
      await query(
        `UPDATE timeline_nodes 
        SET position = new_positions.new_pos
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_pos
          FROM timeline_nodes
          WHERE branch_id = $1
          ORDER BY position
        ) as new_positions
        WHERE timeline_nodes.id = new_positions.id`,
        [parent_branch_id]
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