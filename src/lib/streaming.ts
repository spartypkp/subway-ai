import Anthropic from '@anthropic-ai/sdk';

/**
 * Custom StreamingTextResponse class that properly formats the response headers
 * for server-sent events (streaming)
 */
export class StreamingTextResponse extends Response {
  constructor(
    stream: ReadableStream,
    options: { headers?: Record<string, string> } = {}
  ) {
    const { headers = {}, ...rest } = options;
    
    super(stream, {
      ...rest,
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...headers,
      },
    });
  }
}

/**
 * Convert an Anthropic streaming response into a web standard ReadableStream
 */
export function AnthropicStream(
  stream: AsyncIterable<Anthropic.MessageStreamEvent>,
  options?: {
    onFinal?: (completion: string) => Promise<void> | void;
  }
): ReadableStream {
  const encoder = new TextEncoder();
  let fullText = '';

  return new ReadableStream({
    async start(controller) {
      const reader = stream[Symbol.asyncIterator]();

      try {
        while (true) {
          const { done, value } = await reader.next();
          if (done) break;

          if (value.type === 'content_block_delta' && value.delta.type === 'text_delta') {
            const text = value.delta.text;
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        if (options?.onFinal) {
          await options.onFinal(fullText);
        }
        controller.close();
      }
    }
  });
}

/**
 * Process a streaming response from the server
 */
export async function processStreamingResponse(
  response: Response,
  onChunk: (text: string) => void,
  onComplete?: () => void
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedText = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;
      onChunk(accumulatedText);
    }
  } finally {
    reader.releaseLock();
    if (onComplete) {
      onComplete();
    }
  }
  
  return accumulatedText;
} 