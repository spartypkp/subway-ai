"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, forwardRef, useImperativeHandle, RefObject, useMemo } from 'react';
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
 * MessageList Component - Refactored
 * 
 * This component has been refactored to:
 * 1. Remove duplicate state that exists in ConversationContext
 * 2. Calculate branch relationships on demand rather than storing in state
 * 3. Simplify message display logic using direct context data
 * 4. Keep track segment visualization as UI-specific state
 * 
 * Design Pattern:
 * - ConversationContext handles data management and state
 * - MessageList is focused on UI rendering and user interactions
 * - Dynamic calculations are performed directly rather than stored in state
 */
interface MessageListProps {
    onBranchCreated?: (newBranchId: string) => void;
    onBranchSwitch?: (branchId: string) => void;
    onMessageSelect?: (messageId: string) => void;
}

// Define the ref type
export interface MessageListRef {
    updateMessageState: (params: {
        action: 'create' | 'update' | 'stream' | 'error' | 'complete';
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
        displayedChatNodes,
        allNodes,
        loading,
        streamingContent,
        isStreaming,
        fetchData,
        switchBranch,
        createBranch: contextCreateBranch,
        getBranchColor,
        getBranchName,
        updateStreamingContent
    } = useConversation();

    // Local UI state - only what's truly UI-specific
    const [activeMessage, setActiveMessage] = useState<string | null>(null);
    const [branchReason, setBranchReason] = useState('');
    const [branchDialogOpen, setBranchDialogOpen] = useState(false);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [creatingBranch, setCreatingBranch] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [scrollToBottomVisible, setScrollToBottomVisible] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Track segments - purely UI-specific state
    const [trackSegments, setTrackSegments] = useState<Array<{
        id: string;
        startY: number;
        endY: number;
        color: string;
        type: 'main' | 'branch' | 'highlight';
        dashed?: boolean;
        branch_id?: string;
    }>>([]);

    
    // Check if we have any messages to display -
    const hasMessagesToDisplay = useMemo(() => 
        displayedChatNodes.some(node => 
            node.type === 'user-message' || node.type === 'assistant-message'
        ), [displayedChatNodes]
    );

    // Determine if we're viewing a branch that has a parent we can switch back to
    const getCurrentBranchParent = (): Branch | undefined => {
        if (!currentBranchId) return undefined;

        const currentBranch = branches.find(b => b.id === currentBranchId);
        if (currentBranch?.parent_branch_id) {
            return branches.find(b => b.id === currentBranch.parent_branch_id);
        }
        return undefined;
    };

    // Format message text with typing indicators
    const formatMessageText = (text: string, showTypingIndicator: boolean): string => {
        // If there's no text but we should show typing, return the indicator
        if (!text && showTypingIndicator) {
            return `<span class="inline-flex items-center">
                    <span class="typing-indicator">
                      <span></span><span></span><span></span>
                    </span>
                  </span>`;
        }

        // If this is an AI message with content that's in the middle of typing
        if (showTypingIndicator) {
            return `${text}<span class="inline-flex items-center ml-1">
                    <span class="typing-indicator">
                      <span></span><span></span><span></span>
                    </span>
                  </span>`;
        }

        // Otherwise just return the text
        return text;
    };

    // Check if a message represents a branch transition
    const isBranchTransition = (message: TimelineNode, index: number, messages: TimelineNode[]): boolean => {
        if (index === 0) return false;
        const prevMessage = messages[index - 1];
        return prevMessage && prevMessage.branch_id !== message.branch_id;
    };

    // Get message station number (position in the conversation)
    const getStationNumber = (message: TimelineNode, index: number, messages: TimelineNode[]): number => {
        // Count only user and assistant messages
        return messages.slice(0, index + 1).filter(
            m => m.type === 'user-message' || m.type === 'assistant-message'
        ).length;
    };

    // Render the subway track visualization
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

    // Handle message selection
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
            // Use the context's createBranch function
            const newBranchId = await contextCreateBranch({
                branchPointNodeId: selectedMessageId as string,
                name: branchReason || undefined,
                createdBy: 'user'
            });

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

    // Get branch point info for a specific message - direct calculation instead of state
    const getBranchPointInfo = (messageId: string) => {
        // Find the branch that has this message as its branch point
        const childBranch = branches.find(b => b.branch_point_node_id === messageId);
        
        if (!childBranch || !childBranch.parent_branch_id) return undefined;
        
        // Only return branch point info if we're on one of the relevant branches
        // This helps prevent showing branch UI when viewing an unrelated branch
        if (currentBranchId !== childBranch.parent_branch_id && 
            currentBranchId !== childBranch.id) {
            return undefined;
        }
        
        return {
            parentBranchId: childBranch.parent_branch_id,
            childBranchId: childBranch.id,
            childBranchName: childBranch.name,
            messageId: childBranch.branch_point_node_id,
            position: allNodes.find(m => m.id === messageId)?.position || 0,
            parentBranchColor: getBranchColor(childBranch.parent_branch_id),
            childBranchColor: getBranchColor(childBranch.id)
        };
    };

    // Determine the target branch for switching based on current branch
    const getBranchSwitchTarget = (branchPointInfo: ReturnType<typeof getBranchPointInfo>, currentBranchId: string | null) => {
        if (!branchPointInfo) return null;
        
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

    // Scroll to bottom when new messages arrive or when explicitly requested
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        updateMessageState: (params) => {
            // If we're updating streaming content, extract it
            if (params.action === 'stream' && params.streamContent) {
                updateStreamingContent(params.streamContent);
            } else if (params.action === 'complete') {
                updateStreamingContent(null);
            } 
            // Other actions are ignored since we don't do optimistic updates anymore
        }
    }));

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

    // Auto-scroll when new messages arrive if already near the bottom
    useEffect(() => {
        if (!loading.data && displayedChatNodes.length > 0) {
            // Only auto-scroll if we're already near the bottom
            if (scrollContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                const isBottomVisible = scrollHeight - scrollTop - clientHeight < 200;

                if (isBottomVisible) {
                    scrollToBottom();
                }
            }
        }
    }, [displayedChatNodes, loading.data]);

    // Add back the useLayoutEffect for track segment generation with improved dependencies
    // Update the useLayoutEffect to ensure better segment connections, especially after branch points
    useLayoutEffect(() => {
        if (!scrollContainerRef.current || displayedChatNodes.length === 0) return;

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

            const message = displayedChatNodes.find(m => m.id === messageId) ||
                (messageId.startsWith('transition-') ?
                    displayedChatNodes.find(m => m.id === messageId.replace('transition-', '')) :
                    undefined);

            if (!message) continue;

            const elementTop = rect.top - containerTop + containerScroll;
            const elementBottom = rect.bottom - containerTop + containerScroll;
            const elementMidpoint = elementTop + (rect.height / 2);

            // Look ahead to the next element for better transitions
            const nextElement = i < messageElements.length - 1 ? messageElements[i + 1] : null;
            const nextNodeType = nextElement?.getAttribute('data-node');
            const nextMessageId = nextElement?.getAttribute('data-id');
            let nextTop = nextElement ? 
                (nextElement.getBoundingClientRect().top - containerTop + containerScroll) : 
                (elementBottom + 50); // Default distance if no next element
            
            const nextMessage = nextMessageId ? 
                displayedChatNodes.find(m => m.id === nextMessageId || m.id === nextMessageId?.replace('transition-', '')) : 
                undefined;

            // Special handling for branch points - crucial for consistent coloring
            if (nodeType === 'branch-point') {
                // Get branch information for this branch point
                const branchPointInfo = getBranchPointInfo(messageId);
                
                if (branchPointInfo) {
                    const isOnChildBranch = currentBranchId === branchPointInfo.childBranchId;
                    
                    // Create segment from last position to this branch point - always use parent branch color
                    if (elementTop > lastY) {
                        newSegments.push({
                            id: `segment-to-branch-point-${messageId}`,
                            startY: lastY,
                            endY: elementTop,
                            color: branchPointInfo.parentBranchColor,
                            type: 'branch',
                            branch_id: branchPointInfo.parentBranchId
                        });
                    }
                    
                    // Create segment below branch point - use current branch color
                    const belowColor = isOnChildBranch ? branchPointInfo.childBranchColor : branchPointInfo.parentBranchColor;
                    const belowBranchId = isOnChildBranch ? branchPointInfo.childBranchId : branchPointInfo.parentBranchId;
                    
                    newSegments.push({
                        id: `segment-below-branch-point-${messageId}`,
                        startY: elementBottom,
                        endY: nextTop,
                        color: belowColor,
                        type: 'branch',
                        branch_id: belowBranchId
                    });
                    
                    // Update lastY to end of this element
                    lastY = elementBottom;
                    continue; // Skip the normal processing since we've handled this specially
                }
            }
            
            // Special handling for branch roots
            if (nodeType === 'branch-root') {
                // Branch roots should use their own branch color consistently
                const branchColor = getBranchColor(message.branch_id);
                
                // Create segment from last position to this element
                if (elementTop > lastY) {
                    newSegments.push({
                        id: `segment-to-branch-root-${messageId}`,
                        startY: lastY,
                        endY: elementTop,
                        color: branchColor,
                        type: 'branch',
                        branch_id: message.branch_id
                    });
                }
                
                // Create segment below the branch root
                newSegments.push({
                    id: `segment-below-branch-root-${messageId}`,
                    startY: elementBottom,
                    endY: nextTop,
                    color: branchColor,
                    type: 'branch',
                    branch_id: message.branch_id
                });
                
                // Update lastY
                lastY = elementBottom;
                continue; // Skip normal processing
            }

            // Get color for this segment
            const color = getBranchColor(message.branch_id);

            // Standard message segment - create segment from last position to this element
            if (elementTop > lastY) {
                newSegments.push({
                    id: `segment-to-${messageId}`,
                    startY: lastY,
                    endY: elementTop,
                    color: color,
                    type: 'branch',
                    branch_id: message.branch_id
                });
            }

            // Check for branch transition to next element
            if (nextMessage && message.branch_id !== nextMessage.branch_id) {
                // This is a branch transition - create a segment with the next branch's color
                const nextColor = getBranchColor(nextMessage.branch_id);
                
                newSegments.push({
                    id: `transition-segment-${messageId}-to-${nextMessageId}`,
                    startY: elementBottom,
                    endY: nextTop,
                    color: nextColor, // Use the next branch's color for clearer transition
                    type: 'branch',
                    branch_id: nextMessage.branch_id
                });
            } else {
                // Normal continuation - use current branch color
                newSegments.push({
                    id: `segment-${messageId}-to-next`,
                    startY: elementBottom,
                    endY: nextTop,
                    color: color,
                    type: 'branch',
                    branch_id: message.branch_id
                });
            }

            // Update last position for next iteration
            lastY = elementBottom;
        }

        // Add final segment to bottom if needed, but only if we have real messages
        // and only extend it to a reasonable distance below the last message
        if (lastY > 0 && hasRealMessages) {
            const lastMessage = displayedChatNodes[displayedChatNodes.length - 1];
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

        setTrackSegments(newSegments as Array<{
            id: string;
            startY: number;
            endY: number;
            color: string;
            type: 'main' | 'branch' | 'highlight';
            dashed?: boolean;
            branch_id?: string;
        }>);
    }, [displayedChatNodes, getBranchColor, currentBranchId, allNodes]);

    // Add effect to trigger track rendering recalculation when data or layout changes
    useEffect(() => {
        // Only recalculate track paths if we have nodes and we're not loading
        if (!loading.data && displayedChatNodes.length > 0) {
            // Force a re-render to update the track segments
            const container = scrollContainerRef.current;
            if (container) {
                setTrackSegments(prevSegments => [...prevSegments]);
            }
        }
    }, [loading.data, displayedChatNodes.length]);

    // Loading state - simplified to use hasMessagesToDisplay
    if (loading.data && !hasMessagesToDisplay) {
        return (
            <div className="flex justify-center py-8">
                <div className="inline-flex items-center rounded-full bg-primary-foreground px-4 py-2 text-sm font-medium shadow-sm">
                    <div className="mr-2 size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    Loading conversation...
                </div>
            </div>
        );
    }
    
    if (!hasMessagesToDisplay) {
        // Clear any track segments when there are no messages
        if (trackSegments.length > 0) {
            setTrackSegments([]);
        }

        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
                <Train className="w-16 h-16 text-primary mb-6" />
                <h3 className="text-2xl font-medium mb-2">Welcome to your new subway line!</h3>
                <p className="text-muted-foreground max-w-md mb-6">Start a conversation below to begin your journey. Each message will appear as a station on your conversation map.</p>
                <div className="flex items-center justify-center p-3 rounded-lg bg-primary-foreground border border-border text-sm">
                    <MessageSquare className="w-4 h-4 mr-2 text-primary" />
                    <span>Try typing a message in the input box below</span>
                </div>
            </div>
        );
    }

    // Update the train station at the top
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
                    <div className="absolute fixed top-4 left-4 z-50">
                        <div
                            className="px-3 py-1.5 text-xs font-medium rounded-full border shadow-md flex items-center gap-2 bg-white/90 backdrop-blur-sm"
                            style={{ borderColor: `${getBranchColor(currentBranchId)}40` }}
                        >
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getBranchColor(currentBranchId) }}
                            />
                            <span>{getBranchName(currentBranchId) || 'Main Line'}</span>
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
                {displayedChatNodes.length > 0 && (
                    <div className="relative flex justify-center py-8 mb-2" data-node="project-root">
                        <div
                            className="size-14 rounded-full flex items-center justify-center border-3 shadow-md bg-background z-10 relative"
                            style={{ borderColor: getBranchColor(displayedChatNodes[0]?.branch_id || '') }}
                        >
                            <Train
                                className="size-7"
                                style={{ color: getBranchColor(displayedChatNodes[0]?.branch_id || '') }}
                            />
                        </div>

                    </div>
                )}

                {displayedChatNodes
                    .map((message, index) => {
                        // Skip root nodes as they're not visible messages
                        if (message.type === 'root' || message.type === 'branch-root') {
                            return null;
                        }

                        // Display branch transition indicator
                        // const isBranchChange = isBranchTransition(message, index, displayedChatNodes);
                        // if (isBranchChange) {
                        //     const prevBranchId = displayedChatNodes[index - 1].branch_id;
                        //     const currentBranchId = message.branch_id;
                        //     const prevBranchColor = getBranchColor(prevBranchId);
                        //     const currentBranchColor = getBranchColor(currentBranchId);

                        //     // Find the branch to get its name
                        //     const currentBranch = branches.find(b => b.id === currentBranchId);
                        //     const branchName = currentBranch?.name || 'Branch continuation';
                        //     const prevBranchName = getBranchName(prevBranchId);

                        //     return (
                        //         <div
                        //             key={`transition-${message.id}`}
                        //             className="relative my-14 z-10"
                        //             data-node="branch-transition"
                        //             data-id={`transition-${message.id}`}
                        //             data-branch={message.branch_id}
                        //             data-prev-branch={prevBranchId}
                        //         >
                        //             {/* Branch transition visualization */}
                        //             <div className="flex items-center justify-center relative">
                        //                 <div
                        //                     className="size-16 rounded-full border-3 bg-background shadow-lg flex items-center justify-center absolute z-10"
                        //                     style={{
                        //                         borderColor: currentBranchColor,
                        //                         boxShadow: `0 0 0 4px rgba(255,255,255,0.9), 0 0 0 5px ${currentBranchColor}40`
                        //                     }}
                        //                 >
                        //                     <GitBranch
                        //                         className="size-7"
                        //                         style={{ color: currentBranchColor }}
                        //                     />
                        //                 </div>

                        //                 {/* Simplified branch info tag */}
                        //                 <div
                        //                     className="absolute top-24 left-1/2 transform -translate-x-1/2 px-5 py-2 rounded-lg text-sm font-medium border-2 flex items-center gap-2 shadow-sm mt-2 bg-white"
                        //                     style={{
                        //                         borderColor: `${currentBranchColor}`,
                        //                         color: currentBranchColor,
                        //                     }}
                        //                 >
                        //                     <div className="flex items-center gap-2">
                        //                         <GitBranch className="size-4" />
                        //                         <span>Branch transition</span>
                        //                     </div>
                        //                 </div>
                        //             </div>
                        //         </div>
                        //     );
                        // }

                        // Check if this message is a branch point with child branches
                        const branchPointInfo = getBranchPointInfo(message.id);
                        const hasBranchOptions = branchPointInfo && (
                            branchPointInfo.parentBranchId === message.branch_id ||
                            branchPointInfo.childBranchId === message.branch_id
                        );

                        if (message.type === 'user-message' || message.type === 'assistant-message') {
                            const isUser = message.type === 'user-message';
                            // Use streaming content from context if this is a streaming message
                            const messageText = message.id === 'streaming-message' && streamingContent !== null
                                ? streamingContent
                                : message.message_text || '';
                            const stationNumber = getStationNumber(message, index, displayedChatNodes);
                            const branchColor = getBranchColor(message.branch_id);

                            // Show typing indicators for messages currently being streamed
                            const isStreaming = message.id === 'streaming-message' && streamingContent !== null;
                            const showTypingIndicator = Boolean(isStreaming || message.isStreaming);

                            return (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "group relative z-10 my-6",
                                        isUser ? "ml-4 mr-16 md:ml-16 md:mr-24" : "ml-16 mr-4 md:ml-24 md:mr-16",
                                        isStreaming && "animate-fadeIn"
                                    )}
                                    onMouseEnter={() => setActiveMessage(message.id)}
                                    onMouseLeave={() => setActiveMessage(null)}
                                    onClick={() => handleMessageSelect(message.id)}
                                    data-node="message"
                                    data-id={message.id}
                                    data-branch={message.branch_id}
                                    data-type={message.type}
                                    data-streaming={isStreaming ? 'true' : 'false'}
                                >
                                    {/* Branch line extending to the side if this is a branch point */}
                                    {hasBranchOptions && !isUser && (
                                        <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 z-0">
                                            <div className="relative">
                                                {(() => {
                                                    const switchTarget = getBranchSwitchTarget(branchPointInfo, currentBranchId);
                                                    return switchTarget ? (
                                                        <>
                                                            {/* Horizontal branch line with transition */}
                                                            <div
                                                                className={`absolute h-3`}
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
                                                    ) : null;
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
                                            isStreaming && "border-primary/40"
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
                                                isStreaming && !isUser && message.isStreaming && "bg-primary/10 border-primary/20"
                                            )}
                                        >
                                            {isStreaming
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

                                        {/* AI message footer - only show branch button for non-streaming messages */}
                                        {!isUser && (
                                            <div className="px-3.5 py-2 bg-muted/10 border-t border-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Sparkles className="h-3 w-3" />
                                                    <span>AI Assistant</span>
                                                    {isStreaming && (
                                                        <span className="ml-2 text-primary animate-pulse">generating...</span>
                                                    )}
                                                </div>

                                                {/* Branch button - only show for non-streaming messages */}
                                                {!isStreaming && (
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
                            if (!childBranch) return null;
                            
                            const branchPointInfo = getBranchPointInfo(message.id);
                            if (!branchPointInfo) return null;
                            
                            const isOnChildBranch = currentBranchId === branchPointInfo.childBranchId;
                            
                            // Determine which branch continues vertically (current branch) and which goes to the side
                            const mainLineColor = isOnChildBranch ? branchPointInfo.childBranchColor : branchPointInfo.parentBranchColor;
                            const sideLineColor = isOnChildBranch ? branchPointInfo.parentBranchColor : branchPointInfo.childBranchColor;
                            const sideLineBranchName = isOnChildBranch ? getBranchName(branchPointInfo.parentBranchId) : getBranchName(branchPointInfo.childBranchId);
                            const targetBranchId = isOnChildBranch ? branchPointInfo.parentBranchId : branchPointInfo.childBranchId;

                            return (
                                <div
                                    key={message.id}
                                    className="relative py-12 z-10"
                                    data-node="branch-point"
                                    data-id={message.id}
                                    data-branch={message.branch_id}
                                    data-parent-branch={branchPointInfo.parentBranchId}
                                    data-child-branch={branchPointInfo.childBranchId}
                                    data-current-view={isOnChildBranch ? 'child' : 'parent'}
                                >
                                    {/* Clearer connection to original branch before the split */}
                                    <div 
                                        className="absolute left-1/2 transform -translate-x-1/2 w-2.5 rounded-full z-0"
                                        style={{
                                            background: branchPointInfo.parentBranchColor,
                                            top: '-20px',
                                            height: '20px',
                                        }}
                                    />

                                    <div className="flex items-center justify-center">
                                        {/* Branch point node with parent branch color */}
                                        <div
                                            className="rounded-full border-3 bg-background size-14 flex items-center justify-center shadow-lg relative z-20"
                                            style={{
                                                borderColor: branchPointInfo.parentBranchColor,
                                                boxShadow: `0 0 0 4px white, 0 0 0 5px ${branchPointInfo.parentBranchColor}30`
                                            }}
                                        >
                                            <GitBranch className="size-6" style={{ color: branchPointInfo.parentBranchColor }} />
                                        </div>

                                        {/* Side branch line to the right with target branch color */}
                                        <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
                                            <div className="relative">
                                                {/* Horizontal branch line with target branch color */}
                                                <div
                                                    className="absolute h-3"
                                                    style={{
                                                        background: sideLineColor,
                                                        borderTopRightRadius: '4px',
                                                        width: 'calc(50vw - 20px)',
                                                        left: '-10px',
                                                        top: '-1.5px',
                                                        zIndex: 0
                                                    }}
                                                />

                                                {/* Branch switch button with target branch color */}
                                                <div className="absolute transform translate-y-8 pointer-events-auto" style={{ left: '40px', zIndex: 1 }}>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-9 text-xs bg-white shadow-md border-2 px-4 flex items-center gap-2 font-medium transition-all"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            switchBranch(targetBranchId);
                                                        }}
                                                        style={{
                                                            color: sideLineColor,
                                                            borderColor: sideLineColor,
                                                        }}
                                                    >
                                                        <SwitchCamera className="h-4 w-4" />
                                                        <span>Switch to {sideLineBranchName || 'branch'}</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Continuing vertical line (current branch) */}
                                        <div 
                                            className="absolute left-1/2 transform -translate-x-1/2 w-2.5 rounded-full z-0"
                                            style={{
                                                background: mainLineColor,
                                                top: 'calc(50% + 28px)',
                                                height: '50px',
                                            }}
                                        />

                                        {/* Visual label */}
                                        <div 
                                            className="absolute top-20 text-xs font-medium px-2 py-1 rounded-full bg-background/80 border"
                                            style={{ 
                                                borderColor: `${branchPointInfo.parentBranchColor}40`, 
                                                color: branchPointInfo.parentBranchColor 
                                            }}
                                        >
                                            Branch point
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // For BranchRoot - a "station entrance" metaphor
                        if (message.type === 'branch-root') {
                            const branchColor = getBranchColor(message.branch_id);
                            
                            return (
                                <div
                                    key={message.id}
                                    className="relative py-8 z-10" // Less vertical space than branch point
                                    data-node="branch-root"
                                    data-id={message.id}
                                    data-branch={message.branch_id}
                                >
                                    {/* Add connection from above */}
                                    <div 
                                        className="absolute left-1/2 transform -translate-x-1/2 w-2 rounded-full z-0"
                                        style={{
                                            background: branchColor,
                                            top: '-20px',
                                            height: '20px',
                                        }}
                                    />
                                    
                                    <div className="flex items-center justify-center">
                                        {/* Distinct visual for branch root - station entrance */}
                                        <div
                                            className="rounded-lg border-2 bg-background p-2 flex items-center justify-center shadow-md relative z-20"
                                            style={{ borderColor: branchColor }}
                                        >
                                            {/* Different icon - "entrance" to branch */}
                                            <div className="flex items-center gap-1.5">
                                                <ArrowRight className="size-4" style={{ color: branchColor }} />
                                                <span className="text-xs font-medium" style={{ color: branchColor }}>
                                                    New branch
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Add connection below */}
                                        <div 
                                            className="absolute left-1/2 transform -translate-x-1/2 w-2 rounded-full z-0"
                                            style={{
                                                background: branchColor,
                                                top: 'calc(50% + 20px)',
                                                height: '50px',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        }

                        return null;
                    })}

                {/* Loading indicator for new messages */}
                {!hasMessagesToDisplay && (
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