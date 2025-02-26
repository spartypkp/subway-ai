import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

/**
 * API route for creating new messages and generating AI responses
 * 
 * This endpoint:
 * 1. Creates a new user-message node
 * 2. Generates an AI response using Anthropic Claude
 * 3. Creates an assistant-message node for the AI response
 * 
 * Required body parameters:
 * - projectId: The ID of the project
 * - branchId: The ID of the branch for this message
 * - parentId: The ID of the parent node
 * - content: The content of the message (object with text property)
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, branchId, parentId, content } = await request.json();
    
    if (!projectId || !branchId || !parentId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const userId = 'user123'; // In a real app, get this from the authenticated user
    
    // Start a transaction
    await query('BEGIN');
    
    try {
      // Get the max position in the branch for the user message
      const maxPosResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM timeline_nodes
        WHERE branch_id = $1
      `, [branchId]);
      
      const userMessagePosition = maxPosResult.rows[0].next_position;
      
      // Create a new user-message node
      const userMessageId = uuidv4();
      await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id, type, status,
          message_text, message_role, position, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        userMessageId,
        projectId,
        branchId,
        parentId,
        'user-message',
        'active',
        content.text,
        'user',
        userMessagePosition,
        userId,
        new Date()
      ]);
      
      // Fetch the conversation history to provide context to the AI
      const conversationHistory = await query(`
        WITH RECURSIVE conversation_tree AS (
          SELECT id, parent_id, type, message_text, message_role, position
          FROM timeline_nodes
          WHERE id = $1
          
          UNION ALL
          
          SELECT tn.id, tn.parent_id, tn.type, tn.message_text, tn.message_role, tn.position
          FROM timeline_nodes tn
          JOIN conversation_tree ct ON tn.id = ct.parent_id
        )
        SELECT id, parent_id, type, message_text, message_role, position
        FROM conversation_tree
        WHERE type IN ('user-message', 'assistant-message')
        ORDER BY position DESC
        LIMIT 10
      `, [userMessageId]);
      
      // Format messages for Anthropic API
      const formattedMessages = conversationHistory.rows
        .filter(node => node.type === 'user-message' || node.type === 'assistant-message')
        .map(node => {
          const role = node.type === 'user-message' ? 'user' : 'assistant';
          return {
            role: role,
            content: node.message_text || ''
          };
        })
        .filter(Boolean) // Remove any null values
        .reverse();
      
      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      });
      
      // Generate AI response using Claude
      let aiResponse;
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: formattedMessages as Anthropic.MessageParam[],
          system: `You are Claude, a helpful AI assistant integrated into Subway AI, a platform that visualizes conversations as a subway map with branches.

Each conversation can have multiple branches, allowing users to explore different directions for the same discussion. Your responses should be:

- Clear, concise, and helpful
- Written in a conversational but professional tone
- Focused on providing accurate information
- Mindful that users might create branches to explore alternative approaches or perspectives

The current conversation branch is one path in the conversation "subway map." Users can create new branches from any of your responses to explore different directions.

You should provide responses that are standalone and don't explicitly reference the subway/branch metaphor (as that would be confusing for users).`
        });
        
        // Extract text content from response
        aiResponse = response.content[0]?.type === 'text' 
          ? response.content[0].text 
          : "I'm sorry, I couldn't generate a proper response.";
      } catch (error) {
        console.error('Anthropic API error:', error);
        aiResponse = "I'm sorry, I encountered an issue while processing your message. Please try again.";
      }
      
      // Get the max position in the branch for the AI response
      const aiMaxPosResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM timeline_nodes
        WHERE branch_id = $1
      `, [branchId]);
      
      const aiMessagePosition = aiMaxPosResult.rows[0].next_position;
      
      // Create a new assistant-message node for the AI response
      const aiMessageId = uuidv4();
      await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id, type, status,
          message_text, message_role, position, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        aiMessageId,
        projectId,
        branchId,
        userMessageId,
        'assistant-message',
        'active',
        aiResponse,
        'assistant',
        aiMessagePosition,
        'ai',
        new Date()
      ]);
      
      // Commit the transaction
      await query('COMMIT');
      
      return NextResponse.json({ 
        userMessage: { 
          id: userMessageId, 
          type: 'user-message',
          content: { role: 'user', text: content.text }
        },
        aiMessage: { 
          id: aiMessageId, 
          type: 'assistant-message',
          content: { role: 'assistant', text: aiResponse }
        }
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ 
      error: 'Failed to create message', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}