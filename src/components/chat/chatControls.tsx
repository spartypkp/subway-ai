"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, StopCircle, Trash, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useConversation } from '@/lib/contexts/ConversationContext';

/**
 * ChatControls Component
 * 
 * Input area for message submission with streaming response handling.
 * Uses ConversationContext for data management and state.
 */
export function ChatControls() {
  // Get data and functions from context
  const {
    sendMessage,
    streamingContent,
    updateStreamingContent
  } = useConversation();

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Function to adjust textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  // Function to handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Store the message before clearing the input
      const messageText = message.trim();
      
      // Clear the input immediately for better UX
      setMessage("");
      
      // Send the message using the context method
      await sendMessage(messageText);
    } catch (error) {
      console.error('Error submitting message:', error);
      // Could add a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
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
                  setIsLoading(false);
                  updateStreamingContent(null);
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