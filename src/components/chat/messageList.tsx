"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, forwardRef, useImperativeHandle, RefObject } from 'react';
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
  SwitchCamera
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

/**
 * MessageList Component
 * 
 * Displays conversation threads as a message list with branch visualization.
 * Uses ConversationContext for data fetching, state management, and layout calculations.
 */
interface MessageListProps {
  onBranchCreated?: (newBranchId: string) => void;
  onBranchSwitch?: (branchId: string) => void;
  onMessageSelect?: (messageId: string) => void;
}

// Define the ref type
export interface MessageListRef {
  updateMessageState: (params: {
    action: 'create' | 'update' | 'stream' | 'error';
    userMessage?: string;
    parentId?: string;
    streamContent?: string;
    messageId?: string;
    errorMessage?: string;
  }) => void;
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

// Use forwardRef to create the component
export const MessageList = forwardRef<MessageListRef, MessageListProps>(({ 
  onBranchCreated, 
  onBranchSwitch, 
  onMessageSelect
}, ref) => {
  // Get data and functions from ConversationContext
  const {
    projectId,
    currentBranchId,
    branches,
    displayedNodes,
    allNodes,
    loading,
    optimisticMessages,
    streamingContent,
    streamingMessageId,
    fetchData,
    switchBranch,
    createBranch: contextCreateBranch,
    getBranchColor,
    getBranchName,
    updateMessageState,
    updateStreamingContent
  } = useConversation();

  // Local UI state
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [branchReason, setBranchReason] = useState('');
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [creatingBranch, setCreatingBranch] = useState(false);
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
    type: 'main' | 'branch' | 'highlight';
    dashed?: boolean;
    branch_id?: string;
  }>>([]);
  
  // Expose methods via ref - updated to use the updateMessageState method
  useImperativeHandle(ref, () => ({
    // Delegate to the context's updateMessageState
    updateMessageState: (params) => {
      updateMessageState(params);
    }
  }));

  // Set up initial data fetching from context
  useEffect(() => {
    // Initial data fetch if needed
    if (projectId && (!displayedNodes.length || displayedNodes.length === 0)) {
      fetchData();
    }
  }, [projectId, displayedNodes.length, fetchData]);

  // Add branch point info - this still needs context data but has UI-specific logic
  useEffect(() => {
    // Skip if we don't have data yet
    if (!branches.length || !allNodes.length) return;
    
    // Find all branch points
    const points: BranchPointInfo[] = [];
    
    branches.forEach(branch => {
      if (branch.parent_branch_id && branch.branch_point_node_id) {
        // Find parent branch
        const parentBranch = branches.find(b => b.id === branch.parent_branch_id);
        if (!parentBranch) return;
        
        // Find the branch point message
        const branchPointMessage = allNodes.find(m => m.id === branch.branch_point_node_id);
        if (!branchPointMessage) return;
        
        points.push({
          parentBranchId: branch.parent_branch_id,
          childBranchId: branch.id,
          childBranchName: branch.name,
          messageId: branch.branch_point_node_id,
          position: branchPointMessage.position,
          parentBranchColor: getBranchColor(branch.parent_branch_id),
          childBranchColor: getBranchColor(branch.id)
        });
      }
    });
    
    setBranchPoints(points);
    
    // Calculate branch transitions for UI
    const transitions: {id: string, fromBranch: string, toBranch: string}[] = [];
    
    points.forEach(point => {
      transitions.push({
        id: point.messageId,
        fromBranch: point.parentBranchId,
        toBranch: point.childBranchId
      });
    });
    
    setBranchTransitions(transitions);
    
    // Find available branches for the current branch
    if (currentBranchId) {
      const availableBranches = branches.filter(branch => 
        branch.parent_branch_id === currentBranchId ||
        (branch.id === currentBranchId && branch.parent_branch_id)
      );
      
      setAvailableBranches(availableBranches);
    }
  }, [branches, allNodes, currentBranchId, getBranchColor]);

  // Format message text with markdown-like formatting - enhanced to handle streaming state
  const formatMessageText = (text: string, isStreaming?: boolean): string => {
    if (!text) return '';
    
    // If message is currently streaming, add a blinking cursor
    let formatted = text;
    if (isStreaming) {
      formatted += '<span class="animate-cursor">▋</span>';
    }
    
    // Replace newlines with <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Bold: **text** -> <strong>text</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text* -> <em>text</em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code: `text` -> <code>text</code>
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    
    return formatted;
  };

  // Update the isBranchTransition function to be smarter about transitions
  const isBranchTransition = (message: TimelineNode, index: number, messages: TimelineNode[]): boolean => {
    if (index === 0) return false;
    
    const prevMessage = messages[index - 1];
    
    // If we've switched from one branch to another, and this isn't a duplicate branch point
    return prevMessage && 
           prevMessage.branch_id !== message.branch_id && 
           !branchTransitions.some(transition => 
             transition.toBranch === message.branch_id && 
             transition.id === prevMessage.id);
  };

  // Get message station number (position in the conversation)
  const getStationNumber = (message: TimelineNode, index: number, messages: TimelineNode[]): number => {
    // Count only user and assistant messages
    return messages.slice(0, index + 1).filter(
      m => m.type === 'user-message' || m.type === 'assistant-message'
    ).length;
  };

  // Add function to render the unified subway track
  const renderSubwayTrack = () => {
    return (
      <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-4 pointer-events-none z-0">
        {trackSegments.map(segment => (
          <div 
            key={segment.id}
            className={`absolute w-2.5 rounded-full ${segment.type === 'highlight' ? 'transition-all duration-500' : ''}`}
            style={{
              background: segment.color,
              boxShadow: `0 0 10px ${segment.color}40`,
              top: segment.startY + 'px',
              height: (segment.endY - segment.startY) + 'px'
            }}
          />
        ))}
      </div>
    );
  };

  // Handle scroll events to show/hide scroll to bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isBottomVisible = scrollHeight - scrollTop - clientHeight < 100;
      setScrollToBottomVisible(!isBottomVisible && scrollHeight > clientHeight + 300);
    };
    
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Scroll to bottom when new messages arrive or when explicitly requested
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll when new messages arrive if already near the bottom
  useEffect(() => {
    if (!loading.data && displayedNodes.length > 0) {
      // Only auto-scroll if we're already near the bottom
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isBottomVisible = scrollHeight - scrollTop - clientHeight < 200;
        
        if (isBottomVisible) {
          scrollToBottom();
        }
      }
    }
  }, [displayedNodes, loading.data]);

  // Update the useLayoutEffect to ensure better segment connections, especially after branch points
  useLayoutEffect(() => {
    if (!scrollContainerRef.current || displayedNodes.length === 0) return;
    
    const container = scrollContainerRef.current;
    const newSegments = [];
    
    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerScroll = container.scrollTop;
    
    // Find project root element
    const rootElement = container.querySelector('[data-node="project-root"]');
    let lastY = 0;
    
    // Get a set of unique message IDs to avoid duplicates from optimistic + real messages
    // This helps prevent duplicate track segments for messages that exist in both states
    const processedMessageIds = new Set<string>();
    
    // Process all displayed messages to create segments
    const messageElements = Array.from(container.querySelectorAll('[data-node]'));
    
    // Check if we have any actual message nodes (not just project-root)
    const hasRealMessages = messageElements.some(el => 
      el.getAttribute('data-node') !== 'project-root' && 
      el.getAttribute('data-node') !== 'loading-indicator'
    );
    
    // If there are no actual messages, just return without creating tracks
    if (!hasRealMessages && messageElements.length <= 1) {
      setTrackSegments([]);
      return;
    }
    
    if (rootElement) {
      const rootRect = rootElement.getBoundingClientRect();
      const rootBottom = rootRect.bottom - containerTop + containerScroll;
      
      // Find the root/main branch for consistent coloring
      const rootNode = allNodes.find(m => m.type === 'root');
      const mainBranchId = rootNode?.branch_id || '';
      const mainBranchColor = getBranchColor(mainBranchId);
      
      // Add initial segment from top to root with consistent color based on main branch
      newSegments.push({
        id: 'initial-track',
        startY: 0,
        endY: rootBottom,
        color: mainBranchColor, // Always use the main branch color for the first segment
        type: 'main',
        branch_id: mainBranchId || 'main'
      });
      
      lastY = rootBottom;
    }
    
    // Sort elements by their visual position (top to bottom)
    messageElements.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return (rectA.top - containerTop + containerScroll) - (rectB.top - containerTop + containerScroll);
    });
    
    for (let i = 0; i < messageElements.length; i++) {
      const element = messageElements[i];
      const nodeType = element.getAttribute('data-node');
      if (!nodeType || nodeType === 'project-root') continue;
      
      const rect = element.getBoundingClientRect();
      const messageId = element.getAttribute('data-id');
      
      if (!messageId) continue;
      
      // Skip if we've already processed this message ID to avoid duplicates
      // But make an exception for transition IDs which are prefixed
      if (processedMessageIds.has(messageId) && !messageId.startsWith('transition-')) continue;
      processedMessageIds.add(messageId);
      
      const message = displayedNodes.find(m => m.id === messageId) || 
                    (messageId.startsWith('transition-') ? 
                      displayedNodes.find(m => m.id === messageId.replace('transition-', '')) : 
                      undefined);
      
      if (!message) continue;
      
      const elementTop = rect.top - containerTop + containerScroll;
      const elementBottom = rect.bottom - containerTop + containerScroll;
      const elementMidpoint = elementTop + (rect.height / 2);
      
      // Get color for this segment
      const color = getBranchColor(message.branch_id);
      
      // Create segment from last position to this element
      if (elementTop > lastY) {
        newSegments.push({
          id: `segment-to-${messageId}`,
          startY: lastY,
          endY: elementMidpoint,
          color: color,
          type: 'branch',
          branch_id: message.branch_id
        });
      }
      
      // Special handling for branch points - ensure we connect to the next element
      if (nodeType === 'branch-point') {
        // Look ahead to the next element
        if (i < messageElements.length - 1) {
          const nextElement = messageElements[i + 1];
          const nextRect = nextElement.getBoundingClientRect();
          const nextTop = nextRect.top - containerTop + containerScroll;
          
          // Add an extra segment to connect the branch point to the next element
          if (nextTop > elementBottom) {
            const nextMessageId = nextElement.getAttribute('data-id');
            const nextMessage = nextMessageId ? 
              displayedNodes.find(m => m.id === nextMessageId) || 
              (nextMessageId.startsWith('transition-') ? 
                displayedNodes.find(m => m.id === nextMessageId.replace('transition-', '')) : 
                undefined) : 
              undefined;
            
            // Use the appropriate branch color for the connecting segment
            const connectingColor = nextMessage ? getBranchColor(nextMessage.branch_id) : color;
            
            newSegments.push({
              id: `connector-${messageId}-to-next`,
              startY: elementBottom,
              endY: nextTop,
              color: connectingColor,
              type: 'branch',
              branch_id: nextMessage?.branch_id || message.branch_id
            });
          }
        }
      }
      
      // Update last position for next iteration
      lastY = elementBottom;
    }
    
    // Add final segment to bottom if needed, but only if we have real messages
    // and only extend it to a reasonable distance below the last message
    if (lastY > 0 && hasRealMessages) {
      const lastMessage = displayedNodes[displayedNodes.length - 1];
      const extendHeight = Math.min(
        container.scrollHeight - lastY, // Don't go beyond container
        100 // Maximum extension of 100px below last message
      );
      
      if (extendHeight > 0) {
        newSegments.push({
          id: 'final-track',
          startY: lastY,
          endY: lastY + extendHeight,
          color: lastMessage ? getBranchColor(lastMessage.branch_id) : '#3b82f6',
          type: 'branch',
          branch_id: lastMessage ? lastMessage.branch_id : 'main'
        });
      }
    }
    
    // Cast the newSegments array to the correct type to fix the linter error
    setTrackSegments(newSegments as Array<{
      id: string;
      startY: number;
      endY: number;
      color: string;
      type: 'main' | 'branch' | 'highlight';
      dashed?: boolean;
      branch_id?: string;
    }>);
  }, [displayedNodes, currentBranchId, loading, optimisticMessages.length === 0]);

  // Determine if we're viewing a branch that has a parent we can switch back to
  const getCurrentBranchParent = (): Branch | undefined => {
    if (!currentBranchId) return undefined;
    
    const currentBranch = branches.find(b => b.id === currentBranchId);
    if (currentBranch?.parent_branch_id) {
      return branches.find(b => b.id === currentBranch.parent_branch_id);
    }
    return undefined;
  };

  // Loading state - use loading.data from context
  if (loading.data && allNodes.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="inline-flex items-center rounded-full bg-primary-foreground px-4 py-2 text-sm font-medium shadow-sm">
          <div className="mr-2 size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          Loading conversation...
        </div>
      </div>
    );
  }

  if (allNodes.length === 0) {
    // Clear any track segments when there are no messages
    if (trackSegments.length > 0) {
      setTrackSegments([]);
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No messages yet</h3>
        <p className="text-muted-foreground mt-2">Start a conversation to see messages here.</p>
      </div>
    );
  }

  // Handle selection of a message (for minimap integration)
  const handleMessageSelect = (messageId: string) => {
    if (onMessageSelect) {
      onMessageSelect(messageId);
    }
  };

  // Handle branch creation from a message
  const handleBranchClick = (messageId: string) => {
    setSelectedMessageId(messageId);
    setBranchDialogOpen(true);
  };

  // Create a new branch based on the selected message
  const createBranch = async () => {
    setCreatingBranch(true);
    
    try {
      // Use the context's createBranch function instead of direct API calls
      const newBranchId = await contextCreateBranch({
        branchPointNodeId: selectedMessageId as string,
        name: branchReason || undefined,
        createdBy: 'user'
      });
      
      console.log('Branch created with ID:', newBranchId);
      
      // Call the callback if provided
      onBranchCreated && onBranchCreated(newBranchId);
      
      // Reset dialog state
      setBranchDialogOpen(false);
      setBranchReason('');
      
      // Switch to the new branch
      switchBranch(newBranchId);
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setCreatingBranch(false);
    }
  };

  // Get branch point info for a specific message
  const getBranchPointInfo = (messageId: string): BranchPointInfo | undefined => {
    return branchPoints.find(bp => bp.messageId === messageId);
  };

  // Determine the target branch for switching based on current branch
  const getBranchSwitchTarget = (branchPointInfo: BranchPointInfo, currentBranchId: string | null): { branchId: string, branchName: string | null, branchColor: string } => {
    // If we're on the child branch, switch to parent
    if (currentBranchId === branchPointInfo.childBranchId) {
      return {
        branchId: branchPointInfo.parentBranchId,
        branchName: getBranchName(branchPointInfo.parentBranchId),
        branchColor: branchPointInfo.parentBranchColor
      };
    }
    
    // Otherwise, switch to child branch
    return {
      branchId: branchPointInfo.childBranchId,
      branchName: branchPointInfo.childBranchName,
      branchColor: branchPointInfo.childBranchColor
    };
  };

  return (
   <>
      <div 
        ref={scrollContainerRef}
        className="flex flex-col gap-4 max-w-3xl mx-auto p-4 pb-32 h-[calc(100vh-200px)] overflow-y-auto overflow-x-hidden relative scroll-smooth"
      >
        {/* Render unified subway track */}
        {renderSubwayTrack()}
        
        {/* Current branch indicator */}
        {currentBranchId && (
          <div className="fixed top-4 left-4 z-50">
            <div 
              className="px-3 py-1.5 text-xs font-medium rounded-full border shadow-md flex items-center gap-2 bg-white/90 backdrop-blur-sm"
              style={{ borderColor: `${getBranchColor(currentBranchId)}40` }}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getBranchColor(currentBranchId) }}
              />
              <span style={{ color: getBranchColor(currentBranchId) }}>
                {getBranchName(currentBranchId)}
              </span>
            </div>
          </div>
        )}
        
        {/* Parent branch link - show if we're on a child branch */}
        {getCurrentBranchParent() && (
          <div className="fixed top-4 right-4 z-50">
            <Button
              variant="outline"
              size="sm"
              className="text-xs px-3 py-1 h-auto flex items-center gap-1.5 border shadow-md bg-white/90 backdrop-blur-sm"
              onClick={() => switchBranch(getCurrentBranchParent()!.id)}
              style={{ 
                borderColor: `${getBranchColor(getCurrentBranchParent()!.id)}40`,
                color: getBranchColor(getCurrentBranchParent()!.id)
              }}
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to {getCurrentBranchParent()!.name || 'parent branch'}</span>
            </Button>
          </div>
        )}
        
        {/* Project root indicator */}
        {displayedNodes.length > 0 && (
          <div className="relative flex justify-center py-8 mb-2" data-node="project-root">
            <div 
              className="size-14 rounded-full flex items-center justify-center border-3 shadow-md bg-background z-10 relative"
              style={{ borderColor: getBranchColor(displayedNodes[0]?.branch_id || '') }}
            >
              <Train
                className="size-7"
                style={{ color: getBranchColor(displayedNodes[0]?.branch_id || '') }}
              />
            </div>
            
          </div>
        )}
        
        {displayedNodes
          .map((message, index) => {
            // Skip root nodes as they're not visible messages
            if (message.type === 'root' || message.type === 'branch-root') {
              return null;
            }

            // Display branch transition indicator
            const isBranchChange = isBranchTransition(message, index, displayedNodes);
            if (isBranchChange) {
              const prevBranchId = displayedNodes[index - 1].branch_id;
              const currentBranchId = message.branch_id;
              const prevBranchColor = getBranchColor(prevBranchId);
              const currentBranchColor = getBranchColor(currentBranchId);
              
              // Find the branch to get its name
              const currentBranch = branches.find(b => b.id === currentBranchId);
              const branchName = currentBranch?.name || 'Branch continuation';
              const prevBranchName = getBranchName(prevBranchId);
              
              return (
                <div 
                  key={`transition-${message.id}`} 
                  className="relative my-14 z-10"
                  data-node="branch-transition"
                  data-id={`transition-${message.id}`}
                  data-branch={message.branch_id}
                  data-prev-branch={prevBranchId}
                >
                  {/* Branch transition visualization */}
                  <div className="flex items-center justify-center relative">
                    <div 
                      className="size-16 rounded-full border-3 bg-background shadow-lg flex items-center justify-center absolute z-10"
                      style={{ 
                        borderColor: currentBranchColor, 
                        boxShadow: `0 0 0 4px rgba(255,255,255,0.9), 0 0 0 5px ${currentBranchColor}40` 
                      }}
                    >
                      <GitBranch 
                        className="size-7" 
                        style={{ color: currentBranchColor }}
                      />
                    </div>
                    
                    {/* Simplified branch info tag */}
                    <div 
                      className="absolute top-24 left-1/2 transform -translate-x-1/2 px-5 py-2 rounded-lg text-sm font-medium border-2 flex items-center gap-2 shadow-sm mt-2 bg-white"
                      style={{ 
                        borderColor: `${currentBranchColor}`,
                        color: currentBranchColor,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="size-4" />
                        <span>Branch transition</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Check if this message is a branch point with child branches
            const branchPointInfo = getBranchPointInfo(message.id);
            const hasBranchOptions = branchPointInfo && (
              branchPointInfo.parentBranchId === message.branch_id || 
              branchPointInfo.childBranchId === message.branch_id
            );
            
            if (message.type === 'user-message' || message.type === 'assistant-message') {
              const isUser = message.type === 'user-message';
              // Use streaming content from context if this is the streaming message
              const messageText = message.id === streamingMessageId && streamingContent !== null 
                ? streamingContent 
                : message.message_text || '';
              const stationNumber = getStationNumber(message, index, displayedNodes);
              const branchColor = getBranchColor(message.branch_id);
              
              // Check if this is an optimistic message or currently streaming
              const isOptimistic = Boolean(message.optimistic);
              const isStreaming = message.id === streamingMessageId && streamingContent !== null;
              const isLoading = isOptimistic && message.isLoading;
              const showTypingIndicator = isStreaming || isLoading;
                
                return (
                  <div 
                    key={message.id} 
                    className={cn(
                      "group relative z-10 my-6",
                      isUser ? "ml-4 mr-16 md:ml-16 md:mr-24" : "ml-16 mr-4 md:ml-24 md:mr-16",
                      isOptimistic && "animate-fadeIn"
                    )}
                    onMouseEnter={() => setActiveMessage(message.id)}
                    onMouseLeave={() => setActiveMessage(null)}
                    onClick={() => handleMessageSelect(message.id)}
                    data-node="message"
                    data-id={message.id}
                    data-branch={message.branch_id}
                    data-type={message.type}
                    data-optimistic={isOptimistic ? 'true' : 'false'}
                    data-streaming={isStreaming ? 'true' : 'false'}
                  >
                  {/* Branch line extending to the side if this is a branch point */}
                  {hasBranchOptions && !isUser && (
                    <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 z-0">
                      <div className="relative">
                        {/* Get the correct branch target based on current branch */}
                        {(() => {
                          const switchTarget = getBranchSwitchTarget(branchPointInfo, currentBranchId);
                          return (
                            <>
                              {/* Horizontal branch line with transition */}
                              <div 
                                className={`absolute h-3 ${isBranchChange ? 'transition-colors duration-500' : ''}`}
                                style={{ 
                                  background: switchTarget.branchColor,
                                  borderTopRightRadius: '4px',
                                  width: 'calc(50vw - 20px)',
                                  left: '-10px',
                                  top: '-1.5px',
                                  zIndex: 0
                                }}
                              />
                              
                              {/* Enhanced branch switch button with better positioning and feedback */}
                              <div className="absolute transform translate-y-8" style={{ left: '40px', zIndex: 1 }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 text-xs bg-white shadow-md border-2 px-4 flex items-center gap-2 font-medium"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    switchBranch(switchTarget.branchId);
                                  }}
                                  style={{ 
                                    color: switchTarget.branchColor,
                                    borderColor: `${switchTarget.branchColor}`, 
                                  }}
                                >
                                  <SwitchCamera className="h-4 w-4" />
                                  <span>Switch to {switchTarget.branchName || 'branch'}</span>
                                </Button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Message avatar - ensure it's above branch lines */}
                  <div 
                    className={cn(
                      "absolute top-8 transform -translate-y-1/2 size-12 flex items-center justify-center rounded-full border-2 shadow-md bg-background z-20",
                      isUser 
                        ? "left-[-4rem]" 
                        : "right-[-4rem]"
                    )}
                    style={{ 
                      borderColor: branchColor, 
                      background: isUser ? branchColor : 'white',
                      opacity: activeMessage === message.id || !activeMessage ? 1 : 0.7,
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {isUser ? (
                      <User className="size-6 text-white" />
                    ) : (
                      <Bot className="size-6" style={{ color: branchColor }} />
                    )}
                    </div>
                    
                  {/* Message card */}
                    <Card 
                      className={cn(
                      "transition-all duration-200 p-0 overflow-hidden",
                        isUser 
                        ? "text-primary-foreground shadow-sm shadow-primary/10" 
                        : "border shadow-sm hover:shadow",
                      activeMessage === message.id && "ring-2 ring-offset-2",
                      "group-hover:shadow-md",
                      isOptimistic && (message.isLoading || isStreaming) && "border-primary/40"
                    )}
                    style={{ 
                      borderColor: isUser ? branchColor : undefined,
                      backgroundColor: isUser ? branchColor : undefined,
                      borderRadius: isUser ? '12px 12px 12px 3px' : '12px 12px 3px 12px',
                      borderWidth: '1.5px',
                      ...(activeMessage === message.id ? { 
                        ringColor: `${branchColor}`,
                        transform: 'scale(1.01)'
                      } : {})
                    }}
                  >
                    {/* Time indicator */}
                    <div 
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-medium border-b",
                        isUser 
                          ? "bg-black/10 border-black/10 text-white/90" 
                          : "bg-muted/30 border-muted/30 text-muted-foreground",
                        isOptimistic && !isUser && message.isLoading && "bg-primary/10 border-primary/20"
                      )}
                    >
                      {isOptimistic 
                        ? 'Just now' 
                        : new Date(message.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit'
                          })
                      }
                      {!isUser && (
                        <span className="ml-1">• Station {stationNumber}</span>
                      )}
                    </div>
                    
                    <div className="p-3.5">
                      <div 
                        className={cn(
                          "prose prose-sm max-w-none",
                          isUser ? "prose-invert" : "dark:prose-invert"
                        )}
                        dangerouslySetInnerHTML={{ 
                          __html: formatMessageText(
                            messageText, 
                            showTypingIndicator
                          ) 
                        }}
                      />
                    </div>
                      
                    {/* AI message footer - only show branch button for non-optimistic messages */}
                      {!isUser && (
                      <div className="px-3.5 py-2 bg-muted/10 border-t border-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            <span>AI Assistant</span>
                            {isStreaming && (
                              <span className="ml-2 text-primary animate-pulse">generating...</span>
                            )}
                            {isLoading && !isStreaming && (
                              <span className="ml-2 text-primary animate-pulse">thinking...</span>
                            )}
                          </div>
                      
                        {/* Branch button - only show for non-optimistic messages */}
                        {!isOptimistic && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" 
                                  size="sm"
                                  className="h-6 px-2 text-xs hover:bg-background rounded-full border border-transparent hover:border-muted" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBranchClick(message.id);
                                  }}
                                >
                                  <GitBranch className="h-3 w-3 mr-1" /> 
                                  Branch
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Create a new conversation branch from this point
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}
                  </Card>
                  </div>
                );
            }

            if (message.type === 'branch-point') {
              // Find the branch that has this node as its branch point
              const childBranch = branches.find(b => b.branch_point_node_id === message.id);
              const branchName = childBranch?.name || 'Branch point';
              const branchColor = getBranchColor(message.branch_id);
              const childBranchColor = childBranch ? getBranchColor(childBranch.id) : branchColor;
              
              // Find the parent message (which should be an assistant message)
              const parentMessage = displayedNodes.find(m => m.id === message.parent_id);
              const isAssistantParent = parentMessage?.type === 'assistant-message';
              
              // Check if this is the last message
              const isLastMessage = index === displayedNodes.length - 1;
              
              // Find the next message to determine the color for the vertical connector
              const nextMessage = index < displayedNodes.length - 1 ? displayedNodes[index + 1] : null;
              const nextColor = nextMessage ? getBranchColor(nextMessage.branch_id) : branchColor;
              
              return (
                <div 
                  key={message.id} 
                  className="relative py-12 z-10"
                  data-node="branch-point"
                  data-id={message.id}
                  data-branch={message.branch_id}
                  data-child-branch={childBranch?.id}
                >
                  <div className="flex items-center justify-center">
                    {/* Improved branch point node - clear fork visualization with higher z-index */}
                    <div 
                      className="rounded-full border-3 bg-background size-14 flex items-center justify-center shadow-lg relative z-20"
                      style={{ 
                        borderColor: branchColor,
                        boxShadow: `0 0 0 4px white, 0 0 0 5px ${branchColor}30`
                      }}
                    >
                      <GitBranch className="size-6" style={{ color: branchColor }} />
                    </div>
                    
                    {/* Add a vertical line extending down from the branch icon */}
                    {!isLastMessage && (
                      <div 
                        className="absolute w-2.5 rounded-full z-0"
                        style={{ 
                          background: nextColor,
                          top: 'calc(50% + 28px)',  /* Position it right below the branch icon */
                          height: '100px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          boxShadow: `0 0 10px ${nextColor}40`
                        }}
                      />
                    )}
                    
                    {/* Branch line extending to the right - horizontal fork */}
                    {childBranch && (
                      <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
                        {/* Line extending completely through the circle */}
                        <div className="relative">
                          {(() => {
                            // Determine if we're on the child branch or parent branch
                            const isOnChildBranch = currentBranchId === childBranch.id;
                            const targetBranchId = isOnChildBranch ? message.branch_id : childBranch.id;
                            const targetBranchName = getBranchName(targetBranchId);
                            const lineColor = isOnChildBranch ? branchColor : childBranchColor;
                            
                            return (
                              <>
                                <div 
                                  className="absolute h-3" 
                                  style={{ 
                                    background: lineColor,
                                    borderTopRightRadius: '4px',
                                    width: 'calc(50vw - 20px)',
                                    left: '-10px',
                                    top: '-1.5px',
                                    zIndex: 0
                                  }}
                                ></div>
                                
                                {/* Enhanced switch button with dynamic direction */}
                                <div className="absolute transform translate-y-8 pointer-events-auto" style={{ left: '40px', zIndex: 1 }}>
                        <Button 
                                    variant="outline"
                                    size="sm"
                                    className="h-9 text-xs bg-white shadow-md border-2 px-4 flex items-center gap-2 font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      switchBranch(targetBranchId);
                                    }}
                                    style={{ 
                                      color: lineColor,
                                      borderColor: lineColor,
                                    }}
                                  >
                                    <SwitchCamera className="h-4 w-4" />
                                    <span>Switch to {targetBranchName || 'branch'}</span>
                        </Button>
                    </div>
                              </>
                            );
                          })()}
                  </div>
                    </div>
                    )}
                  </div>
                  </div>
                );
            }

            return null;
          })}
        
        {/* Loading indicator for new messages */}
        {optimisticMessages.length === 0 && (
          <div 
            className="flex justify-center py-4 z-10"
            data-node="loading-indicator"
          >
            <div className="flex flex-col items-center">
              <div className="flex gap-1 mb-1">
                <div className="bg-primary rounded-full h-2 w-2 animate-pulse"></div>
                <div className="bg-primary rounded-full h-2 w-2 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                <div className="bg-primary rounded-full h-2 w-2 animate-pulse" style={{ animationDelay: '400ms' }}></div>
              </div>
              <span className="text-xs text-muted-foreground animate-pulse">
                {loading.data ? 'Loading conversation...' : 'AI is thinking...'}
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Scroll to bottom button */}
      {scrollToBottomVisible && (
        <Button
          className="fixed bottom-24 right-4 size-10 p-0 rounded-full shadow-md z-10 bg-primary/90 text-primary-foreground animate-fadeIn"
          onClick={() => {
            scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          <CornerDownRight className="size-5" />
        </Button>
      )}

      {/* Branch creation dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new subway branch</DialogTitle>
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
              <p className="text-xs text-muted-foreground mt-1">
                A descriptive name will help you remember the purpose of this branch.
              </p>
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={createBranch}
              disabled={creatingBranch}
              className="gap-1"
              style={{ 
                backgroundColor: currentBranchId ? getBranchColor(currentBranchId) : undefined,
                borderColor: currentBranchId ? getBranchColor(currentBranchId) : undefined 
              }}
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

      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .animate-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        
        .animate-cursor {
          animation: cursor 0.8s step-end infinite;
          display: inline-block;
          margin-left: 2px;
          color: currentColor;
          font-weight: bold;
        }
        
        .animate-delay-200 {
          animation-delay: 0.2s;
        }
        
        .animate-delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
    </>
  );
}) 