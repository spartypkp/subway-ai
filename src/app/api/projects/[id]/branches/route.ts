import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * API endpoint for retrieving all branches for a specific project
 */
export async function GET(
  req: Request,
  context: { params: { id: string; }; }
) {
  const { params } = context;
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: 'Missing project ID' }, { status: 400 });
  }

  try {
    // First confirm project exists
    const projectCheck = await query(
      `SELECT id FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get all branches for this project with their relationship info
    const branchesResult = await query(`
      SELECT b.*,
        (SELECT COUNT(*) FROM timeline_nodes t 
         WHERE t.branch_id = b.id AND t.type IN ('user-message', 'assistant-message')) AS message_count,
        pb.name AS parent_branch_name,
        pb.color AS parent_branch_color,
        bp.id AS branch_point_id,
        bp.parent_id AS branch_parent_message_id,
        (SELECT COUNT(*) FROM branches child WHERE child.parent_branch_id = b.id) AS child_branch_count
      FROM branches b
      LEFT JOIN branches pb ON b.parent_branch_id = pb.id
      LEFT JOIN timeline_nodes bp ON b.branch_point_node_id = bp.id
      WHERE b.project_id = $1
      ORDER BY b.depth ASC, b.created_at ASC
    `, [projectId]);

    // Get branch roots for each branch
    const branchRootsResult = await query(`
      SELECT branch_id, id AS root_node_id
      FROM timeline_nodes
      WHERE project_id = $1 AND type IN ('root', 'branch-root')
    `, [projectId]);

    // Create a map of branch ID to root node ID
    const branchRootMap = new Map();
    branchRootsResult.rows.forEach(row => {
      branchRootMap.set(row.branch_id, row.root_node_id);
    });

    // Add root node information to each branch
    const enhancedBranches = branchesResult.rows.map(branch => ({
      ...branch,
      root_node_id: branchRootMap.get(branch.id) || null
    }));

    return NextResponse.json(enhancedBranches);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch branches',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 