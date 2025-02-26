import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * API route for creating new conversation branches
 * 
 * This endpoint:
 * 1. Creates a new branch fork node
 * 2. Creates the first message in the new branch
 * 
 * Required body parameters:
 * - projectId: The ID of the project
 * - parentMessageId: The ID of the message to branch from
 * - reason: The reason for creating this branch
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, parentMessageId, reason } = await request.json();
    
    if (!projectId || !parentMessageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Generate new IDs
    const branchId = uuidv4();
    const forkNodeId = uuidv4();
    const firstMessageId = uuidv4();
    
    // Create the fork node that represents the branch point
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        forkNodeId, 
        projectId, 
        branchId, 
        parentMessageId, 
        '', 
        'fork', 
        JSON.stringify({ reason: reason || 'New branch' }), 
        'user123', 
        new Date(),
        0
      ]
    );
    
    // Create the first message in the branch
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        firstMessageId, 
        projectId, 
        branchId, 
        forkNodeId, 
        '', 
        'message', 
        JSON.stringify({ 
          role: 'assistant', 
          text: 'This is the beginning of a new conversation branch. How would you like to proceed?' 
        }), 
        'ai', 
        new Date(),
        1
      ]
    );
    
    return NextResponse.json({ 
      branch_id: branchId,
      fork_node_id: forkNodeId,
      first_message_id: firstMessageId
    });
    
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
} 