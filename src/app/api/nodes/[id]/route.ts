import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * API endpoint for retrieving, updating, and deleting a specific node
 */
export async function GET(
  req: Request,
  context: { params: { id: string; }; }
) {
  const id = context.params.id;
  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  try {
    // Get node with branch information
    const result = await query(`
      SELECT n.*,
        b.name AS branch_name,
        b.color AS branch_color,
        b.depth AS branch_depth,
        parent.id AS parent_id,
        parent.type AS parent_type,
        parent.text AS parent_text
      FROM timeline_nodes n
      LEFT JOIN branches b ON n.branch_id = b.id
      LEFT JOIN timeline_nodes parent ON n.parent_id = parent.id
      WHERE n.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    // If this is a branch point, get child branches
    if (result.rows[0].type === 'branch-point') {
      const childBranchesResult = await query(`
        SELECT b.*,
          (SELECT COUNT(*) FROM timeline_nodes WHERE branch_id = b.id) AS node_count,
          (SELECT COUNT(*) FROM branches WHERE parent_branch_id = b.id) AS child_branch_count,
          n.id AS root_node_id
        FROM branches b
        JOIN timeline_nodes n ON n.branch_id = b.id AND n.type = 'branch-root'
        WHERE b.branch_point_node_id = $1
        ORDER BY b.created_at ASC
      `, [id]);

      return NextResponse.json({
        ...result.rows[0],
        child_branches: childBranchesResult.rows
      });
    }

    // For message nodes, get any child nodes
    if (result.rows[0].type === 'user-message' || result.rows[0].type === 'assistant-message') {
      const childrenResult = await query(`
        SELECT id, type, text, role, created_at
        FROM timeline_nodes
        WHERE parent_id = $1
        ORDER BY position ASC
      `, [id]);

      return NextResponse.json({
        ...result.rows[0],
        children: childrenResult.rows
      });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch node',
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

    // Get the current node to determine its type
    const currentNode = await query('SELECT type FROM timeline_nodes WHERE id = $1', [id]);
    if (currentNode.rows.length === 0) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const nodeType = currentNode.rows[0].type;
    let queryText;
    let queryParams;

    // Different update logic based on node type
    if (nodeType === 'user-message' || nodeType === 'assistant-message') {
      // For message nodes, allow updating text
      queryText = `
        UPDATE timeline_nodes
        SET text = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      queryParams = [data.text, id];
    } else if (nodeType === 'branch-point') {
      // For branch points, allow updating metadata
      queryText = `
        UPDATE timeline_nodes
        SET metadata = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      queryParams = [data.metadata ? JSON.stringify(data.metadata) : '{}', id];
    } else {
      // For other node types, limited updates
      queryText = `
        UPDATE timeline_nodes
        SET metadata = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      queryParams = [data.metadata ? JSON.stringify(data.metadata) : '{}', id];
    }

    const result = await query(queryText, queryParams);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update node',
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
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  try {
    // Start a transaction
    await query('BEGIN');
    
    try {
      // Check if this node has child nodes
      const childNodeCheck = await query(
        `SELECT COUNT(*) AS child_count FROM timeline_nodes WHERE parent_id = $1`,
        [id]
      );
      
      // If it has children, don't allow deletion
      if (parseInt(childNodeCheck.rows[0].child_count) > 0) {
        await query('ROLLBACK');
        return NextResponse.json(
          { error: 'Cannot delete node with child nodes' },
          { status: 400 }
        );
      }
      
      // For branch points, also check if they have associated branches
      const nodeTypeCheck = await query(
        `SELECT type FROM timeline_nodes WHERE id = $1`,
        [id]
      );
      
      if (nodeTypeCheck.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json(
          { error: 'Node not found' },
          { status: 404 }
        );
      }
      
      if (nodeTypeCheck.rows[0].type === 'branch-point') {
        const branchCheck = await query(
          `SELECT COUNT(*) AS branch_count FROM branches WHERE branch_point_node_id = $1`,
          [id]
        );
        
        if (parseInt(branchCheck.rows[0].branch_count) > 0) {
          await query('ROLLBACK');
          return NextResponse.json(
            { error: 'Cannot delete a branch point that has associated branches' },
            { status: 400 }
          );
        }
      }
      
      // Delete the node
      const result = await query(
        `DELETE FROM timeline_nodes WHERE id = $1 RETURNING id, type, text, branch_id, project_id`,
        [id]
      );

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json(
          { error: 'Node not found' },
          { status: 404 }
        );
      }
      
      // Commit the transaction
      await query('COMMIT');

      return NextResponse.json({ 
        deleted: true,
        node: result.rows[0]
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
        error: 'Failed to delete node',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 