import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * API endpoint for retrieving timeline nodes
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('project_id');
  const branchId = url.searchParams.get('branch_id');
  const parentId = url.searchParams.get('parent_id');
  const type = url.searchParams.get('type');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const includeChildren = url.searchParams.get('include_children') === 'true';

  // Validate required parameters
  if (!projectId) {
    return NextResponse.json(
      { error: 'Missing required parameter: project_id' },
      { status: 400 }
    );
  }

  try {
    // Build the base query
    let queryText = `
      SELECT n.*,
        b.name AS branch_name,
        b.color AS branch_color,
        b.depth AS branch_depth,
        b.parent_branch_id,
        pb.name AS parent_branch_name,
        pb.color AS parent_branch_color
      FROM timeline_nodes n
      LEFT JOIN branches b ON n.branch_id = b.id
      LEFT JOIN branches pb ON b.parent_branch_id = pb.id
      WHERE n.project_id = $1
    `;

    const queryParams = [projectId];
    let paramIndex = 2;

    // Add optional filters
    if (branchId) {
      queryText += ` AND n.branch_id = $${paramIndex}`;
      queryParams.push(branchId);
      paramIndex++;
    }

    if (parentId) {
      queryText += ` AND n.parent_id = $${paramIndex}`;
      queryParams.push(parentId);
      paramIndex++;
    }

    if (type) {
      queryText += ` AND n.type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    // Order by branch depth and position
    queryText += ` ORDER BY b.depth ASC, n.position ASC`;

    // Apply limit
    if (limit > 0) {
      queryText += ` LIMIT $${paramIndex}`;
      queryParams.push(limit.toString()); // Convert to string to match parameter type
    }

    const result = await query(queryText, queryParams);

    let nodes = result.rows;

    // If requested, include child branches for branch points
    if (includeChildren && nodes.some(n => n.type === 'branch-point')) {
      // Get all branch points from the result
      const branchPointIds = nodes
        .filter(n => n.type === 'branch-point')
        .map(n => n.id);

      if (branchPointIds.length > 0) {
        // Find all branches that have these branch points as their parent
        const childBranchesQuery = `
          SELECT b.*,
            (SELECT COUNT(*) FROM timeline_nodes WHERE branch_id = b.id) AS node_count,
            bp.id AS branch_point_id,
            bp.parent_id AS branch_parent_message_id,
            n.id AS root_node_id
          FROM branches b
          JOIN timeline_nodes bp ON b.branch_point_node_id = bp.id
          JOIN timeline_nodes n ON n.branch_id = b.id AND n.type = 'branch-root'
          WHERE b.branch_point_node_id = ANY($1)
          ORDER BY b.depth ASC, b.created_at ASC
        `;

        const childBranchesResult = await query(childBranchesQuery, [branchPointIds]);
        
        // Attach child branches to their parent nodes
        nodes = nodes.map(node => {
          if (node.type === 'branch-point') {
            return {
              ...node,
              child_branches: childBranchesResult.rows.filter(
                branch => branch.branch_point_id === node.id
              )
            };
          }
          return node;
        });
      }
    }

    return NextResponse.json(nodes);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve nodes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}