"use client";

import { useState, useEffect, useRef } from 'react';
import { TimelineNode } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageSquare, GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MessageListProps {
  projectId: string;
  branchId: string | null;
  onBranchCreated: (newBranchId: string) => void;
}

// Type for message content
interface MessageContent {
  text: string;
  role: 'user' | 'assistant';
}

// Type for fork content
interface ForkContent {
  reason: string;
}

export function MessageList({ projectId, branchId, onBranchCreated }: MessageListProps) {
  const [messages, setMessages] = useState<TimelineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [branchReason, setBranchReason] = useState('');
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // Function to fetch messages
  const fetchMessages = async () => {
    setLoading(true);
    try {
      // Build the URL based on available parameters
      let url = `/api/nodes?project_id=${projectId}`;
      
      if (branchId) {
        url += `&branch_id=${branchId}`;
      } else {
        url += '&root=true';
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages when project or branch changes
  useEffect(() => {
    fetchMessages();
  }, [projectId, branchId, lastUpdateTime]);

  // Poll for new messages every 2 seconds when sending is happening
  useEffect(() => {
    const interval = setInterval(() => {
      // Only update if the last message is from the user
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === 'message') {
        try {
          const content = JSON.parse(lastMessage.content as string) as MessageContent;
          if (content.role === 'user') {
            setLastUpdateTime(Date.now());
          }
        } catch (error) {
          console.error('Error parsing message content:', error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse flex flex-col gap-4 w-full max-w-xl">
          <div className="bg-muted rounded-lg p-4 w-3/4 h-16"></div>
          <div className="bg-muted rounded-lg p-4 ml-auto w-3/4 h-16"></div>
          <div className="bg-muted rounded-lg p-4 w-3/4 h-16"></div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No messages yet</h3>
        <p className="text-muted-foreground mt-2">Start a conversation to see messages here.</p>
      </div>
    );
  }

  const handleBranchClick = (messageId: string) => {
    setSelectedMessageId(messageId);
    setBranchDialogOpen(true);
  };

  const createBranch = async () => {
    if (!selectedMessageId) return;
    
    setCreatingBranch(true);
    try {
      const response = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          parentMessageId: selectedMessageId,
          reason: branchReason || 'New branch'
        })
      });
      
      if (!response.ok) throw new Error('Failed to create branch');
      
      const result = await response.json();
      onBranchCreated(result.branch_start_node);
      setBranchDialogOpen(false);
      setBranchReason('');
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setCreatingBranch(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 max-w-3xl mx-auto p-4 pb-32">
        {messages.map((message) => {
          // Skip root nodes as they're not visible messages
          if (message.type === 'root') return null;

          if (message.type === 'message') {
            try {
              const messageContent = JSON.parse(message.content as string) as MessageContent;
              const isUser = messageContent.role === 'user';
              
              return (
                <div 
                  key={message.id} 
                  className={cn(
                    "group relative",
                    isUser ? "ml-12" : "mr-12"
                  )}
                  onMouseEnter={() => setActiveMessage(message.id)}
                  onMouseLeave={() => setActiveMessage(null)}
                >
                  <Card 
                    className={cn(
                      "p-4",
                      isUser 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert">
                      {messageContent.text}
                    </div>
                  </Card>
                  
                  {/* Branch creation button */}
                  {activeMessage === message.id && !isUser && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute -left-10 top-2"
                      onClick={() => handleBranchClick(message.id)}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </div>
                </div>
              );
            } catch (error) {
              console.error('Error parsing message content:', error, message);
              return null;
            }
          }

          if (message.type === 'fork') {
            try {
              const forkContent = JSON.parse(message.content as string) as ForkContent;
              return (
                <div key={message.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 h-px bg-border"></div>
                  <div className="px-3 py-1 text-xs text-muted-foreground rounded-full bg-muted">
                    Branch point: {forkContent.reason}
                  </div>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
              );
            } catch (error) {
              console.error('Error parsing fork content:', error, message);
              return null;
            }
          }

          return null;
        })}
        
        {/* Loading indicator when waiting for AI */}
        {loading && messages.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full" style={{ animationDelay: '0.2s' }}></div>
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full" style={{ animationDelay: '0.4s' }}></div>
              <span className="ml-2">Waiting for Claude's response...</span>
            </div>
          </div>
        )}
        
        {/* Bottom ref for scrolling */}
        <div ref={bottomRef} />
      </div>

      {/* Branch creation dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              Create a new conversation branch from this point. This will allow you to explore
              alternative paths of the conversation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="branch-reason">Branch Name/Reason</Label>
            <Input
              id="branch-reason"
              value={branchReason}
              onChange={(e) => setBranchReason(e.target.value)}
              placeholder="Exploring alternative approach..."
              className="mt-2"
            />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBranchDialogOpen(false)}
              disabled={creatingBranch}
            >
              Cancel
            </Button>
            <Button 
              onClick={createBranch}
              disabled={creatingBranch}
            >
              {creatingBranch ? 'Creating...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 