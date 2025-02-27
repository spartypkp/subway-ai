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
      color,
      created_by = 'system',
      depth
    } = body;

    // Validate required fields
    if (!project_id || !parent_branch_id || !branch_point_node_id) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, parent_branch_id, branch_point_node_id' },
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

      // If no color is provided, determine the best color based on depth and siblings
      let branchColor = color;
      if (!branchColor) {
        // Get a list of colors already used by siblings (branches with same parent and depth)
        const usedColorsResult = await query(
          'SELECT color FROM branches WHERE parent_branch_id = $1 AND depth = $2',
          [parent_branch_id, branchDepth]
        );
        
        const usedColors = usedColorsResult.rows.map(row => row.color);
        
        // Define available colors palette
        const colorPalette = [
          '#ef4444', // red-500
          '#10b981', // emerald-500
          '#f59e0b', // amber-500
          '#8b5cf6', // violet-500
          '#ec4899', // pink-500
          '#06b6d4', // cyan-500
          '#84cc16', // lime-500
          '#6366f1', // indigo-500 (current default, moved to end)
        ];
        
        // Find first color not already used by siblings
        branchColor = colorPalette.find(color => !usedColors.includes(color)) || colorPalette[branchDepth % colorPalette.length];
      }

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
      
      // Create a dedicated branch point node after the assistant message
      const branchPointNodeId = uuidv4();
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
      
      // Create the new branch, referencing the new branch point
      const branchResult = await query(
        `INSERT INTO branches (
          id, project_id, parent_branch_id, branch_point_node_id,
          name, color, depth, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          branchId, project_id, parent_branch_id, branchPointNodeId,
          branchName, branchColor, branchDepth, created_by
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