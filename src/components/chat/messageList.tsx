"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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

interface MessageListProps {
  projectId: string;
  branchId: string | null;
  onBranchCreated: (newBranchId: string) => void;
  onBranchSwitch?: (branchId: string) => void; // New prop for branch switching
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

export function MessageList({ 
  projectId, 
  branchId, 
  onBranchCreated, 
  onBranchSwitch, 
  onMessageSelect 
}: MessageListProps) {
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

  // Add this near the scrollToBottomVisible state
  const [showBranchSwitchIndicator, setShowBranchSwitchIndicator] = useState(false);
  const [switchTargetBranchName, setSwitchTargetBranchName] = useState<string | null>(null);

  // Add an additional state to track branch switching specifically
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);

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
    // Find the first user message in the branch to ensure it's shown first
    const nonBranchRootMessages = branchMessages.filter(m => m.type !== 'branch-root');
    
    // Sort messages to ensure correct order after branch switch
    const sortedMessages = nonBranchRootMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    result.push(...sortedMessages);
    
    // Process branch transitions
    const transitions = Object.entries(branchTransitionsMap).map(([id, { fromBranch, toBranch }]) => ({
      id,
      fromBranch,
      toBranch
    }));
    
    setBranchTransitions(transitions);
    
    return result;
  };

  // Get messages to display based on the current branch
  const displayedMessages = React.useMemo(() => {
    return buildMessagePath(allMessages, branches, branchId);
  }, [allMessages, branches, branchId]);

  // Find and track all branch points in the conversation
  useEffect(() => {
    if (!allMessages.length || !branches.length) return;
    
    // Find branches that have been created from messages in the current branch path
    const branchPointsInfo: BranchPointInfo[] = [];
    
    branches.forEach(branch => {
      if (branch.parent_branch_id && branch.branch_point_node_id) {
        // Find the branch point message
        const branchPointMessage = allMessages.find(m => m.id === branch.branch_point_node_id);
        if (!branchPointMessage) return;
        
        // Get parent and child branch colors
        const parentBranchColor = getBranchColor(branch.parent_branch_id);
        const childBranchColor = getBranchColor(branch.id);
        
        branchPointsInfo.push({
          parentBranchId: branch.parent_branch_id,
          childBranchId: branch.id,
          childBranchName: branch.name,
          messageId: branch.branch_point_node_id,
          position: branchPointMessage.position,
          parentBranchColor,
          childBranchColor
        });
      }
    });
    
    setBranchPoints(branchPointsInfo);
    
    // Also track available branches from the current branch path
    if (branchId) {
      // Find all branches that stem from the current branch
      const childBranches = branches.filter(b => b.parent_branch_id === branchId);
      setAvailableBranches(childBranches);
    } else {
      // If we're on the main branch, find all top-level branches
      const mainBranch = branches.find(b => b.depth === 0);
      if (mainBranch) {
        const childBranches = branches.filter(b => b.parent_branch_id === mainBranch.id);
        setAvailableBranches(childBranches);
      }
    }
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
    return true; // Return a resolved promise value
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

  useEffect(() => {
    if (!loading && displayedMessages.length > 0) {
      // Only auto-scroll if we're already near the bottom
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isBottomVisible = scrollHeight - scrollTop - clientHeight < 200;
        
        if (isBottomVisible) {
          scrollToBottom();
        }
      }
    }
  }, [displayedMessages, loading]);

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

  // Get branch name from branchId
  const getBranchName = (branchId: string): string => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unnamed Branch';
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
            className={`absolute w-2.5 rounded-full ${isTransitioning ? 'transition-all duration-500' : ''}`}
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

  // Update the useLayoutEffect to ensure better segment connections, especially after branch points
  useLayoutEffect(() => {
    if (!scrollContainerRef.current || displayedMessages.length === 0) return;
    
    const container = scrollContainerRef.current;
    const newSegments = [];
    
    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerScroll = container.scrollTop;
    
    // Find project root element
    const rootElement = container.querySelector('[data-node="project-root"]');
    let lastY = 0;
    
    if (rootElement) {
      const rootRect = rootElement.getBoundingClientRect();
      const rootBottom = rootRect.bottom - containerTop + containerScroll;
      
      // Find the root/main branch for consistent coloring
      const rootNode = allMessages.find(m => m.type === 'root');
      const mainBranchId = rootNode?.branch_id || '';
      const mainBranchColor = getBranchColor(mainBranchId);
      
      // Add initial segment from top to root with consistent color based on main branch
      newSegments.push({
        id: 'initial-track',
        startY: 0,
        endY: rootBottom,
        color: mainBranchColor, // Always use the main branch color for the first segment
        branchId: mainBranchId || 'main'
      });
      
      lastY = rootBottom;
    }
    
    // Process all displayed messages to create segments
    const messageElements = Array.from(container.querySelectorAll('[data-node]'));
    
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
      
      const message = displayedMessages.find(m => m.id === messageId) || 
                    (messageId.startsWith('transition-') ? 
                      displayedMessages.find(m => m.id === messageId.replace('transition-', '')) : 
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
          branchId: message.branch_id
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
              displayedMessages.find(m => m.id === nextMessageId) || 
              (nextMessageId.startsWith('transition-') ? 
                displayedMessages.find(m => m.id === nextMessageId.replace('transition-', '')) : 
                undefined) : 
              undefined;
            
            // Use the appropriate branch color for the connecting segment
            const connectingColor = nextMessage ? getBranchColor(nextMessage.branch_id) : color;
            
            newSegments.push({
              id: `connector-${messageId}-to-next`,
              startY: elementBottom,
              endY: nextTop,
              color: connectingColor,
              branchId: nextMessage?.branch_id || message.branch_id
            });
          }
        }
      }
      
      // Update last position for next iteration
      lastY = elementBottom;
    }
    
    // Add final segment to bottom if needed
    if (lastY < container.scrollHeight) {
      const lastMessage = displayedMessages[displayedMessages.length - 1];
      newSegments.push({
        id: 'final-track',
        startY: lastY,
        endY: container.scrollHeight,
        color: lastMessage ? getBranchColor(lastMessage.branch_id) : '#3b82f6',
        branchId: lastMessage ? lastMessage.branch_id : 'main'
      });
    }
    
    setTrackSegments(newSegments);
  }, [displayedMessages, branchId, loading, showLoadingIndicator, isTransitioning]);

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

  // Find if a message is a branch point with child branches
  const getBranchPointInfo = (messageId: string): BranchPointInfo | undefined => {
    return branchPoints.find(bp => bp.messageId === messageId);
  };

  // Determine if we're viewing a branch that has a parent we can switch back to
  const getCurrentBranchParent = (): Branch | undefined => {
    if (!branchId) return undefined;
    
    const currentBranch = branches.find(b => b.id === branchId);
    if (currentBranch?.parent_branch_id) {
      return branches.find(b => b.id === currentBranch.parent_branch_id);
    }
    return undefined;
  };

  // Enhanced branch switching function
  const handleSwitchBranch = (targetBranchId: string | undefined) => {
    console.log('Switching to branch:', targetBranchId);
    
    if (onBranchSwitch && targetBranchId) {
      // Prevent switching to the same branch
      if (targetBranchId === branchId) {
        console.log('Already on branch:', targetBranchId);
        return;
      }
      
      // Before switching, update the UI to show a transitioning state
      setIsTransitioning(true);
      setIsSwitchingBranch(true); // Set the specific branch switching state
      
      // Call the parent component's onBranchSwitch function
      onBranchSwitch(targetBranchId);
      
      // Schedule a refresh of messages after switching
      setTimeout(() => {
        fetchMessages().then(() => {
          // Reset transition state after a short delay
          setTimeout(() => {
            setIsTransitioning(false);
            setIsSwitchingBranch(false); // Reset branch switching state
          }, 300);
        });
      }, 100);
    }
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

  const handleMessageSelect = (messageId: string) => {
    if (onMessageSelect) {
      onMessageSelect(messageId);
    }
  };

  // Add a function to determine which branch to switch to at a branch point
  const getBranchSwitchTarget = (branchPointInfo: BranchPointInfo, currentBranchId: string | null): { branchId: string, branchName: string | null, branchColor: string } => {
    // If we're currently on the parent branch, switch to the child branch
    if (!currentBranchId || currentBranchId === branchPointInfo.parentBranchId) {
      return {
        branchId: branchPointInfo.childBranchId,
        branchName: branchPointInfo.childBranchName,
        branchColor: branchPointInfo.childBranchColor
      };
    }
    // If we're on the child branch, switch back to the parent branch
    else if (currentBranchId === branchPointInfo.childBranchId) {
      return {
        branchId: branchPointInfo.parentBranchId,
        branchName: getBranchName(branchPointInfo.parentBranchId),
        branchColor: branchPointInfo.parentBranchColor
      };
    }
    // Default case
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
        
        {/* Loading overlay for branch switching */}
        {isSwitchingBranch && (
          <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px] z-30 flex items-center justify-center pointer-events-none">
            <div className="rounded-lg bg-background/80 border shadow-md px-4 py-3 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">Switching branch...</span>
            </div>
          </div>
        )}
        
        {/* Current branch indicator */}
        {branchId && (
          <div className="fixed top-4 left-4 z-50">
            <div 
              className="px-3 py-1.5 text-xs font-medium rounded-full border shadow-md flex items-center gap-2 bg-white/90 backdrop-blur-sm"
              style={{ borderColor: `${getBranchColor(branchId)}40` }}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getBranchColor(branchId) }}
              />
              <span style={{ color: getBranchColor(branchId) }}>
                {getBranchName(branchId)}
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
              onClick={() => handleSwitchBranch(getCurrentBranchParent()!.id)}
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
        {displayedMessages.length > 0 && (
          <div className="relative flex justify-center py-8 mb-2" data-node="project-root">
            <div 
              className="size-14 rounded-full flex items-center justify-center border-3 shadow-md bg-background z-10 relative"
              style={{ borderColor: getBranchColor(displayedMessages[0]?.branch_id || '') }}
            >
              <Train
                className="size-7"
                style={{ color: getBranchColor(displayedMessages[0]?.branch_id || '') }}
              />
            </div>
            
          </div>
        )}
        
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
              const messageText = message.message_text || '';
              const stationNumber = getStationNumber(message, index, displayedMessages);
              const branchColor = getBranchColor(message.branch_id);
                
                return (
                  <div 
                    key={message.id} 
                    className={cn(
                  "group relative z-10 my-6",
                    isUser ? "ml-4 mr-16 md:ml-16 md:mr-24" : "ml-16 mr-4 md:ml-24 md:mr-16",
                    )}
                    onMouseEnter={() => setActiveMessage(message.id)}
                    onMouseLeave={() => setActiveMessage(null)}
                  onClick={() => handleMessageSelect(message.id)}
                  data-node="message"
                  data-id={message.id}
                  data-branch={message.branch_id}
                  data-type={message.type}
                >
                  {/* Branch line extending to the side if this is a branch point */}
                  {hasBranchOptions && !isUser && (
                    <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 z-0">
                      <div className="relative">
                        {/* Get the correct branch target based on current branch */}
                        {(() => {
                          const switchTarget = getBranchSwitchTarget(branchPointInfo, branchId);
                          return (
                            <>
                              {/* Horizontal branch line with transition */}
                              <div 
                                className={`absolute h-3 ${isTransitioning ? 'transition-colors duration-500' : ''}`}
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
                                    handleSwitchBranch(switchTarget.branchId);
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
                      "group-hover:shadow-md"
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
                          : "bg-muted/30 border-muted/30 text-muted-foreground"
                      )}
                    >
                      {new Date(message.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
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
                        dangerouslySetInnerHTML={{ __html: formatMessageText(messageText) }}
                      />
                    </div>
                      
                    {/* AI message footer */}
                      {!isUser && (
                      <div className="px-3.5 py-2 bg-muted/10 border-t border-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            <span>AI Assistant</span>
                          </div>
                      
                        {/* Branch button */}
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
              const parentMessage = displayedMessages.find(m => m.id === message.parent_id);
              const isAssistantParent = parentMessage?.type === 'assistant-message';
              
              // Check if this is the last message
              const isLastMessage = index === displayedMessages.length - 1;
              
              // Find the next message to determine the color for the vertical connector
              const nextMessage = index < displayedMessages.length - 1 ? displayedMessages[index + 1] : null;
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
                            const isOnChildBranch = branchId === childBranch.id;
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
                                      handleSwitchBranch(targetBranchId);
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
        {showLoadingIndicator && (
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
                AI is thinking...
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
          onClick={scrollToBottom}
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
                backgroundColor: branchId ? getBranchColor(branchId) : undefined,
                borderColor: branchId ? getBranchColor(branchId) : undefined 
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
        
        .animate-delay-200 {
          animation-delay: 0.2s;
        }
        
        .animate-delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
    </>
  );
} 