import { query } from '@/lib/db';
import { AnthropicStream, StreamingTextResponse } from '@/lib/streaming';
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint for creating new messages and generating AI responses
 * 
 * This endpoint creates a user message and generates an AI response in a transaction
 */
export async function POST(req: Request) {
	try {
		const body = await req.json();
		console.log('Received request payload:', JSON.stringify(body));

		const {
			project_id,
			parent_id,
			messages,
			stream = false
		} = body;

		// Detailed validation logging
		console.log('Validation check:');
		console.log('- project_id:', project_id ? 'present' : 'missing', typeof project_id);
		console.log('- parent_id:', parent_id ? 'present' : 'missing', typeof parent_id);
		console.log('- messages:', messages ? `present (${Array.isArray(messages) ? 'is array' : 'not array'})` : 'missing', typeof messages);

		// Validate required fields with more specific error messages
		if (!project_id) {
			return NextResponse.json(
				{ error: 'Missing required field: project_id' },
				{ status: 400 }
			);
		}

		if (!parent_id) {
			return NextResponse.json(
				{ error: 'Missing required field: parent_id' },
				{ status: 400 }
			);
		}

		if (!messages) {
			return NextResponse.json(
				{ error: 'Missing required field: messages' },
				{ status: 400 }
			);
		}

		if (!Array.isArray(messages)) {
			return NextResponse.json(
				{ error: 'Invalid format: messages must be an array' },
				{ status: 400 }
			);
		}

		// Validate message format for Anthropic API
		const isValidMessageFormat = messages.every(msg =>
			typeof msg === 'object' &&
			msg !== null &&
			('role' in msg) &&
			('content' in msg) &&
			(msg.role === 'user' || msg.role === 'assistant')
		);

		if (!isValidMessageFormat) {
			console.log('Invalid message format. Messages:', JSON.stringify(messages));
			return NextResponse.json(
				{ error: 'Invalid message format: each message must have "role" (user or assistant) and "content" fields' },
				{ status: 400 }
			);
		}

		// Start a transaction
		await query('BEGIN');

		try {
			// Fetch the parent message to get the branch_id and position
			const parentMessageResult = await query(
				'SELECT branch_id, position FROM timeline_nodes WHERE id = $1',
				[parent_id]
			);

			if (parentMessageResult.rows.length === 0) {
				await query('ROLLBACK');
				return NextResponse.json(
					{ error: 'Parent message not found' },
					{ status: 404 }
				);
			}

			// Get branch_id from parent message
			const effectiveBranchId = parentMessageResult.rows[0].branch_id;

			// Calculate next position for AI message
			const nextPositionResult = await query(
				'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM timeline_nodes WHERE branch_id = $1',
				[effectiveBranchId]
			);
			const aiMessagePosition = nextPositionResult.rows[0].next_position;

			// Initialize Anthropic client
			const anthropic = new Anthropic({
				apiKey: process.env.ANTHROPIC_API_KEY || '',
			});

			// Generate system prompt
			const systemPrompt = `You are Claude, a helpful AI assistant integrated into Subway AI, a platform that visualizes conversations as a subway map with branches.

Each conversation can have multiple branches, allowing users to explore different directions for the same discussion. Your responses should be:

- Clear, concise, and helpful
- Written in a conversational but professional tone
- Focused on providing accurate information
- Mindful that users might create branches to explore alternative approaches or perspectives

The current conversation branch is one path in the conversation "subway map." Users can create new branches from any of your responses to explore different directions.

You should provide responses that are standalone and don't explicitly reference the subway/branch metaphor (as that would be confusing for users).`;

			// Generate AI message ID
			const aiMessageId = uuidv4();

			// If streaming is requested, create and return a streaming response
			if (stream) {
				// Create AI message placeholder
				await query(`
          INSERT INTO timeline_nodes (
            id, project_id, branch_id, parent_id,
            type, message_text, message_role, created_by, created_at, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
        `, [
					aiMessageId,
					project_id,
					effectiveBranchId,
					parent_id,
					'assistant-message',
					'', // Empty initially, will be updated after streaming completes
					'assistant',
					'ai',
					aiMessagePosition
				]);

				// Commit the transaction to save the AI placeholder
				await query('COMMIT');

				// Create the streaming response
				const streamResponse = await anthropic.messages.create({
					model: 'claude-3-5-haiku-20241022',
					max_tokens: 1000,
					messages: messages,
					system: systemPrompt,
					stream: true,
				});

				// Transform the stream with metadata
				const messageStream = AnthropicStream(streamResponse, {
					onFinal: async (completion) => {
						// Once streaming is complete, update the AI message in the database
						try {
							await query(
								'UPDATE timeline_nodes SET message_text = $1 WHERE id = $2',
								[completion, aiMessageId]
							);
						} catch (updateError) {
							console.error('Failed to update AI message after streaming:', updateError);
						}
					}
				});

				// Add response metadata
				const responseMetadata = {
					user_message_id: parent_id,
					assistant_message_id: aiMessageId,
					branch_id: effectiveBranchId
				};

				// Return the streaming response with metadata
				return new StreamingTextResponse(messageStream, {
					headers: {
						'X-Message-Metadata': JSON.stringify(responseMetadata)
					}
				});
			} else {
				// For non-streaming requests, use the original approach
				let aiResponse;
				try {
					const response = await anthropic.messages.create({
						model: 'claude-3-5-haiku-20241022',
						max_tokens: 1000,
						messages: messages,
						system: systemPrompt
					});

					// Extract text content from response
					aiResponse = response.content[0]?.type === 'text'
						? response.content[0].text
						: "I'm sorry, I couldn't generate a proper response.";
				} catch (error) {
					console.error('Anthropic API error:', error);
					aiResponse = "I'm sorry, I encountered an issue while processing your message. Please try again.";
				}

				// Create a new assistant-message node for the AI response
				await query(`
          INSERT INTO timeline_nodes (
            id, project_id, branch_id, parent_id,
            type, message_text, message_role, created_by, created_at, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
        `, [
					aiMessageId,
					project_id,
					effectiveBranchId,
					parent_id,
					'assistant-message',
					aiResponse,
					'assistant',
					'ai',
					aiMessagePosition
				]);

				// Commit the transaction
				await query('COMMIT');

				// Return the assistant message
				return NextResponse.json({
					assistant_message: {
						id: aiMessageId,
						type: 'assistant-message',
						message_text: aiResponse,
						message_role: 'assistant',
						branch_id: effectiveBranchId,
						project_id: project_id,
						parent_id: parent_id,
						position: aiMessagePosition
					}
				});
			}
		} catch (error) {
			// Rollback on error
			await query('ROLLBACK');
			throw error;
		}
	} catch (error) {
		console.error('Error creating assistant message:', error);
		return NextResponse.json(
			{
				error: 'Failed to create assistant message',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}