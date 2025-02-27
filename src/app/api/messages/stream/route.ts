import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Streaming API endpoint for generating AI responses
 * 
 * This endpoint creates a user message and streams an AI response
 */
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  
  // Create a ReadableStream to stream the response
  const stream = new ReadableStream({
    async start(controller) {
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
          controller.enqueue(encoder.encode(JSON.stringify({ 
            error: 'Missing required fields: project_id, branch_id, parent_id, and text are required' 
          })));
          controller.close();
          return;
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
            controller.enqueue(encoder.encode(JSON.stringify({ 
              error: 'Parent node not found' 
            })));
            controller.close();
            return;
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
              type, message_text, message_role, created_by, created_at, position
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
          
          // Send the user message info back to the client
          controller.enqueue(encoder.encode(JSON.stringify({ 
            event: 'userMessage',
            data: {
              id: userMessageId, 
              type: 'user-message',
              message_text: text,
              message_role: 'user',
              branch_id,
              project_id,
              parent_id,
              position: userMessagePosition
            }
          })));
          
          // Fetch the conversation history to provide context to the AI
          // We'll get up to 10 previous messages in the same branch
          const conversationHistory = await query(`
            WITH RECURSIVE conversation_tree AS (
              -- Start with current message
              SELECT id, parent_id, type, message_text, message_role, position
              FROM timeline_nodes
              WHERE id = $1
              
              UNION ALL
              
              -- Join with parent message
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
              return {
                role: node.message_role || (node.type === 'user-message' ? 'user' : 'assistant'),
                content: node.message_text || ''
              };
            })
            .reverse();
          
          // Initialize Anthropic client
          const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || '',
          });
          
          // Create AI message in the database (empty at first)
          const aiMaxPosResult = await query(`
            SELECT COALESCE(MAX(position), 0) + 1 AS next_position
            FROM timeline_nodes
            WHERE branch_id = $1
          `, [branch_id]);
          
          const aiMessagePosition = aiMaxPosResult.rows[0].next_position;
          const aiMessageId = uuidv4();
          
          await query(`
            INSERT INTO timeline_nodes (
              id, project_id, branch_id, parent_id,
              type, message_text, message_role, created_by, created_at, position
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
          `, [
            aiMessageId,
            project_id,
            branch_id,
            userMessageId,
            'assistant-message',
            '', // Start with empty text, will update as we stream
            'assistant',
            'ai',
            aiMessagePosition
          ]);
          
          // Send the AI message ID to the client
          controller.enqueue(encoder.encode(JSON.stringify({ 
            event: 'aiMessageCreated',
            data: {
              id: aiMessageId, 
              type: 'assistant-message',
              message_role: 'assistant',
              branch_id,
              project_id,
              parent_id: userMessageId,
              position: aiMessagePosition
            }
          })));
          
          // Generate AI response using Claude with streaming
          try {
            // Set up the streaming response from Anthropic
            const stream = await anthropic.messages.create({
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 1000,
              messages: formattedMessages as Anthropic.MessageParam[],
              stream: true,
              system: `You are Claude, a helpful AI assistant integrated into Subway AI, a platform that visualizes conversations as a subway map with branches.

Each conversation can have multiple branches, allowing users to explore different directions for the same discussion. Your responses should be:

- Clear, concise, and helpful
- Written in a conversational but professional tone
- Focused on providing accurate information
- Mindful that users might create branches to explore alternative approaches or perspectives

The current conversation branch is one path in the conversation "subway map." Users can create new branches from any of your responses to explore different directions.

You should provide responses that are standalone and don't explicitly reference the subway/branch metaphor (as that would be confusing for users).`
            });
            
            let fullResponse = '';
            
            // Stream the response to the client
            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                fullResponse += text;
                
                // Send the chunk to the client
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  event: 'chunk',
                  data: {
                    text,
                    messageId: aiMessageId
                  }
                })));
              }
            }
            
            // Update the AI message in the database with the full response
            await query(`
              UPDATE timeline_nodes
              SET message_text = $1
              WHERE id = $2
            `, [fullResponse, aiMessageId]);
            
            // Send the complete event
            controller.enqueue(encoder.encode(JSON.stringify({ 
              event: 'complete',
              data: {
                messageId: aiMessageId,
                fullText: fullResponse
              }
            })));
            
            // Commit the transaction
            await query('COMMIT');
            
          } catch (error) {
            console.error('Anthropic API error:', error);
            
            // Send error event
            controller.enqueue(encoder.encode(JSON.stringify({ 
              event: 'error',
              data: {
                error: 'Error generating AI response',
                messageId: aiMessageId
              }
            })));
            
            // Update AI message with error response
            const errorMessage = "I'm sorry, I encountered an issue while processing your message. Please try again.";
            await query(`
              UPDATE timeline_nodes
              SET message_text = $1
              WHERE id = $2
            `, [errorMessage, aiMessageId]);
            
            // Commit the transaction even on error to save the error message
            await query('COMMIT');
          }
          
        } catch (error) {
          // Rollback on error
          await query('ROLLBACK');
          
          console.error('Database error:', error);
          controller.enqueue(encoder.encode(JSON.stringify({ 
            event: 'error',
            data: {
              error: 'Database error occurred',
              details: error instanceof Error ? error.message : 'Unknown error'
            }
          })));
        }
        
      } catch (error) {
        console.error('Error in stream handler:', error);
        controller.enqueue(encoder.encode(JSON.stringify({ 
          event: 'error',
          data: {
            error: 'Server error occurred',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        })));
      } finally {
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 