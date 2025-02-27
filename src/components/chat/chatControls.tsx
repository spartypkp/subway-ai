"use client";

import { useState, useRef, FormEvent, KeyboardEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, StopCircle, Trash, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface ChatControlsProps {
  projectId: string;
  branchId: string | null;
  mainBranchId?: string;
  onMessageSubmit?: () => void;
  onOptimisticUpdate?: (messages: any[]) => void;
}

export function ChatControls({ 
  projectId, 
  branchId, 
  mainBranchId, 
  onMessageSubmit,
  onOptimisticUpdate 
}: ChatControlsProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add component lifecycle debugging
  useEffect(() => {
    console.log('🔧 DEBUG: ChatControls mounted with projectId:', projectId, 'branchId:', branchId, 'mainBranchId:', mainBranchId);
    return () => console.log('🔧 DEBUG: ChatControls unmounted');
  }, [projectId, branchId, mainBranchId]);

  // Function to adjust textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      console.log('🔧 DEBUG: Adjusting textarea height');
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  // Function to fetch the last message node
  const fetchLastMessageNode = async () => {
    console.log('🔧 DEBUG: Fetching last message node');
    try {
      // Build the URL based on available parameters
      let url = `/api/nodes?project_id=${projectId}`;
      
      if (branchId) {
        url += `&branch_id=${branchId}`;
        console.log('🔧 DEBUG: Fetching from branch:', branchId);
      } else if (mainBranchId) {
        url += `&branch_id=${mainBranchId}`;
        console.log('🔧 DEBUG: Fetching from main branch:', mainBranchId);
      } else {
        url += '&root=true';
        console.log('🔧 DEBUG: Fetching from root (no branch specified)');
      }
      
      console.log('🔧 DEBUG: Fetching from URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('🔧 DEBUG: Fetched nodes:', data);
      
      // Find the last message or the root node
      let lastNode = data.find((node: any) => node.type === 'root' || node.type === 'branch-root');
      
      // Sort messages by creation time
      const sortedMessages = data
        .filter((node: any) => node.type === 'user-message' || node.type === 'assistant-message')
        .sort((a: any, b: any) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      
      if (sortedMessages.length > 0) {
        lastNode = sortedMessages[0];
        console.log('🔧 DEBUG: Found last message node:', lastNode.id);
      } else {
        console.log('🔧 DEBUG: No message nodes found, using root node');
      }
      
      return lastNode;
    } catch (error) {
      console.error('🔧 DEBUG: Error fetching last message node:', error);
      return null;
    }
  };

  
  // Add optimistic messages to the UI
  const addOptimisticMessages = (userMessage: string, parentId: string) => {
    if (!onOptimisticUpdate) return;
    
    const timestamp = new Date().toISOString();
    const effectiveBranchId = branchId || mainBranchId || '';
    const optimisticUserId = uuidv4(); // Temporary ID for the user message
    
    // Create optimistic user message
    const optimisticUserMessage = {
      id: optimisticUserId,
      project_id: projectId,
      branch_id: effectiveBranchId,
      parent_id: parentId,
      type: 'user-message',
      message_text: userMessage,
      message_role: 'user',
      position: 999, // Temporary high position that will be replaced
      created_by: 'user',
      created_at: timestamp,
      optimistic: true, // Mark as optimistic to handle differently in UI
    };
    
    // Create optimistic AI message (loading state)
    const optimisticAiMessage = {
      id: uuidv4(),
      project_id: projectId,
      branch_id: effectiveBranchId,
      parent_id: optimisticUserId,
      type: 'assistant-message',
      message_text: '...',
      message_role: 'assistant',
      position: 1000, // Temporary high position that will be replaced
      created_by: 'ai',
      created_at: timestamp,
      optimistic: true,
      isLoading: true, // Mark as loading to show loading state in UI
    };
    
    // Update the UI with optimistic messages
    onOptimisticUpdate([optimisticUserMessage, optimisticAiMessage]);
    
    return {
      optimisticUserId,
      optimisticUserMessage,
      optimisticAiMessage
    };
  };

  // Function to handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) {
      console.log('🔧 DEBUG: Message submission skipped - empty or already loading');
      return;
    }
    
    console.log('🔧 DEBUG: Submitting message:', message.substring(0, 30) + (message.length > 30 ? '...' : ''));
    setIsLoading(true);
    
    try {
      // Find the last message node to set as parent
      const lastNode = await fetchLastMessageNode();
      if (!lastNode) {
        console.error('🔧 DEBUG: No parent node found, cannot submit message');
        setIsLoading(false);
        return;
      }
      
      console.log('🔧 DEBUG: Using parent node:', lastNode.id);
      
      // Determine which branch ID to use
      const effectiveBranchId = branchId || mainBranchId || '';
      console.log('🔧 DEBUG: Using branch ID:', effectiveBranchId);
      
      // Add optimistic user message to UI
      const userMessageText = message;
      const optimisticUserId = uuidv4();
      const timestamp = new Date().toISOString();
      
      // Create optimistic user message
      const optimisticUserMessage = {
        id: optimisticUserId,
        project_id: projectId,
        branch_id: effectiveBranchId,
        parent_id: lastNode.id,
        type: 'user-message',
        message_text: userMessageText,
        message_role: 'user',
        position: 999, // Temporary high position that will be replaced
        created_by: 'user',
        created_at: timestamp,
        optimistic: true, // Mark as optimistic to handle differently in UI
      };
      
      // Add optimistic user message to UI
      if (onOptimisticUpdate) {
        onOptimisticUpdate([optimisticUserMessage]);
      }
      
      // Clear the input early for better UX
      setMessage("");
      
      // Connect to the streaming API endpoint
      const response = await fetch('/api/messages/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          branch_id: effectiveBranchId,
          parent_id: lastNode.id,
          text: userMessageText,
          created_by: 'user'
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔧 DEBUG: Server error:', response.status, errorText);
        throw new Error(`Server error: ${response.status} ${errorText}`);
      }
      
      // Set up a reader to process the streamed response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }
      
      let aiMessageId: string | null = null;
      let isFirstChunk = true;
      
      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert the chunk to text
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const parsedData = JSON.parse(line);
            
            if (parsedData.event === 'userMessage') {
              // Replace our optimistic user message with the real one
              if (onOptimisticUpdate) {
                onOptimisticUpdate([{
                  ...parsedData.data,
                  optimistic: false
                }]);
              }
            } 
            else if (parsedData.event === 'aiMessageCreated') {
              // Store the AI message ID for future updates
              aiMessageId = parsedData.data.id;
              
              // Create an optimistic AI message (initially empty)
              if (onOptimisticUpdate && aiMessageId) {
                const optimisticAiMessage = {
                  id: aiMessageId,
                  project_id: projectId,
                  branch_id: effectiveBranchId,
                  parent_id: parsedData.data.parent_id,
                  type: 'assistant-message',
                  message_text: '', // Start empty
                  message_role: 'assistant',
                  position: parsedData.data.position,
                  created_by: 'ai',
                  created_at: new Date().toISOString(),
                  optimistic: true,
                  isLoading: false, // No loading spinner, we're streaming directly
                  isFirstChunk: true // Mark this as the first chunk so MessageList knows to initialize streaming
                };
                
                onOptimisticUpdate([optimisticAiMessage]);
              }
            }
            else if (parsedData.event === 'chunk' && aiMessageId) {
              // Update the AI message with the new chunk
              if (onOptimisticUpdate) {
                // Send each chunk with the streaming flag
                onOptimisticUpdate([{
                  id: aiMessageId,
                  message_text: parsedData.data.text,
                  type: 'assistant-message',
                  optimistic: true,
                  isStreamChunk: true // Mark as a streaming chunk
                }]);
              }
            }
            else if (parsedData.event === 'complete') {
              // Final update with complete message
              if (onOptimisticUpdate && aiMessageId) {
                onOptimisticUpdate([{
                  id: aiMessageId,
                  message_text: parsedData.data.fullText,
                  type: 'assistant-message',
                  optimistic: false, // Mark as not optimistic anymore
                  isComplete: true // Mark as complete
                }]);
              }
            }
            else if (parsedData.event === 'error') {
              console.error('🔧 DEBUG: Streaming error:', parsedData.data);
              // Update the AI message with the error
              if (onOptimisticUpdate && aiMessageId) {
                onOptimisticUpdate([{
                  id: aiMessageId,
                  message_text: "I'm sorry, I encountered an error while generating a response.",
                  type: 'assistant-message',
                  optimistic: false,
                  error: true
                }]);
              }
            }
          } catch (parseError) {
            console.error('🔧 DEBUG: Error parsing SSE data:', parseError, 'Raw line:', line);
          }
        }
      }
      
      // Trigger onMessageSubmit callback if provided
      if (onMessageSubmit) {
        console.log('🔧 DEBUG: Calling onMessageSubmit callback');
        onMessageSubmit();
      }
    } catch (error) {
      console.error('🔧 DEBUG: Error submitting message:', error);
      // Notify user of error - could add toast or error message here
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      console.log('🔧 DEBUG: Keyboard shortcut detected: Ctrl/Cmd+Enter');
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="p-4"
    >
      <div className="flex flex-col">
        <div className={cn(
          "relative flex items-end gap-2 transition-all duration-200",
          isFocused ? "shadow-lg" : "shadow-sm",
          isFocused ? "scale-[1.01]" : "scale-100"
        )}>
          <div className={cn(
            "flex-1 relative rounded-lg overflow-hidden",
            "bg-background border transition-all duration-200",
            isFocused ? "border-primary/50 ring-1 ring-primary/20" : "border-input"
          )}>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isLoading ? "AI is thinking..." : "Type your message... (Ctrl+Enter to send)"}
              className={cn(
                "resize-none py-3 min-h-[52px] max-h-[200px] overflow-y-auto border-0",
                "pr-14 transition-all duration-200 focus-visible:ring-0",
                isLoading && "opacity-60"
              )}
              autoComplete="off"
              disabled={isLoading}
              rows={1}
            />
            {message && !isLoading && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground"
                onClick={() => {
                  setMessage('');
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.focus();
                  }
                }}
              >
                <Trash className="h-4 w-4" />
                <span className="sr-only">Clear input</span>
              </Button>
            )}
          </div>
          <Button 
            type="submit" 
            size="icon"
            className={cn(
              "h-[52px] w-[52px] shrink-0 transition-all duration-300 rounded-xl",
              !message.trim() && "opacity-70",
              isLoading && "animate-pulse-subtle bg-primary/80"
            )}
            disabled={!message.trim() || isLoading}
            variant={isLoading ? "outline" : "default"}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3 animate-fadeIn">
            <div className="flex items-center gap-1.5 bg-primary/5 text-primary-foreground/80 px-3 py-1.5 rounded-full">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span>AI is generating a response...</span>
            
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs ml-2 px-2 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  // TODO: In a real implementation, this would cancel the AI request
                  setIsLoading(false);
                }}
              >
                <StopCircle className="h-3 w-3 mr-1" />
                Stop
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
} 