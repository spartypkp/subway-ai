import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

/**
 * API route for creating new messages and generating AI responses
 * 
 * This endpoint:
 * 1. Creates a new message node from the user
 * 2. Generates an AI response using Anthropic Claude
 * 3. Creates a node for the AI response
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
    
    // Create a new message node for the user's message
    const userMessageId = uuidv4();
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (
         SELECT COALESCE(MAX(position), 0) + 1 
         FROM timeline_nodes 
         WHERE branch_id = $3
       ))`,
      [userMessageId, projectId, branchId, parentId, '', 'message', JSON.stringify({ role: 'user', text: content.text }), userId, new Date()]
    );
    
    // Fetch the conversation history to provide context to the AI
    const conversationHistory = await db.query(
      `WITH RECURSIVE conversation_tree AS (
        SELECT id, parent_id, content, type, position
        FROM timeline_nodes
        WHERE id = $1
        
        UNION ALL
        
        SELECT tn.id, tn.parent_id, tn.content, tn.type, tn.position
        FROM timeline_nodes tn
        JOIN conversation_tree ct ON tn.id = ct.parent_id
      )
      SELECT id, parent_id, content, type, position
      FROM conversation_tree
      WHERE type = 'message'
      ORDER BY position DESC
      LIMIT 10`,
      [userMessageId]
    );
    
    // Format messages for Anthropic API - properly handling the format Claude expects
    const formattedMessages = conversationHistory.rows
      .filter(node => node.type === 'message')
      .map(node => {
        try {
          const parsedContent = JSON.parse(node.content);
          if (parsedContent && typeof parsedContent === 'object' && 'role' in parsedContent && 'text' in parsedContent) {
            if (parsedContent.role === 'user' || parsedContent.role === 'assistant') {
              return {
                role: parsedContent.role,
                content: parsedContent.text
              };
            }
          }
          return null;
        } catch (e) {
          console.error('Error parsing message content:', e);
          return null;
        }
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
    
    // Create a new message node for the AI response
    const aiMessageId = uuidv4();
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (
         SELECT COALESCE(MAX(position), 0) + 1 
         FROM timeline_nodes 
         WHERE branch_id = $3
       ))`,
      [aiMessageId, projectId, branchId, userMessageId, '', 'message', JSON.stringify({ role: 'assistant', text: aiResponse }), 'ai', new Date()]
    );
    
    return NextResponse.json({ 
      userMessage: { id: userMessageId, content: { role: 'user', text: content.text } },
      aiMessage: { id: aiMessageId, content: { role: 'assistant', text: aiResponse } }
    });
    
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}