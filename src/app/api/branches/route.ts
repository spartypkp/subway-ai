import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * API route for creating new conversation branches
 * 
 * This endpoint:
 * 1. Creates a branch-point node in the parent branch
 * 2. Creates a new branch record in the branches table
 * 3. Creates a branch-root node in the new branch
 * 4. Creates an initial assistant message in the new branch
 * 
 * Required body parameters:
 * - projectId: The ID of the project
 * - parentMessageId: The ID of the message to branch from
 * - reason: The reason for creating this branch (optional)
 * - name: Optional name for the branch
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, parentMessageId, reason, name } = await request.json();
    
    if (!projectId || !parentMessageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Start a transaction
    await query('BEGIN');
    
    try {
      // Generate new IDs
      const branchId = uuidv4();
      const branchPointId = uuidv4();
      const branchRootId = uuidv4();
      const firstMessageId = uuidv4();
      const userId = 'user123'; // In a real app, get this from the authenticated user
      
      // Get parent message and its branch information
      const parentResult = await query(`
        SELECT n.*, b.id AS parent_branch_id, b.depth AS parent_depth, b.color AS parent_color
        FROM timeline_nodes n
        JOIN branches b ON n.branch_id = b.id
        WHERE n.id = $1
      `, [parentMessageId]);
      
      if (parentResult.rows.length === 0) {
        throw new Error('Parent message not found');
      }
      
      const parentMessage = parentResult.rows[0];
      const parentBranchId = parentMessage.branch_id;
      const parentDepth = parentMessage.parent_depth || 0;
      
      // Get the max position in the parent branch for the branch point
      const maxPosResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM timeline_nodes
        WHERE branch_id = $1
      `, [parentBranchId]);
      
      const branchPointPosition = maxPosResult.rows[0].next_position;
      
      // Create the branch-point node in the parent branch
      await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id, type, status, 
          message_text, position, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        branchPointId,
        projectId,
        parentBranchId,
        parentMessageId,
        'branch-point',
        'active',
        reason ? `Branch: ${reason}` : 'New branch',
        branchPointPosition,
        userId,
        new Date()
      ]);
      
      // Get branch color based on depth
      const colors = [
        '#3b82f6', // blue-500 (main line)
        '#ef4444', // red-500
        '#10b981', // emerald-500
        '#f59e0b', // amber-500
        '#8b5cf6', // violet-500
        '#ec4899', // pink-500
        '#06b6d4', // cyan-500
        '#84cc16', // lime-500
      ];
      
      const branchColor = colors[(parentDepth + 1) % colors.length];
      
      // Create new branch in the branches table
      await query(`
        INSERT INTO branches (
          id, project_id, name, parent_branch_id, branch_point_node_id,
          color, depth, is_active, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        branchId,
        projectId,
        name || `Branch from ${parentMessage.message_text?.substring(0, 20) || 'message'}`,
        parentBranchId,
        branchPointId,
        branchColor,
        parentDepth + 1,
        true,
        userId,
        new Date()
      ]);
      
      // Create a branch-root node in the new branch
      await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, type, status, 
          position, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        branchRootId,
        projectId,
        branchId,
        'branch-root',
        'active',
        0,
        userId,
        new Date()
      ]);
      
      // Create the first message in the branch
      await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id, type, status,
          message_text, message_role, position, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        firstMessageId,
        projectId,
        branchId,
        branchRootId,
        'assistant-message',
        'active',
        'This is the beginning of a new conversation branch. How would you like to proceed?',
        'assistant',
        1,
        'ai',
        new Date()
      ]);
      
      // Commit the transaction
      await query('COMMIT');
      
      return NextResponse.json({
        branch_id: branchId,
        branch_point_id: branchPointId,
        branch_root_id: branchRootId,
        first_message_id: firstMessageId,
        branch_color: branchColor,
        branch_depth: parentDepth + 1
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ 
      error: 'Failed to create branch', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 