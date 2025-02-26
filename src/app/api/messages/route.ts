import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

/**
 * API endpoint for creating new messages and generating AI responses
 * 
 * This endpoint creates a user message and generates an AI response in a transaction
 */
export async function POST(req: Request) {
  try {
    const { 
      project_id, 
      branch_id, 
      parent_id, 
      text, 
      created_by = 'anonymous' 
    } = await req.json();
    
    // Validate required fields
    if (!project_id || !branch_id || !parent_id || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, branch_id, parent_id, and text are required' },
        { status: 400 }
      );
    }
    
    // Start a transaction
    await query('BEGIN');
    
    try {
      // Check that parent node exists
      const parentNodeCheck = await query(
        'SELECT type FROM timeline_nodes WHERE id = $1',
        [parent_id]
      );

      if (parentNodeCheck.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ error: 'Parent node not found' }, { status: 404 });
      }
      
      // Get the max position in the branch
      const maxPosResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM timeline_nodes
        WHERE branch_id = $1
      `, [branch_id]);
      
      const userMessagePosition = maxPosResult.rows[0].next_position;
      
      // Create a new user-message node
      const userMessageId = uuidv4();
      await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id,
          type, text, role, created_by, created_at, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      `, [
        userMessageId,
        project_id,
        branch_id,
        parent_id,
        'user-message',
        text,
        'user',
        created_by,
        userMessagePosition
      ]);
      
      // Fetch the conversation history to provide context to the AI
      // We'll get up to 10 previous messages in the same branch
      const conversationHistory = await query(`
        WITH RECURSIVE conversation_tree AS (
          -- Start with current message
          SELECT id, parent_id, type, text, role, position
          FROM timeline_nodes
          WHERE id = $1
          
          UNION ALL
          
          -- Join with parent message
          SELECT tn.id, tn.parent_id, tn.type, tn.text, tn.role, tn.position
          FROM timeline_nodes tn
          JOIN conversation_tree ct ON tn.id = ct.parent_id
        )
        SELECT id, parent_id, type, text, role, position
        FROM conversation_tree
        WHERE type IN ('user-message', 'assistant-message')
        ORDER BY position DESC
        LIMIT 10
      `, [userMessageId]);
      
      // Format messages for Anthropic API
      const formattedMessages = conversationHistory.rows
        .filter(node => node.type === 'user-message' || node.type === 'assistant-message')
        .map(node => {
          return {
            role: node.role || (node.type === 'user-message' ? 'user' : 'assistant'),
            content: node.text || ''
          };
        })
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
      
      // Get the next position for the AI response
      const aiMaxPosResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_position
        FROM timeline_nodes
        WHERE branch_id = $1
      `, [branch_id]);
      
      const aiMessagePosition = aiMaxPosResult.rows[0].next_position;
      
      // Create a new assistant-message node for the AI response
      const aiMessageId = uuidv4();
      await query(`
        INSERT INTO timeline_nodes (
          id, project_id, branch_id, parent_id,
          type, text, role, created_by, created_at, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      `, [
        aiMessageId,
        project_id,
        branch_id,
        userMessageId,
        'assistant-message',
        aiResponse,
        'assistant',
        'ai',
        aiMessagePosition
      ]);
      
      // Commit the transaction
      await query('COMMIT');
      
      // Return both messages
      return NextResponse.json({ 
        user_message: { 
          id: userMessageId, 
          type: 'user-message',
          text: text,
          role: 'user',
          branch_id: branch_id,
          project_id: project_id,
          parent_id: parent_id,
          position: userMessagePosition
        },
        assistant_message: { 
          id: aiMessageId, 
          type: 'assistant-message',
          text: aiResponse,
          role: 'assistant',
          branch_id: branch_id,
          project_id: project_id,
          parent_id: userMessageId,
          position: aiMessagePosition
        }
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create message', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}