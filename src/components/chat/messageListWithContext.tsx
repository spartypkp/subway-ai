"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, forwardRef, RefObject } from 'react';
import { TimelineNode, Branch, NodeType } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  MessageSquare, 
  GitBranch, 
  User, 
  Bot, 
  Sparkles, 
  Train, 
  ChevronRight, 
  ArrowRight, 
  CornerDownRight,
  ArrowLeft,
  ExternalLink,
  SwitchCamera,
  ChevronDown
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConversation } from '@/lib/contexts/ConversationContext';

interface MessageListProps {
  onMessageSelect?: (messageId: string) => void; // For minimap integration
}

interface BranchPointInfo {
  parentBranchId: string;
  childBranchId: string;
  childBranchName: string | null;
  messageId: string;
  position: number;
  parentBranchColor: string;
  childBranchColor: string;
}

export const MessageListWithContext: React.FC<MessageListProps> = ({ 
  onMessageSelect 
}) => {
  // Get all needed data and functions from the context
  const {
    displayedNodes,
    branches,
    projectId,
    currentBranchId,
    loading,
    streamingContent,
    optimisticMessages,
    getBranchColor,
    getBranchName,
    switchBranch,
    createBranch,
    handleOptimisticUpdate
  } = useConversation();
  
  // Local UI state
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [branchReason, setBranchReason] = useState('');
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const [branchTransitions, setBranchTransitions] = useState<{id: string, fromBranch: string, toBranch: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [scrollToBottomVisible, setScrollToBottomVisible] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [branchPoints, setBranchPoints] = useState<BranchPointInfo[]>([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  
  // New state for subway track segments
  const [trackSegments, setTrackSegments] = useState<Array<{
    id: string;
    startY: number;
    endY: number;
    color: string;
    branchId: string;
  }>>([]);

  // Add a transition flag state
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Show branch switch indicator
  const [showBranchSwitchIndicator, setShowBranchSwitchIndicator] = useState(false);
  const [switchTargetBranchName, setSwitchTargetBranchName] = useState<string | null>(null);

  // Track branch switching specifically
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);
  
  // Calculate branch point information from available nodes and branches
  useEffect(() => {
    if (!displayedNodes.length || !branches.length) return;
    
    // Find all branch points
    const branchPointsInfo: BranchPointInfo[] = [];
    
    // For each branch in the data, find branch connection points
    branches.forEach(branch => {
      // Skip the root branch
      if (!branch.parent_branch_id || !branch.branch_point_node_id) return;
      
      // Find the branch point node
      const branchPointNode = displayedNodes.find(node => node.id === branch.branch_point_node_id);
      if (!branchPointNode) return;
      
      // Find the parent and child branch colors
      const parentBranchColor = getBranchColor(branch.parent_branch_id);
      const childBranchColor = getBranchColor(branch.id);
      
      branchPointsInfo.push({
        parentBranchId: branch.parent_branch_id,
        childBranchId: branch.id,
        childBranchName: branch.name,
        messageId: branch.branch_point_node_id,
        position: branchPointNode.position,
        parentBranchColor,
        childBranchColor
      });
    });
    
    setBranchPoints(branchPointsInfo);
    
    // Also track available branches from the current branch path
    if (currentBranchId) {
      // Find all branches that stem from the current branch
      const childBranches = branches.filter(b => b.parent_branch_id === currentBranchId);
      setAvailableBranches(childBranches);
    } else {
      // If we're on the main branch, find all top-level branches
      const mainBranch = branches.find(b => b.depth === 0);
      if (mainBranch) {
        const childBranches = branches.filter(b => b.parent_branch_id === mainBranch.id);
        setAvailableBranches(childBranches);
      }
    }
  }, [displayedNodes, branches, currentBranchId, getBranchColor]);

  // Setup scroll tracking
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const bottomThreshold = 200; // px from bottom
      
      setScrollToBottomVisible(
        scrollHeight - (scrollTop + clientHeight) > bottomThreshold
      );
    };
    
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Scroll to bottom effect
  useEffect(() => {
    if (!isTransitioning) {
      scrollToBottom();
    }
  }, [displayedNodes.length, isTransitioning, streamingContent]);

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Format message text for display, cleaning up markdown and code blocks
  const formatMessageText = (text: string, isStreaming?: boolean): string => {
    if (!text) return '';
    
    // Replace markdown code blocks with HTML for better display
    let formattedText = text
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Single line code blocks
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    if (isStreaming) {
      // Add a blinking cursor for streaming
      formattedText += '<span class="streaming-cursor">▋</span>';
    }
    
    return formattedText;
  };

  // Determine if a message represents a transition between branches
  const isBranchTransition = (message: TimelineNode, index: number, messages: TimelineNode[]): boolean => {
    if (index === 0) return false;
    
    const prevMessage = messages[index - 1];
    return prevMessage && prevMessage.branch_id !== message.branch_id;
  };

  // Get color for a branch
  const getBranchColorFromId = (branchId: string): string => {
    return getBranchColor(branchId);
  };

  // Get a branch name from ID
  const getBranchNameFromId = (branchId: string): string => {
    return getBranchName(branchId);
  };

  // Get station number for display
  const getStationNumber = (message: TimelineNode, index: number, messages: TimelineNode[]): number => {
    // Count only user and assistant messages before this one in the current branch
    return messages.slice(0, index + 1)
      .filter(m => m.branch_id === message.branch_id && (m.type === 'user-message' || m.type === 'assistant-message'))
      .length;
  };

  // Render subway tracks for visual paths
  const renderSubwayTrack = () => {
    return trackSegments.map(segment => (
      <div 
        key={segment.id}
        className="absolute left-6 w-1 z-0 rounded-full subway-track"
        style={{
          top: segment.startY,
          height: segment.endY - segment.startY,
          backgroundColor: segment.color,
        }}
      />
    ));
  };

  // Handle clicking branch button for a message
  const handleBranchClick = (messageId: string) => {
    console.log('Branch button clicked for message:', messageId);
    setSelectedMessageId(messageId);
    setBranchDialogOpen(true);
  };

  // Find if a message is a branch point with child branches
  const getBranchPointInfo = (messageId: string): BranchPointInfo | undefined => {
    return branchPoints.find(bp => bp.messageId === messageId);
  };

  // Determine if we're viewing a branch that has a parent we can switch back to
  const getCurrentBranchParent = (): Branch | undefined => {
    if (!currentBranchId) return undefined;
    
    const currentBranch = branches.find(b => b.id === currentBranchId);
    if (currentBranch?.parent_branch_id) {
      return branches.find(b => b.id === currentBranch.parent_branch_id);
    }
    return undefined;
  };

  // Enhanced branch switching function
  const handleSwitchBranch = (targetBranchId: string | undefined) => {
    if (!targetBranchId) return;
    
    console.log('Switching to branch:', targetBranchId);
    
    // Prevent switching to the same branch
    if (targetBranchId === currentBranchId) {
      console.log('Already on branch:', targetBranchId);
      return;
    }
    
    // Before switching, update the UI to show a transitioning state
    setIsTransitioning(true);
    setIsSwitchingBranch(true);
    
    // Call context's switchBranch function
    switchBranch(targetBranchId);
    
    // Reset transition state after a short delay
    setTimeout(() => {
      setIsTransitioning(false);
      setIsSwitchingBranch(false);
    }, 600);
  };

  // Create a new branch from the selected message
  const handleCreateBranch = async () => {
    if (!selectedMessageId) return;
    
    setCreatingBranch(true);
    try {
      // Use the context's createBranch function
      const newBranchId = await createBranch({
        branchPointNodeId: selectedMessageId,
        name: branchReason || undefined
      });
      
      setBranchDialogOpen(false);
      setBranchReason('');
      
      // Optionally switch to the new branch
      handleSwitchBranch(newBranchId);
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setCreatingBranch(false);
    }
  };

  // Handle clicking on a message for minimap integration
  const handleMessageSelect = (messageId: string) => {
    if (onMessageSelect) {
      onMessageSelect(messageId);
    }
  };

  // Add a function to determine which branch to switch to at a branch point
  const getBranchSwitchTarget = (branchPointInfo: BranchPointInfo, currentBranchId: string | null): { branchId: string, branchName: string | null, branchColor: string } => {
    // If we're currently on the parent branch, switch to the child branch
    if (currentBranchId === branchPointInfo.parentBranchId) {
      return {
        branchId: branchPointInfo.childBranchId,
        branchName: branchPointInfo.childBranchName,
        branchColor: branchPointInfo.childBranchColor
      };
    }
    
    // If we're on the child branch or any other branch, switch to parent
    return {
      branchId: branchPointInfo.parentBranchId,
      branchName: getBranchNameFromId(branchPointInfo.parentBranchId),
      branchColor: branchPointInfo.parentBranchColor
    };
  };

  // Loading state
  if (loading && !displayedNodes.length) {
    return (
      <div className="flex flex-col h-full space-y-4 p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-24 rounded-lg border border-border p-4 animate-pulse">
          <MessageSquare className="h-6 w-6 text-primary/30 mr-2" />
          <div className="h-4 bg-muted rounded w-1/3"></div>
        </div>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-muted"></div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </div>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-muted"></div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!displayedNodes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Messages</h3>
        <p className="text-muted-foreground mt-2">Start a conversation to see messages here.</p>
      </div>
    );
  }

  // Render the message list
  return (
    <div className="relative flex flex-col h-full bg-background">
      {/* Branch dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              This will create a new conversation branch from this point. You can give it a name to help identify it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name (Optional)</Label>
              <Input
                id="branch-name"
                placeholder="e.g., Alternative approach"
                value={branchReason}
                onChange={(e) => setBranchReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateBranch} 
              disabled={creatingBranch}
            >
              {creatingBranch ? 'Creating...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Message container */}
      <div 
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-6",
          isTransitioning ? "opacity-70 transition-opacity duration-300" : ""
        )}
      >
        {/* Render subway track segments */}
        {renderSubwayTrack()}
        
        {/* Messages */}
        {displayedNodes.map((message, index) => {
          // Skip root and branch-root messages
          if (message.type === 'root' || message.type === 'branch-root') {
            return null;
          }
          
          const isUserMessage = message.type === 'user-message';
          const isAiMessage = message.type === 'assistant-message';
          const isBranchPoint = message.type === 'branch-point';
          
          // Check if this is a branch transition point
          const isTransition = isBranchTransition(message, index, displayedNodes);
          const branchColor = getBranchColorFromId(message.branch_id);
          const branchName = getBranchNameFromId(message.branch_id);
          
          // Determine if this message has child branches
          const branchPointInfo = getBranchPointInfo(message.id);
          const hasChildBranches = !!branchPointInfo;
          
          // Get content from streaming if this is the last assistant message
          let messageContent = message.message_text || '';
          const isLastAssistantMessage = isAiMessage && 
                                        index === displayedNodes.length - 1 && 
                                        message.branch_id === currentBranchId;
                                        
          const isStreaming = isLastAssistantMessage && !!streamingContent;
          
          if (isStreaming) {
            messageContent = streamingContent || '';
          }
          
          // Check if this is an optimistic message
          const isOptimistic = message.optimistic;
          const isLoading = isOptimistic && message.isLoading;
          
          // Get station number for this message
          const stationNumber = getStationNumber(message, index, displayedNodes);
          
          return (
            <React.Fragment key={message.id}>
              {/* Branch transition indicator */}
              {isTransition && (
                <div className="relative flex items-center my-6 animate-fadeIn">
                  <div className="h-px flex-1 bg-border"></div>
                  <div 
                    className="flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${branchColor}20`, color: branchColor }}
                  >
                    <GitBranch size={12} className="mr-1" />
                    <span>{branchName || 'Branch'}</span>
                  </div>
                  <div className="h-px flex-1 bg-border"></div>
                </div>
              )}
              
              {/* Branch point switch button */}
              {hasChildBranches && (
                <div className="flex justify-center my-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex items-center gap-1.5"
                          onClick={() => {
                            if (branchPointInfo) {
                              const target = getBranchSwitchTarget(branchPointInfo, currentBranchId);
                              setSwitchTargetBranchName(target.branchName);
                              setShowBranchSwitchIndicator(true);
                              
                              // Schedule the actual branch switch
                              setTimeout(() => {
                                handleSwitchBranch(target.branchId);
                                setShowBranchSwitchIndicator(false);
                              }, 200);
                            }
                          }}
                        >
                          <SwitchCamera size={14} className="mr-1" /> 
                          Switch to {
                            branchPointInfo && currentBranchId === branchPointInfo.parentBranchId 
                              ? (branchPointInfo.childBranchName || 'branch') 
                              : 'parent branch'
                          }
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Switch to {
                          branchPointInfo && currentBranchId === branchPointInfo.parentBranchId 
                            ? `${branchPointInfo.childBranchName || 'alternative branch'}`
                            : 'parent branch'
                        }</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
              
              {/* Message */}
              <div 
                className={cn(
                  "grid grid-cols-[auto_1fr] message-container",
                  message.id === activeMessage ? "message-highlight" : ""
                )}
                id={`message-${message.id}`}
                onClick={() => handleMessageSelect(message.id)}
              >
                {/* Branch icon + Metadata */}
                <div className="flex flex-col items-center mr-4">
                  {/* Branch station UI */}
                  <div 
                    className={cn(
                      "relative flex items-center justify-center w-12 h-12 rounded-full subway-station bg-white hover:scale-110 transition-transform",
                      isTransition || index === 0 ? "first-station" : ""
                    )}
                    style={{ 
                      border: `3px solid ${branchColor}`, 
                      color: branchColor,
                      boxShadow: `0 0 8px 0 ${branchColor}40` 
                    }}
                  >
                    {isUserMessage && <User className="h-5 w-5" />}
                    {isAiMessage && <Bot className="h-5 w-5" />}
                    {isBranchPoint && <GitBranch className="h-5 w-5" />}
                    
                    {/* Station number */}
                    {(isUserMessage || isAiMessage) && (
                      <div 
                        className="absolute -top-2 -left-2 text-[10px] font-bold bg-white rounded-full w-5 h-5 flex items-center justify-center"
                        style={{ 
                          border: `2px solid ${branchColor}`, 
                          color: branchColor 
                        }}
                      >
                        {stationNumber}
                      </div>
                    )}
                    
                    {/* Branch indicator for branch points */}
                    {hasChildBranches && (
                      <div 
                        className="absolute -bottom-1 -right-1 rounded-full w-5 h-5 flex items-center justify-center bg-white"
                        style={{ 
                          border: `2px solid ${branchPointInfo?.childBranchColor || branchColor}`, 
                          color: branchPointInfo?.childBranchColor || branchColor
                        }}
                      >
                        <GitBranch className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  
                  {/* Message timestamp */}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                {/* Message card */}
                <Card
                  className={cn(
                    "p-4 transition-all duration-300 hover:shadow-md message-card",
                    message.id === activeMessage ? "ring-2 ring-ring" : "",
                    isUserMessage ? "bg-muted/50" : "bg-card",
                    isOptimistic ? "opacity-80" : "opacity-100",
                    isLoading ? "animate-pulse" : ""
                  )}
                  style={{
                    borderLeft: `3px solid ${branchColor}`
                  }}
                >
                  {/* Message header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="font-semibold text-sm">
                        {isUserMessage ? 'You' : 'Assistant'}
                      </div>
                      
                      {/* Branch pill */}
                      <div 
                        className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: `${branchColor}20`, color: branchColor }}
                      >
                        {branchName || 'Branch'}
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {/* Branch from message button - only for AI messages */}
                      {isAiMessage && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBranchClick(message.id);
                                }}
                              >
                                <GitBranch className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Create branch from this message</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                  
                  {/* Message content */}
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: formatMessageText(messageContent, isStreaming) 
                    }} 
                  />
                  
                  {/* Show loading indicator for streaming messages */}
                  {isLoading && (
                    <div className="mt-2 flex items-center text-muted-foreground text-xs gap-2">
                      <div className="loading-dots">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                      </div>
                      Generating response...
                    </div>
                  )}
                </Card>
              </div>
            </React.Fragment>
          );
        })}
        
        {/* Invisible element for scrolling to the end */}
        <div ref={messagesEndRef} className="h-1" />
      </div>
      
      {/* Scroll to bottom button */}
      {scrollToBottomVisible && (
        <button 
          className="absolute bottom-6 right-6 p-2 rounded-full bg-primary text-primary-foreground shadow-lg opacity-80 hover:opacity-100 transition-opacity"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}; 