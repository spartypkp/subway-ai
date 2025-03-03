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

    console.log(`[branches/POST] Creating branch: project=${project_id}, parent=${parent_branch_id}, point=${branch_point_node_id}, direction=${direction}`);

    // Validate required fields
    if (!project_id || !parent_branch_id || !branch_point_node_id) {
      console.error(`[branches/POST] Missing required fields:`, 
        { project_id, parent_branch_id, branch_point_node_id });
      return NextResponse.json(
        { error: 'Missing required fields: project_id, parent_branch_id, branch_point_node_id' },
        { status: 400 }
      );
    }

    // Validate direction if provided
    if (direction && !['left', 'right', 'auto'].includes(direction)) {
      console.error(`[branches/POST] Invalid direction: ${direction}`);
      return NextResponse.json(
        { error: 'Invalid direction. Must be one of: left, right, auto' },
        { status: 400 }
      );
    }

    // Begin transaction
    await query('BEGIN');
    console.log(`[branches/POST] Transaction started`);

    try {
      // Check that parent branch exists
      const branchCheck = await query(
        'SELECT depth FROM branches WHERE id = $1',
        [parent_branch_id]
      );

      if (branchCheck.rows.length === 0) {
        console.error(`[branches/POST] Parent branch not found: ${parent_branch_id}`);
        await query('ROLLBACK');
        return NextResponse.json({ error: 'Parent branch not found' }, { status: 404 });
      }

      console.log(`[branches/POST] Parent branch found with depth: ${branchCheck.rows[0].depth}`);

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
        console.log(`[branches/POST] Using existing branch point: ${branchPointNodeId}`);
        
        // Check if a branch already exists in the requested direction
        const existingBranchesCheck = await query(
          `SELECT id, metadata FROM branches 
           WHERE branch_point_node_id = $1`,
          [branchPointNodeId]
        );
        
        console.log(`[branches/POST] Found ${existingBranchesCheck.rows.length} existing branches at this point`);
        
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
          console.error(`[branches/POST] A branch already exists in the ${direction} direction`);
          await query('ROLLBACK');
          return NextResponse.json(
            { error: `A branch already exists in the ${direction} direction` },
            { status: 409 }
          );
        }
      } else {
        // Create a new branch point node
        branchPointNodeId = uuidv4();
        console.log(`[branches/POST] Creating new branch point: ${branchPointNodeId}`);
        
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
      console.log(`[branches/POST] New branch will have depth: ${branchDepth}`);

      // Fetch ALL branches for the project to initialize color manager properly
      const allBranchesResult = await query(
        'SELECT id, parent_branch_id, depth, color FROM branches WHERE project_id = $1',
        [project_id]
      );
      
      console.log(`[branches/POST] Fetched ${allBranchesResult.rows.length} branches for ColorManager`);
      
      // Debug check for branches with null colors
      const nullColorBranches = allBranchesResult.rows.filter(b => !b.color);
      if (nullColorBranches.length > 0) {
        console.warn(`[branches/POST] WARNING: ${nullColorBranches.length} existing branches have null colors:`, 
          nullColorBranches.map(b => ({ id: b.id, parent: b.parent_branch_id, depth: b.depth })));
      }
      
      // Initialize color manager with ALL existing branches
      const colorManager = new BranchColorManager(allBranchesResult.rows);

      // Generate new branch ID
      const branchId = uuidv4();
      const branchName = name || `Branch ${branchDepth}-${branchId.slice(0, 4)}`;
      console.log(`[branches/POST] Generated new branch ID: ${branchId}, name: ${branchName}`);
      
      // Use the BranchColorManager to get a color for the new branch
      let color;
      try {
        color = colorManager.getColorForBranch(branchId, parent_branch_id, branchDepth);
        console.log(`[branches/POST] Color manager assigned color: ${color}`);
        
        // Validate color
        if (!color) {
          console.error(`[branches/POST] ERROR: Color manager returned null/undefined color`);
          color = '#ef4444'; // Default to red if no color returned
          console.log(`[branches/POST] Using fallback color: ${color}`);
        }
      } catch (colorError) {
        console.error(`[branches/POST] ERROR in color assignment:`, colorError);
        color = '#ef4444'; // Default to red on error
        console.log(`[branches/POST] Using fallback color after error: ${color}`);
      }

      // Create the new branch, referencing the branch point
      const branchResult = await query(
        `INSERT INTO branches (
          id, project_id, parent_branch_id, branch_point_node_id,
          name, color, depth, created_by, created_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, COALESCE($6, '#ef4444'), $7, $8, NOW(), $9)
        RETURNING *`,
        [
          branchId, project_id, parent_branch_id, branchPointNodeId,
          branchName, color, branchDepth, created_by,
          JSON.stringify({ layout: { direction } })
        ]
      );

      const newBranch = branchResult.rows[0];
      console.log(`[branches/POST] New branch created:`, {
        id: newBranch.id,
        name: newBranch.name,
        color: newBranch.color,
        parent: newBranch.parent_branch_id,
        depth: newBranch.depth
      });

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
      console.log(`[branches/POST] Branch root node created: ${rootNodeId}`);

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
      console.log(`[branches/POST] Positions normalized for parent branch: ${parent_branch_id}`);

      // Commit transaction
      await query('COMMIT');
      console.log(`[branches/POST] Transaction committed successfully`);

      // Return the created branch with its root node
      return NextResponse.json({
        ...newBranch,
        root_node_id: rootNodeId
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      console.error(`[branches/POST] Error during transaction, rolled back:`, error);
      throw error;
    }
  } catch (error) {
    console.error('[branches/POST] Error creating branch:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create branch',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 