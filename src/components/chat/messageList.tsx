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
  const [filteredMessages, setFilteredMessages] = useState<TimelineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [branchReason, setBranchReason] = useState('');
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [showBranchMarkers, setShowBranchMarkers] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add component lifecycle debugging
  useEffect(() => {
    console.log('🔧 DEBUG: MessageList mounted with projectId:', projectId, 'branchId:', branchId);
    return () => console.log('🔧 DEBUG: MessageList unmounted');
  }, [projectId, branchId]);

  // Function to fetch messages
  const fetchMessages = async () => {
    console.log('🔧 DEBUG: fetchMessages called with projectId:', projectId, 'branchId:', branchId);
    setLoading(true);
    try {
      // Always fetch the complete conversation tree
      let url = `/api/nodes?project_id=${projectId}&complete_tree=true`;
      
      console.log('🔧 DEBUG: Fetching messages from:', url);
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`🔧 DEBUG: Received ${data.length} messages:`, data);
      
      // Enhanced logging - log each message type and content
      data.forEach((msg: TimelineNode, index: number) => {
        console.log(`🔧 DEBUG: Message ${index}: type=${msg.type}, id=${msg.id}, created_at=${msg.created_at}, parent_id=${msg.parent_id}`);
        console.log(`🔧 DEBUG: Content type: ${typeof msg.content}`);
        if (typeof msg.content === 'object') {
          console.log('🔧 DEBUG: Content keys:', Object.keys(msg.content));
        }
        console.log('🔧 DEBUG: Content:', msg.content);
      });
      
      // Check relationship chain
      console.log('🔧 DEBUG: Message parent-child relationships:');
      const nodeMap = new Map();
      data.forEach((node: TimelineNode) => nodeMap.set(node.id, node));
      data.forEach((node: TimelineNode) => {
        if (node.parent_id) {
          const parent = nodeMap.get(node.parent_id);
          if (parent) {
            console.log(`🔧 DEBUG: Node ${node.id} (${node.type}) -> Parent ${parent.id} (${parent.type})`);
          } else {
            console.log(`🔧 DEBUG: Node ${node.id} has parent_id ${node.parent_id} but parent not found`);
          }
        } else {
          console.log(`🔧 DEBUG: Node ${node.id} (${node.type}) has no parent (root node)`);
        }
      });
      
      // Store all messages
      setMessages(data);
      
      // Hide loading indicator after getting data
      setShowLoadingIndicator(false);
    } catch (error) {
      console.error('🔧 DEBUG: Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter messages based on the selected branch
  useEffect(() => {
    if (!messages.length) return;
    
    console.log('🔧 DEBUG: Filtering messages for branch:', branchId);
    
    if (!branchId) {
      // If no branch is selected, show all messages
      console.log('🔧 DEBUG: No branch selected, showing all messages');
      setFilteredMessages(messages);
      return;
    }
    
    // Create a map of all nodes for easy lookup
    const nodeMap = new Map();
    messages.forEach(node => nodeMap.set(node.id, node));
    
    // Find the selected branch node
    const selectedBranchNode = messages.find(node => node.branch_id === branchId);
    if (!selectedBranchNode) {
      console.log('🔧 DEBUG: Selected branch node not found, showing all messages');
      setFilteredMessages(messages);
      return;
    }
    
    console.log('🔧 DEBUG: Selected branch node:', selectedBranchNode);
    
    // Collect all nodes in the current branch
    const branchNodes = messages.filter(node => node.branch_id === branchId);
    console.log(`🔧 DEBUG: Found ${branchNodes.length} nodes in the selected branch`);
    
    // Collect parent branch nodes by traversing up the tree
    const relevantNodes = new Set<string>();
    
    // Add all nodes from the current branch
    branchNodes.forEach(node => relevantNodes.add(node.id));
    
    // Function to recursively add parent nodes
    const addParentNodes = (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      
      // Add this node
      relevantNodes.add(node.id);
      
      // If this node has a parent, add the parent and its ancestors
      if (node.parent_id) {
        const parentNode = nodeMap.get(node.parent_id);
        if (parentNode) {
          relevantNodes.add(parentNode.id);
          addParentNodes(parentNode.id);
        }
      }
    };
    
    // Start with the first node in the branch and add all its parents
    if (branchNodes.length > 0) {
      const firstNode = branchNodes[0];
      if (firstNode.parent_id) {
        addParentNodes(firstNode.parent_id);
      }
    }
    
    console.log(`🔧 DEBUG: Found ${relevantNodes.size} relevant nodes for the branch`);
    
    // Filter messages to only include nodes in the current branch and its parent branches
    const filtered = messages.filter(node => relevantNodes.has(node.id));
    console.log(`🔧 DEBUG: Filtered to ${filtered.length} messages`);
    
    // Sort by creation time to maintain chronological order
    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    setFilteredMessages(filtered);
    
    // Check if we have new messages
    const hasNewMessage = filtered.length > filteredMessages.length;
    console.log(`🔧 DEBUG: hasNewMessage=${hasNewMessage}, previous count=${filteredMessages.length}, new count=${filtered.length}`);
    
    // Trigger animation for new messages only if there are new ones
    if (hasNewMessage) {
      console.log('🔧 DEBUG: Triggering new message animation');
      setAnimateIn(true);
      setTimeout(() => setAnimateIn(false), 500);
    }
  }, [messages, branchId]);

  // Fetch messages when project changes
  useEffect(() => {
    fetchMessages();
  }, [projectId]);
  
  // Poll for updates when lastUpdateTime changes
  useEffect(() => {
    const doFetch = async () => {
      await fetchMessages();
    };
    doFetch();
  }, [lastUpdateTime]);

  // Poll for new messages every 2 seconds when sending is happening
  useEffect(() => {
    const interval = setInterval(() => {
      // Only update if the last message is from the user
      const lastMessage = filteredMessages[filteredMessages.length - 1];
      if (lastMessage && lastMessage.type === 'message') {
        try {
          const content = lastMessage.content as unknown as MessageContent;
          if (content.role === 'user') {
            setShowLoadingIndicator(true);
            setLastUpdateTime(Date.now());
          }
        } catch (error) {
          console.error('Error parsing message content:', error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [filteredMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  // Enhance the message content parsing with more detailed logging 
  const parseMessageContent = (content: any): MessageContent => {
    console.log('🔧 DEBUG: Parsing content:', content, 'Type:', typeof content);
    
    try {
      // Handle null or undefined content
      if (content === null || content === undefined) {
        console.warn('🔧 DEBUG: Received null or undefined content');
        return { text: '', role: 'assistant' };
      }
      
      // Handle if content is already an object with the expected structure
      if (typeof content === 'object' && content !== null) {
        // Log the keys to help debug
        console.log('🔧 DEBUG: Content object keys:', Object.keys(content));
        
        // Check if the object already has the expected structure
        if ('text' in content && 'role' in content) {
          console.log('🔧 DEBUG: Content already has correct structure with role:', content.role);
          console.log('🔧 DEBUG: Text preview:', content.text.substring(0, 30) + '...');
          return {
            text: content.text || '',
            role: content.role || 'assistant'
          };
        } 
        
        // Handle case where content is an object but doesn't have expected structure
        console.warn('🔧 DEBUG: Content is an object but missing expected fields');
        return { 
          text: JSON.stringify(content),
          role: 'assistant'
        };
      }
      
      // Handle string content
      if (typeof content === 'string') {
        console.log('🔧 DEBUG: Content is a string, attempting to parse as JSON');
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(content);
          
          // If parsed successfully and has the right structure, use it
          if (typeof parsed === 'object' && parsed !== null) {
            if ('text' in parsed && 'role' in parsed) {
              console.log('🔧 DEBUG: Successfully parsed string to message content');
              return {
                text: parsed.text || '',
                role: parsed.role || 'assistant'
              };
            }
          }
          
          // If parsed but doesn't have the right structure
          console.warn('🔧 DEBUG: Parsed string to object but missing expected fields');
          return {
            text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
            role: 'assistant'
          };
        } catch (e) {
          // If not valid JSON, treat as plain text
          console.log('🔧 DEBUG: String is not valid JSON, treating as plain text');
          return {
            text: content,
            role: 'assistant'
          };
        }
      }
      
      // Fallback for any other type
      console.warn('🔧 DEBUG: Unhandled content type:', typeof content);
      return {
        text: String(content),
        role: 'assistant'
      };
    } catch (error) {
      console.error('🔧 DEBUG: Error parsing message content:', error);
      return { text: 'Error parsing message', role: 'assistant' };
    }
  };

  // Format message text with simple markdown-like formatting
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
    console.log('🔧 DEBUG: Branch button clicked for message:', messageId);
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
        {/* Branch line visualization - only show if we have messages */}
        {filteredMessages.length > 0 && showBranchMarkers && (
          <div className="absolute left-[calc(50%-1px)] top-0 bottom-0 w-2 pointer-events-none">
            <div 
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-20"
              style={{ background: `linear-gradient(to bottom, transparent, var(--primary) 10%, var(--primary) 90%, transparent)` }}
            ></div>
          </div>
        )}
        
        {filteredMessages
          .map((message, index) => {
            // Skip root nodes as they're not visible messages
            if (message.type === 'root') {
              console.log(`🔧 DEBUG: Skipping root node: ${message.id}`);
              return null;
            }

            if (message.type === 'message') {
              try {
                console.log(`🔧 DEBUG: Rendering message node: ${message.id}, index: ${index}`);
                // Use the improved parsing function
                const messageContent = parseMessageContent(message.content);
                console.log('🔧 DEBUG: Parsed content:', messageContent);
                const isUser = messageContent.role === 'user';
                console.log(`🔧 DEBUG: Message is from ${isUser ? 'user' : 'assistant'}`);
                const isLatest = index === filteredMessages.length - 1;
                
                // Add a unique data attribute for debugging
                const debugId = `message-${message.id.substring(0, 8)}`;
                
                return (
                  <div 
                    key={message.id} 
                    className={cn(
                      "group relative",
                      isUser ? "ml-12" : "mr-12",
                      isLatest && animateIn && "animate-slideIn"
                    )}
                    onMouseEnter={() => setActiveMessage(message.id)}
                    onMouseLeave={() => setActiveMessage(null)}
                    data-debug-id={debugId}
                  >
                    {/* Connection to branch line */}
                    {showBranchMarkers && (
                      <div className={cn(
                        "absolute top-1/2 w-8 h-0.5 bg-primary opacity-20",
                        isUser ? "right-full" : "left-full"
                      )}></div>
                    )}
                    
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
                        dangerouslySetInnerHTML={{ __html: formatMessageText(messageContent.text) }}
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
                console.error('🔧 DEBUG: Error rendering message:', error, message);
                return (
                  <div key={message.id} className="p-4 bg-destructive/10 text-destructive rounded-md">
                    Error rendering message. See console for details.
                  </div>
                );
              }
            }

            if (message.type === 'fork') {
              try {
                console.log(`🔧 DEBUG: Rendering fork node: ${message.id}`);
                const forkContent = message.content as unknown as ForkContent;
                console.log('🔧 DEBUG: Fork reason:', forkContent.reason);
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
                console.error('🔧 DEBUG: Error parsing fork content:', error, message);
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