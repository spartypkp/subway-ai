"use client";

import { useState, useRef, FormEvent, KeyboardEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, StopCircle, Trash, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { processStreamingResponse } from '@/lib/streaming';

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

  // Add function to generate a realistic dummy AI response for testing
  const generateDummyResponse = (userMessage: string): string => {
    // Simple response generation based on user input
    const message = userMessage.toLowerCase();
    
    if (message.includes('hello') || message.includes('hi')) {
      return "Hello! How can I assist you with the Subway AI platform today?";
    }
    
    if (message.includes('help') || message.includes('guide')) {
      return "I'd be happy to help you with Subway AI. What specific aspect would you like to know more about? You can ask about branches, visualization, or general usage.";
    }
    
    if (message.includes('branch')) {
      return "Branches in Subway AI allow you to explore different conversation paths. Think of them as alternate routes on a subway map. You can create a new branch from any assistant message to explore different ideas.";
    }
    
    if (message.includes('visualize') || message.includes('map')) {
      return "Subway AI visualizes your conversations as metro lines on a map. Each message is a 'station' and different conversation threads are represented as branching subway lines. This gives you a spatial understanding of your conversation paths.";
    }
    
    // Default response for other inputs
    return "I understand your message about \"" + userMessage + "\". The Subway AI platform transforms complex AI discussions into navigable, branching conversation threads represented as metro lines. Is there anything specific about this visualization approach you'd like to explore?";
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
      position: 999, // Temporary high position
      created_by: 'user',
      created_at: timestamp,
      optimistic: true, // Mark as optimistic
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
      position: 1000, // Temporary high position
      created_by: 'ai',
      created_at: timestamp,
      optimistic: true,
      isLoading: true, // Mark as loading to show loading state
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
      
      // Store the message text before clearing the input
      const userMessageText = message.trim();
      
      // Add optimistic messages to UI BEFORE clearing the input
      const optimisticData = addOptimisticMessages(userMessageText, lastNode.id);
      
      // Clear the input after adding optimistic messages
      setMessage("");
      
      // For streaming implementation, we'll make an API call and receive a streaming response
      try {
        // Submit the message with the stream parameter
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            project_id: projectId,
            branch_id: effectiveBranchId,
            parent_id: lastNode.id,
            text: userMessageText,
            created_by: 'user',
            stream: true // Enable streaming
          }),
        });

        // Check if this is a streaming response
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
          console.log('🔧 DEBUG: Received streaming response');
          
          // Get message metadata from response headers
          const metadataHeader = response.headers.get('X-Message-Metadata');
          let messageMetadata = null;
          
          if (metadataHeader) {
            try {
              messageMetadata = JSON.parse(metadataHeader);
              console.log('🔧 DEBUG: Message metadata:', messageMetadata);
            } catch (e) {
              console.error('🔧 DEBUG: Error parsing metadata:', e);
            }
          }
          
          // Use our utility function to process the streaming response
          await processStreamingResponse(
            response,
            (streamedText) => {
              // Update the UI with each chunk
              if (onOptimisticUpdate && optimisticData) {
                // Create an updated version of the optimistic AI message with the latest text
                // The MessageList component will identify this by ID and update the existing message
                const updatedAiMessage = {
                  ...optimisticData.optimisticAiMessage,
                  message_text: streamedText,
                  isLoading: false
                };
                // Pass to MessageList which will update (not append) based on the message ID
                onOptimisticUpdate([updatedAiMessage]);
              }
            },
            () => {
              // When streaming is complete, refresh messages to get the final stored version
              if (onMessageSubmit) {
                console.log('🔧 DEBUG: Calling onMessageSubmit callback after streaming');
                onMessageSubmit();
              }
            }
          );
        } else {
          // Handle non-streaming response
          if (!response.ok) {
            const errorText = await response.text();
            console.error('🔧 DEBUG: Server error:', response.status, errorText);
            throw new Error(`Server error: ${response.status} ${errorText}`);
          }
          
          // For non-streaming response, parse JSON
          const data = await response.json();
          console.log('🔧 DEBUG: Message submission response:', data);
          
          // Use mock response to update UI immediately while we wait for database to sync
          if (onOptimisticUpdate && optimisticData) {
            const mockAiResponse = generateDummyResponse(userMessageText);
            const updatedAiMessage = {
              ...optimisticData.optimisticAiMessage,
              message_text: mockAiResponse,
              isLoading: false
            };
            onOptimisticUpdate([updatedAiMessage]);
          }
          
          // Trigger onMessageSubmit callback to refresh messages from DB
          if (onMessageSubmit) {
            console.log('🔧 DEBUG: Calling onMessageSubmit callback');
            onMessageSubmit();
          }
        }
      } catch (error) {
        console.error('🔧 DEBUG: Error handling message submission:', error);
        
        // On error, still show a response in the UI
        if (onOptimisticUpdate && optimisticData) {
          const errorMessage = {
            ...optimisticData.optimisticAiMessage,
            message_text: "I'm sorry, I encountered an error processing your request. Please try again.",
            isLoading: false
          };
          onOptimisticUpdate([errorMessage]);
        }
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