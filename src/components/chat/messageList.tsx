"use client";

import { useState, useEffect, useRef } from 'react';
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
import * as React from 'react';

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
  const [showBranchMarkers, setShowBranchMarkers] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      
      // Check if we have new messages
      const hasNewMessage = data.length > messages.length;
      
      setMessages(data);
      
      // Trigger animation for new messages only if there are new ones
      if (hasNewMessage) {
        setAnimateIn(true);
        setTimeout(() => setAnimateIn(false), 500);
      }
      
      // Hide loading indicator after getting data
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
      const lastMessage = messages[messages.length - 1];
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
  }, [messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper to format message content with markdown-like styling
  const formatMessageText = (text: string) => {
    if (!text) return '';
    
    // Parse code blocks
    const codeBlockRegex = /```([\s\S]*?)```/g;
    let formattedText = text.replace(codeBlockRegex, (match, codeContent) => {
      return `<div class="bg-muted/80 p-3 rounded-md my-2 overflow-x-auto font-mono text-sm">${codeContent}</div>`;
    });
    
    // Parse inline code
    const inlineCodeRegex = /`([^`]+)`/g;
    formattedText = formattedText.replace(inlineCodeRegex, '<code class="bg-muted/60 px-1.5 py-0.5 rounded font-mono text-sm">$1</code>');
    
    // Parse bullet points
    const bulletRegex = /^- (.*)$/gm;
    formattedText = formattedText.replace(bulletRegex, '<li class="ml-4 mb-1">$1</li>');
    
    // Parse numbered lists
    const numberedRegex = /^(\d+)\. (.*)$/gm;
    formattedText = formattedText.replace(numberedRegex, '<li class="ml-4 mb-1">$2</li>');
    
    // Parse bold text
    const boldRegex = /\*\*([^*]+)\*\*/g;
    formattedText = formattedText.replace(boldRegex, '<strong>$1</strong>');
    
    // Parse italic text
    const italicRegex = /\*([^*]+)\*/g;
    formattedText = formattedText.replace(italicRegex, '<em>$1</em>');
    
    // Convert newlines to paragraphs
    formattedText = formattedText.split('\n\n').map(paragraph => {
      if (paragraph.trim().startsWith('<li') || paragraph.trim().startsWith('<div')) {
        return paragraph;
      }
      return `<p>${paragraph}</p>`;
    }).join('');
    
    return formattedText;
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
        {messages.length > 0 && showBranchMarkers && (
          <div className="absolute left-[calc(50%-1px)] top-0 bottom-0 w-2 pointer-events-none">
            <div 
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-20"
              style={{ background: `linear-gradient(to bottom, transparent, var(--primary) 10%, var(--primary) 90%, transparent)` }}
            ></div>
          </div>
        )}
        
        {messages.map((message, index) => {
          // Skip root nodes as they're not visible messages
          if (message.type === 'root') return null;

          if (message.type === 'message') {
            try {
              const messageContent = message.content as unknown as MessageContent;
              const isUser = messageContent.role === 'user';
              const isLatest = index === messages.length - 1;
              
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
              console.error('Error parsing message content:', error, message);
              return null;
            }
          }

          if (message.type === 'fork') {
            try {
              const forkContent = message.content as unknown as ForkContent;
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
              return null;
            }
          }

          return null;
        })}
        
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