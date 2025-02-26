"use client";

import React, { useState, useEffect, useRef } from 'react';
import { TimelineNode } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageSquare, GitBranch, User, Bot, Sparkles } from 'lucide-react';
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

// Updated to match the actual database JSONB structure
interface MessageContent {
  role: 'user' | 'assistant' | string;
  content: string;
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
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to fetch messages
  const fetchMessages = async () => {
    console.log('Fetching messages for project:', projectId, 'branch:', branchId || 'main');
    setLoading(true);
    try {
      // Base URL for fetching messages
      let url = `/api/nodes?project_id=${projectId}`;
      
      // If branchId is provided, fetch messages for that specific branch
      // Otherwise, fetch the complete tree to get all messages
      if (branchId) {
        url += `&branch_id=${branchId}`;
      } else {
        url += `&complete_tree=true`;
      }
      
      console.log('Fetching from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.length} messages`);
      
      // Store messages
      setMessages(data);
      
      // Hide loading indicator
      setShowLoadingIndicator(false);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages when project or branch changes
  useEffect(() => {
    fetchMessages();
  }, [projectId, branchId]);

  // Set up polling for updates (every 3 seconds when expecting a response)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll if we're possibly waiting for an AI response
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === 'message') {
        try {
          const content = lastMessage.content as unknown as MessageContent;
          if (content.role === 'user') {
            setShowLoadingIndicator(true);
            fetchMessages();
          }
        } catch (error) {
          console.error('Error checking last message:', error);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [messages, projectId, branchId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filter messages based on the current branch
  const filteredMessages = React.useMemo(() => {
    if (!messages.length) return [];
    
    // If no specific branch is selected, show messages from all branches
    // (You might want to adjust this logic based on your requirements)
    if (!branchId) {
      // Filter to just show the main branch for now
      // Find the main branch (usually the first branch created)
      const branches = new Set(messages.map(m => m.branch_id));
      console.log('Available branches:', [...branches]);
      
      // Look for the root node to identify the main branch
      const rootNode = messages.find(m => m.type === 'root');
      if (rootNode) {
        const mainBranchId = rootNode.branch_id;
        console.log('Main branch ID:', mainBranchId);
        
        return messages
          .filter(m => m.branch_id === mainBranchId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      
      // Fallback: if no root node found, just show all messages sorted by time
      return [...messages].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    
    // If a specific branch is selected, filter to show only messages from that branch
    return messages
      .filter(m => m.branch_id === branchId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, branchId]);

  // Safely parse message content with proper error handling
  const parseMessageContent = (node: TimelineNode): MessageContent => {
    try {
      if (!node.content) {
        console.warn('Node has no content:', node.id);
        return { role: 'assistant', content: 'No content available' };
      }
      
      // If content is already an object
      if (typeof node.content === 'object') {
        const content = node.content as any;
        
        // Check if it has the expected structure
        if (content.role && content.content) {
          return {
            role: content.role,
            content: content.content
          };
        }
        
        // Handle legacy format with 'text' instead of 'content'
        if (content.role && content.text) {
          return {
            role: content.role,
            content: content.text
          };
        }
        
        // If no recognizable structure, stringify the object
        console.warn('Node content has unexpected structure:', node.id, content);
        return {
          role: 'assistant',
          content: JSON.stringify(content)
        };
      }
      
      // If content is a string, try to parse it
      if (typeof node.content === 'string') {
        try {
          const parsed = JSON.parse(node.content);
          if (parsed.role && (parsed.content || parsed.text)) {
            return {
              role: parsed.role,
              content: parsed.content || parsed.text
            };
          }
          return { role: 'assistant', content: node.content };
        } catch (e) {
          // Not valid JSON, treat as raw content
          return { role: 'assistant', content: node.content };
        }
      }
      
      // Fallback for any other type
      console.warn('Unexpected content type:', typeof node.content);
      return { role: 'assistant', content: String(node.content) };
    } catch (error) {
      console.error('Error parsing message content:', error, node);
      return { role: 'assistant', content: 'Error parsing message' };
    }
  };

  // Parse fork content
  const parseForkContent = (node: TimelineNode): ForkContent => {
    try {
      if (typeof node.content === 'object') {
        const content = node.content as any;
        if (content.reason) {
          return { reason: content.reason };
        }
      }
      
      if (typeof node.content === 'string') {
        try {
          const parsed = JSON.parse(node.content);
          if (parsed.reason) {
            return { reason: parsed.reason };
          }
        } catch (e) {
          // Not valid JSON
        }
      }
      
      // Default fork reason if none found
      return { reason: 'Branch point' };
    } catch (error) {
      console.error('Error parsing fork content:', error);
      return { reason: 'Branch point' };
    }
  };

  // Format message text with markdown-like formatting
  const formatMessageText = (text: string): string => {
    if (!text) return '';
    
    // Replace newlines with <br>
    let formatted = text.replace(/\n/g, '<br>');
    
    // Bold: **text** -> <strong>text</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text* -> <em>text</em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code: `text` -> <code>text</code>
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    
    return formatted;
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse flex flex-col gap-4 w-full max-w-xl">
          <div className="bg-muted/60 rounded-lg p-4 w-3/4 h-16"></div>
          <div className="bg-muted/60 rounded-lg p-4 ml-auto w-3/4 h-16"></div>
          <div className="bg-muted/60 rounded-lg p-4 w-3/4 h-16"></div>
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
    console.log('Branch button clicked for message:', messageId);
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
        {/* Branch line visualization */}
        <div className="absolute left-[calc(50%-1px)] top-0 bottom-0 w-2 pointer-events-none">
          <div 
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-20"
            style={{ background: `linear-gradient(to bottom, transparent, var(--primary) 10%, var(--primary) 90%, transparent)` }}
          ></div>
        </div>
        
        {filteredMessages
          .map((message, index) => {
            // Skip root nodes as they're not visible messages
            if (message.type === 'root') {
              return null;
            }

            if (message.type === 'message') {
              try {
                // Parse message content using our updated parser
                const messageContent = parseMessageContent(message);
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
                    {/* Connection to branch line */}
                    <div className={cn(
                      "absolute top-1/2 w-8 h-0.5 bg-primary opacity-20",
                      isUser ? "right-full" : "left-full"
                    )}></div>
                    
                    {/* Avatar */}
                    <div className={cn(
                      "absolute top-0 size-8 flex items-center justify-center rounded-full border",
                      isUser 
                        ? "right-full mr-4 bg-primary text-primary-foreground" 
                        : "left-full ml-4 bg-background border-muted"
                    )}>
                      {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                    </div>
                    
                    <Card 
                      className={cn(
                        "p-4 shadow-sm transition-all duration-200 max-w-[calc(100%-3rem)]",
                        isUser 
                          ? "bg-primary text-primary-foreground shadow-primary/10" 
                          : "bg-card border shadow-muted/10",
                        !isUser && "hover:shadow-md"
                      )}
                    >
                      <div 
                        className={cn(
                          "prose prose-sm max-w-none",
                          isUser ? "prose-invert" : "dark:prose-invert"
                        )}
                        dangerouslySetInnerHTML={{ __html: formatMessageText(messageContent.content) }}
                      />
                      
                      {/* AI message icon indicator */}
                      {!isUser && (
                        <div className="mt-3 pt-3 border-t border-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            <span>AI Assistant</span>
                          </div>
                          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </Card>
                    
                    {/* Branch creation button */}
                    {activeMessage === message.id && !isUser && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute -left-12 top-1/2 -translate-y-1/2 size-8 p-0 rounded-full shadow-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handleBranchClick(message.id)}
                      >
                        <GitBranch className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {isUser && (
                        <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {!isUser && (
                        <Button 
                          variant="ghost" 
                          className="h-6 px-2 text-xs hover:bg-muted rounded-full" 
                          onClick={() => handleBranchClick(message.id)}
                        >
                          <GitBranch className="h-3 w-3 mr-1" /> 
                          Branch here
                        </Button>
                      )}
                    </div>
                  </div>
                );
              } catch (error) {
                console.error('Error rendering message:', error, message);
                return (
                  <div key={message.id} className="p-4 bg-destructive/10 text-destructive rounded-md">
                    Error rendering message. See console for details.
                  </div>
                );
              }
            }

            if (message.type === 'fork') {
              try {
                const forkContent = parseForkContent(message);
                return (
                  <div key={message.id} className="flex items-center gap-2 py-4 relative">
                    <div className="flex-1 h-px bg-primary/20"></div>
                    <div className="px-4 py-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary border-primary/20 border flex items-center gap-1.5">
                      <GitBranch className="h-3 w-3 inline-block relative -top-px" /> 
                      {forkContent.reason}
                    </div>
                    <div className="flex-1 h-px bg-primary/20"></div>
                  </div>
                );
              } catch (error) {
                console.error('Error parsing fork content:', error, message);
                return (
                  <div key={message.id} className="p-4 bg-destructive/10 text-destructive rounded-md">
                    Error rendering fork point. See console for details.
                  </div>
                );
              }
            }

            return null;
          })
          .filter(Boolean)
        }
        
        {/* Loading indicator when waiting for AI */}
        {showLoadingIndicator && (
          <div className="flex justify-center py-4 animate-fadeIn">
            <div className="flex items-center gap-2 text-sm px-4 py-2 bg-muted/30 rounded-full text-muted-foreground">
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full" style={{ animationDelay: '0.2s' }}></div>
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full" style={{ animationDelay: '0.4s' }}></div>
              <span className="ml-2">Waiting for response...</span>
            </div>
          </div>
        )}
        
        {/* Bottom ref for scrolling */}
        <div ref={messagesEndRef} />
      </div>

      {/* Branch creation dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <GitBranch className="h-5 w-5 mr-2" />
              Create New Branch
            </DialogTitle>
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
              autoFocus
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
              className="gap-1.5"
            >
              {creatingBranch ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                  Creating...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4" />
                  Create Branch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 