import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * API endpoint for retrieving timeline nodes
 * 
 * Supports the following query parameters:
 * - project_id (required): The project to fetch nodes for
 * - branch_id: Fetch nodes for a specific branch
 * - root: When 'true', fetch the root node and its direct children
 * - all: When 'true', fetch all nodes for the project
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const branchId = searchParams.get('branch_id');
  const root = searchParams.get('root') === 'true';
  const all = searchParams.get('all') === 'true';
  
  // Legacy parameter - deprecated
  const expertId = searchParams.get('expert_id');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  try {
    let result;

    // Fetch all nodes for the project
    if (all) {
      result = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1
         ORDER BY created_at ASC`,
        [projectId]
      );
      return NextResponse.json(result.rows);
    }

    // Fetch root node only
    if (root) {
      result = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1 AND type = 'root'
         LIMIT 1`,
        [projectId]
      );

      if (result.rows.length > 0) {
        const rootNode = result.rows[0];
        
        // Find first level of messages (direct children of root)
        const childrenResult = await query(
          `SELECT * FROM timeline_nodes 
           WHERE project_id = $1 AND parent_id = $2
           ORDER BY created_at ASC`,
          [projectId, rootNode.id]
        );
        
        return NextResponse.json([rootNode, ...childrenResult.rows]);
      }
      
      return NextResponse.json([]);
    }

    // Fetch branch starting from a specific node
    if (branchId) {
      // First, get the branch node itself
      const branchNodeResult = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1 AND id = $2`,
        [projectId, branchId]
      );
      
      if (branchNodeResult.rows.length === 0) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
      }
      
      // Get all messages in the branch (finding all nodes connected to this branch)
      // This is a recursive query to find all descendants
      const branchMessages = await query(
        `WITH RECURSIVE branch_messages AS (
           SELECT * FROM timeline_nodes WHERE id = $1
           UNION
           SELECT n.* FROM timeline_nodes n
           INNER JOIN branch_messages b ON n.parent_id = b.id
         )
         SELECT * FROM branch_messages
         ORDER BY created_at ASC`,
        [branchId]
      );
      
      return NextResponse.json(branchMessages.rows);
    }

    // Legacy support for expert-based querying - DEPRECATED
    if (expertId) {
      console.warn('Expert-based querying is deprecated and will be removed in future versions');
      result = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1
         ORDER BY created_at ASC`,
        [projectId]
      );
      return NextResponse.json(result.rows);
    }

    // Default: return all nodes for the project
    result = await query(
      `SELECT * FROM timeline_nodes 
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    );
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
} 