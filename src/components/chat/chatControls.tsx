"use client";

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface ChatControlsProps {
  projectId: string;
  branchId: string | null;
}

export function ChatControls({ projectId, branchId }: ChatControlsProps) {
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);

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
      
      // The new messages will be fetched by the MessageList component
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="border-t p-4 bg-background"
    >
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        <Input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={sending ? "AI is thinking..." : "Type your message..."}
          className="flex-1"
          autoComplete="off"
          disabled={sending}
        />
        <Button 
          type="submit" 
          size="icon"
          disabled={!userInput.trim() || sending}
          variant={sending ? "outline" : "default"}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      {sending && (
        <div className="text-xs text-center text-muted-foreground mt-2">
          Claude is thinking. This may take a few moments...
        </div>
      )}
    </form>
  );
} 