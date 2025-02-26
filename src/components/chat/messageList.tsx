"use client";

import React, { useState, useEffect, useRef } from 'react';
import { TimelineNode, Branch, NodeType } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageSquare, GitBranch, User, Bot, Sparkles, ArrowDown } from 'lucide-react';
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

export function MessageList({ projectId, branchId, onBranchCreated }: MessageListProps) {
  const [allMessages, setAllMessages] = useState<TimelineNode[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [branchReason, setBranchReason] = useState('');
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const [branchTransitions, setBranchTransitions] = useState<{id: string, fromBranch: string, toBranch: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build a path from root to the current branch node
  const buildMessagePath = (messages: TimelineNode[], branches: Branch[], targetBranchId: string | null): TimelineNode[] => {
    if (!messages.length) return [];

    // If no specific branch is selected, show messages from the main branch
    if (!targetBranchId) {
      // Find the root node
      const rootNode = messages.find(m => m.type === 'root');
      if (!rootNode) return [];
      
      const mainBranchId = rootNode.branch_id;
      return messages
        .filter(m => m.branch_id === mainBranchId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    
    // If a specific branch is selected, build the full path from root to the current branch
    const result: TimelineNode[] = [];
    const branchTransitionsMap: {[id: string]: {fromBranch: string, toBranch: string}} = {};
    
    // First, find all nodes in the target branch
    const branchMessages = messages
      .filter(m => m.branch_id === targetBranchId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    if (!branchMessages.length) return [];
    
    // Find the branch in our branches list
    const currentBranch = branches.find(b => b.id === targetBranchId);
    if (!currentBranch) return branchMessages;
    
    // If this branch has a parent branch, we need to include messages from the parent branch
    if (currentBranch.parent_branch_id) {
      // Find the branch point node
      const branchPointNode = messages.find(m => m.id === currentBranch.branch_point_node_id);
      
      if (branchPointNode) {
        branchTransitionsMap[branchPointNode.id] = {
          fromBranch: currentBranch.parent_branch_id,
          toBranch: targetBranchId
        };
        
        // Recursively build the parent branch path up to the branch point
        const parentPath = buildMessagePath(messages, branches, currentBranch.parent_branch_id);
        
        // Only include parent messages up to the branch point
        const branchPointIndex = parentPath.findIndex(m => m.id === branchPointNode.id);
        if (branchPointIndex !== -1) {
          result.push(...parentPath.slice(0, branchPointIndex + 1));
        }
      }
    }
    
    // Add the branch messages to the result, excluding the branch-root node
    result.push(...branchMessages.filter(m => m.type !== 'branch-root'));
    
    // Update branch transitions for UI
    setBranchTransitions(
      Object.entries(branchTransitionsMap).map(([id, {fromBranch, toBranch}]) => ({
        id,
        fromBranch,
        toBranch
      }))
    );
    
    return result
      .filter((m, i, arr) => arr.findIndex(n => n.id === m.id) === i) // Remove duplicates
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  // Get messages to display based on the current branch
  const displayedMessages = React.useMemo(() => {
    return buildMessagePath(allMessages, branches, branchId);
  }, [allMessages, branches, branchId]);

  // Function to fetch messages
  const fetchMessages = async () => {
    console.log('Fetching messages for project:', projectId, 'branch:', branchId || 'main');
    setLoading(true);
    try {
      // Fetch all branches for the project
      const branchesResponse = await fetch(`/api/projects/${projectId}/branches`);
      if (!branchesResponse.ok) {
        throw new Error(`Failed to fetch branches: ${branchesResponse.status}`);
      }
      const branchesData = await branchesResponse.json();
      setBranches(branchesData);
      
      // Always fetch the complete tree to get all messages, including branch paths
      const url = `/api/nodes?project_id=${projectId}&complete_tree=true`;
      
      console.log('Fetching from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.length} messages`);
      
      // Store all messages
      setAllMessages(data);
      
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
      const lastMessage = displayedMessages[displayedMessages.length - 1];
      if (lastMessage && (lastMessage.type === 'user-message')) {
        setShowLoadingIndicator(true);
        fetchMessages();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [displayedMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages]);

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

  // Check if a message is at a branch transition
  const isBranchTransition = (message: TimelineNode, index: number, messages: TimelineNode[]): boolean => {
    if (index === 0) return false;
    
    const prevMessage = messages[index - 1];
    return prevMessage && prevMessage.branch_id !== message.branch_id;
  };

  // Get branch color based on branch ID or from branch data
  const getBranchColor = (branchId: string): string => {
    // First check if we have this branch in our branches list
    const branch = branches.find(b => b.id === branchId);
    if (branch && branch.color) {
      return branch.color;
    }
    
    // Fallback colors if branch not found or has no color
    const colors = [
      '#3b82f6', // blue-500 (main line)
      '#ef4444', // red-500
      '#10b981', // emerald-500
      '#f59e0b', // amber-500
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
      '#06b6d4', // cyan-500
      '#84cc16', // lime-500
    ];
    
    // Simple hash of branchId to pick a color
    const hash = branchId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return colors[hash % colors.length];
  };

  if (loading && allMessages.length === 0) {
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

  if (allMessages.length === 0) {
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
      // Find the message and its branch
      const message = allMessages.find(m => m.id === selectedMessageId);
      if (!message) throw new Error('Selected message not found');
      
      const response = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          parent_branch_id: message.branch_id,
          branch_point_node_id: selectedMessageId,
          name: branchReason || undefined,
          created_by: 'user' // You might want to get this from auth context
        })
      });
      
      if (!response.ok) throw new Error('Failed to create branch');
      
      const result = await response.json();
      onBranchCreated(result.id);
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
      <div className="flex flex-col gap-4 max-w-3xl mx-auto p-4 pb-32">
        {/* Branch line visualization */}
        <div className="absolute left-[calc(50%-1px)] top-0 bottom-0 w-2 pointer-events-none">
          <div 
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-20"
            style={{ background: `linear-gradient(to bottom, transparent, var(--primary) 10%, var(--primary) 90%, transparent)` }}
          ></div>
        </div>
        
        {displayedMessages
          .map((message, index) => {
            // Skip root nodes as they're not visible messages
            if (message.type === 'root' || message.type === 'branch-root') {
              return null;
            }

            // Display branch transition indicator
            const isBranchChange = isBranchTransition(message, index, displayedMessages);
            if (isBranchChange) {
              const prevBranchId = displayedMessages[index - 1].branch_id;
              const currentBranchId = message.branch_id;
              const prevBranchColor = getBranchColor(prevBranchId);
              const currentBranchColor = getBranchColor(currentBranchId);
              
              // Find the branch to get its name
              const currentBranch = branches.find(b => b.id === currentBranchId);
              const branchName = currentBranch?.name || 'Branch continuation';
              
              return (
                <div key={`transition-${message.id}`} className="relative my-8">
                  {/* Branch transition visualization */}
                  <div className="flex items-center gap-2 py-4 relative">
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${prevBranchColor}, ${currentBranchColor})` }}></div>
                    <div 
                      className="px-4 py-2 text-sm font-medium rounded-full border flex items-center gap-2"
                      style={{ 
                        backgroundColor: `${currentBranchColor}20`, 
                        borderColor: currentBranchColor,
                        color: currentBranchColor
                      }}
                    >
                      <GitBranch className="h-4 w-4" /> 
                      {branchName}
                    </div>
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${currentBranchColor}, ${prevBranchColor})` }}></div>
                  </div>
                  
                  {/* Line connection visualization */}
                  <div className="absolute left-1/2 -top-12 bottom-0 w-0.5" style={{ background: `linear-gradient(to bottom, ${prevBranchColor}, ${currentBranchColor})` }}></div>
                </div>
              );
            }

            if (message.type === 'user-message' || message.type === 'assistant-message') {
              const isUser = message.type === 'user-message';
              const messageText = message.message_text || '';
              
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
                  {/* Connection to branch line - color based on branch */}
                  <div 
                    className={cn(
                      "absolute top-1/2 w-8 h-0.5 opacity-70",
                      isUser ? "right-full" : "left-full"
                    )}
                    style={{ backgroundColor: getBranchColor(message.branch_id) }}
                  ></div>
                  
                  {/* Avatar */}
                  <div 
                    className={cn(
                      "absolute top-0 size-8 flex items-center justify-center rounded-full border",
                      isUser 
                        ? "right-full mr-4 text-primary-foreground" 
                        : "left-full ml-4 bg-background border-muted"
                    )}
                    style={isUser ? { backgroundColor: getBranchColor(message.branch_id) } : {}}
                  >
                    {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                  </div>
                  
                  <Card 
                    className={cn(
                      "p-4 shadow-sm transition-all duration-200 max-w-[calc(100%-3rem)]",
                      isUser 
                        ? "text-primary-foreground shadow-primary/10" 
                        : "bg-card border shadow-muted/10",
                      !isUser && "hover:shadow-md"
                    )}
                    style={isUser ? { backgroundColor: getBranchColor(message.branch_id) } : {}}
                  >
                    <div 
                      className={cn(
                        "prose prose-sm max-w-none",
                        isUser ? "prose-invert" : "dark:prose-invert"
                      )}
                      dangerouslySetInnerHTML={{ __html: formatMessageText(messageText) }}
                    />
                    
                    {/* AI message footer */}
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
            }

            if (message.type === 'branch-point') {
              // Find the branch that has this node as its branch point
              const childBranch = branches.find(b => b.branch_point_node_id === message.id);
              const branchName = childBranch?.name || 'Branch point';
              const branchColor = getBranchColor(message.branch_id);
              
              return (
                <div key={message.id} className="flex items-center gap-2 py-4 relative">
                  <div className="flex-1 h-px bg-primary/20"></div>
                  <div 
                    className="px-4 py-1.5 text-xs font-medium rounded-full border flex items-center gap-1.5"
                    style={{ 
                      backgroundColor: `${branchColor}20`, 
                      borderColor: branchColor,
                      color: branchColor
                    }}
                  >
                    <GitBranch className="h-3 w-3 inline-block relative -top-px" /> 
                    {branchName}
                  </div>
                  <div className="flex-1 h-px bg-primary/20"></div>
                </div>
              );
            }

            return null;
          })}
        
        {/* Loading indicator for new messages */}
        {showLoadingIndicator && (
          <div className="flex justify-center py-4">
            <div className="animate-pulse flex gap-1">
              <div className="bg-primary/30 rounded-full h-2 w-2"></div>
              <div className="bg-primary/30 rounded-full h-2 w-2 animate-delay-200"></div>
              <div className="bg-primary/30 rounded-full h-2 w-2 animate-delay-400"></div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Branch creation dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new branch</DialogTitle>
            <DialogDescription>
              Create a new conversation branch from this point. This allows you to explore a different direction without losing the original conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-reason">Branch name (optional)</Label>
              <Input
                id="branch-reason"
                placeholder="e.g., Alternative approach, What-if scenario"
                value={branchReason}
                onChange={(e) => setBranchReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={createBranch} 
              disabled={creatingBranch}
              className="gap-1"
            >
              {creatingBranch ? (
                <>Creating<span className="animate-pulse">...</span></>
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-1" />
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