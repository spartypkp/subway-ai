import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * API endpoint for retrieving, updating, and deleting a specific branch
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
    // Get branch with additional statistics
    const result = await query(`
      SELECT b.*,
        p.name AS project_name,
        (SELECT COUNT(*) FROM timeline_nodes t 
         WHERE t.branch_id = b.id AND t.type IN ('user-message', 'assistant-message')) AS message_count,
        (SELECT COUNT(*) FROM branches child 
         WHERE child.parent_branch_id = b.id) AS child_branch_count,
        pb.name AS parent_branch_name,
        pb.color AS parent_branch_color
      FROM branches b
      JOIN projects p ON b.project_id = p.id
      LEFT JOIN branches pb ON b.parent_branch_id = pb.id
      WHERE b.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Get branch point information
    const branchPointResult = await query(`
      SELECT n.*, 
        parent.message_text AS parent_message_text,
        parent.type AS parent_type
      FROM timeline_nodes n
      LEFT JOIN timeline_nodes parent ON n.parent_id = parent.id
      WHERE n.id = $1
    `, [result.rows[0].branch_point_node_id]);

    // Get most recent messages in this branch
    const messagesResult = await query(`
      SELECT *
      FROM timeline_nodes
      WHERE branch_id = $1 AND type IN ('user-message', 'assistant-message')
      ORDER BY position DESC
      LIMIT 5
    `, [id]);

    return NextResponse.json({
      ...result.rows[0],
      branch_point: branchPointResult.rows[0] || null,
      recent_messages: messagesResult.rows
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch branch',
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
      `UPDATE branches
       SET name = $1,
           color = $2,
           is_active = $3,
           metadata = $4
       WHERE id = $5
       RETURNING *`,
      [
        data.name,
        data.color,
        data.is_active !== undefined ? data.is_active : true,
        data.metadata ? JSON.stringify(data.metadata) : '{}',
        id
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update branch',
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
      // Check if this branch has child branches
      const childBranchCheck = await query(
        `SELECT COUNT(*) AS child_count FROM branches WHERE parent_branch_id = $1`,
        [id]
      );
      
      if (parseInt(childBranchCheck.rows[0].child_count) > 0) {
        return NextResponse.json(
          { error: 'Cannot delete branch with child branches' },
          { status: 400 }
        );
      }
      
      // Delete will cascade to timeline_nodes due to foreign key constraints
      const result = await query(
        `DELETE FROM branches WHERE id = $1 RETURNING id, name, project_id`,
        [id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Branch not found' },
          { status: 404 }
        );
      }
      
      // Commit the transaction
      await query('COMMIT');

      return NextResponse.json({ 
        deleted: true,
        branch: result.rows[0]
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
        error: 'Failed to delete branch',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 