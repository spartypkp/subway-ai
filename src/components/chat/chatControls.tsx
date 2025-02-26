"use client";

import { useState, useRef, FormEvent, KeyboardEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, StopCircle, Trash, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatControlsProps {
  projectId: string;
  branchId: string | null;
}

export function ChatControls({ projectId, branchId }: ChatControlsProps) {
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || sending) return;
    
    setSending(true);
    try {
      // Find the parent ID for the new message
      let parentId = null;
      
      // If we have a branch ID, we need to fetch the last node in that branch
      if (branchId) {
        const response = await fetch(`/api/nodes?project_id=${projectId}&branch_id=${branchId}`);
        const data = await response.json();
        
        // Find the last node in the branch that is a message
        const messageNodes = data
          .filter((node: any) => node.type === 'message')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        if (messageNodes.length > 0) {
          parentId = messageNodes[0].id;
        }
      } else {
        // If no branch ID, fetch the root node
        const response = await fetch(`/api/nodes?project_id=${projectId}&root=true`);
        const data = await response.json();
        
        // The endpoint returns the root node and its immediate children
        const rootNode = data.find((node: any) => node.type === 'root');
        if (rootNode) {
          parentId = rootNode.id;
        }
      }
      
      // If we couldn't find a parent ID, don't send the message
      if (!parentId) {
        console.error('No parent node found to attach message to');
        return;
      }
      
      // Send the message
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          branchId: branchId,
          parentId: parentId,
          content: { text: userInput }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      // Clear the input field
      setUserInput('');
      
      // Resize the textarea back to its default height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      // The new messages will be fetched by the MessageList component
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset the height to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Set the height based on content with a maximum of 200px
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
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
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={sending ? "AI is thinking..." : "Type your message... (Ctrl+Enter to send)"}
              className={cn(
                "resize-none py-3 min-h-[52px] max-h-[200px] overflow-y-auto border-0",
                "pr-14 transition-all duration-200 focus-visible:ring-0",
                sending && "opacity-60"
              )}
              autoComplete="off"
              disabled={sending}
              rows={1}
            />
            {userInput && !sending && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground"
                onClick={() => {
                  setUserInput('');
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
              !userInput.trim() && "opacity-70",
              sending && "animate-pulse-subtle bg-primary/80"
            )}
            disabled={!userInput.trim() || sending}
            variant={sending ? "outline" : "default"}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {sending && (
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
                  setSending(false);
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