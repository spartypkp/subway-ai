import React, { useState, useRef, useEffect } from 'react';
import { CornerDownRight, Train } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectRoot } from './nodes/projectRoot';
import { UserMessage } from './nodes/userMessage';
import { AssistantMessage } from './nodes/assistantMessage';
import { BranchPoint } from './nodes/branchPoint';
import { BranchRoot } from './nodes/branchRoot';
import { useConversation } from '@/lib/contexts/ConversationContext';
import { TimelineNode } from '@/lib/types/database';

// Define the shape we expect for timeline nodes as used by our components


// Define branch point info structure
export interface BranchPointInfo {
  parentBranchId: string;
  childBranchId: string;
  childBranchName: string | null;
  messageId: string | null;
  position: number;
  parentBranchColor: string;
  childBranchColor: string;
}

interface ConversationViewProps {
  onMessageSelect?: (messageId: string) => void;
  onBranchClick?: (messageId: string) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  onMessageSelect,
  onBranchClick,
}) => {
  // Get data and functions from ConversationContext
  const {
    currentBranchId,
    displayedChatNodes,
    streamingContent,
    getBranchColor,
    getBranchName,
    branches,
    switchBranch,
    allNodes
  } = useConversation();

  // Local state
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const [scrollToBottomVisible, setScrollToBottomVisible] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle message selection
  const handleMessageSelect = (messageId: string) => {
    setActiveMessage(messageId);
    if (onMessageSelect) {
      onMessageSelect(messageId);
    }
  };

  // Handle branch creation click
  const handleBranchClick = (messageId: string) => {
    if (onBranchClick) {
      onBranchClick(messageId);
    }
  };

  // Get message station number (position in the conversation)
  const getStationNumber = (message: TimelineNode, index: number, messages: TimelineNode[]): number => {
    // Count only user and assistant messages
    return messages.slice(0, index + 1).filter(
      m => m.type === 'user-message' || m.type === 'assistant-message'
    ).length;
  };

  // Get branch point info for a specific message - direct calculation instead of state
  const getBranchPointInfo = (messageId: string): BranchPointInfo | undefined => {
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
  const getBranchSwitchTarget = (branchPointInfo: BranchPointInfo | undefined, currentBranchId: string | null) => {
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

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  // Auto-scroll when new messages arrive if already near the bottom
  useEffect(() => {
    if (displayedChatNodes.length > 0) {
      // Only auto-scroll if we're already near the bottom
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isBottomVisible = scrollHeight - scrollTop - clientHeight < 200;

        if (isBottomVisible) {
          scrollToBottom();
        }
      }
    }
  }, [displayedChatNodes]);

  // Check if we have any messages to display
  const hasMessagesToDisplay = displayedChatNodes.some(node => 
    node.type === 'user-message' || node.type === 'assistant-message'
  );

  // Empty state
  if (!hasMessagesToDisplay) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
        <Train className="w-16 h-16 text-primary mb-6" />
        <h3 className="text-2xl font-medium mb-2">Welcome to your new subway line!</h3>
        <p className="text-muted-foreground max-w-md mb-6">Start a conversation below to begin your journey. Each message will appear as a station on your conversation map.</p>
        <div className="flex items-center justify-center p-3 rounded-lg bg-primary-foreground border border-border text-sm">
          <span>Try typing a message in the input box below</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="flex flex-col gap-4 max-w-3xl mx-auto p-4 pb-32 h-[calc(100vh-200px)] overflow-y-auto overflow-x-hidden relative scroll-smooth"
      >
        {/* Project root indicator */}
        {displayedChatNodes.length > 0 && (
          <ProjectRoot branchColor={getBranchColor(displayedChatNodes[0]?.branch_id || '')} />
        )}

        {/* Render all chat nodes */}
        {displayedChatNodes.map((message, index) => {
          // Skip root nodes as they're not visible messages
          if (message.type === 'root') {
            return null;
          }

          // For branch roots
          if (message.type === 'branch-root') {
            return (
              <BranchRoot
                key={message.id}
                message={message}
                branchColor={getBranchColor(message.branch_id)}
              />
            );
          }

          // For branch points
          if (message.type === 'branch-point') {
            const branchPointInfo = getBranchPointInfo(message.id);
            if (!branchPointInfo) return null;
            
            return (
              <BranchPoint
                key={message.id}
                message={message}
                branchPointInfo={branchPointInfo}
                currentBranchId={currentBranchId}
                getBranchName={getBranchName}
                switchBranch={switchBranch}
              />
            );
          }

          // For user messages
          if (message.type === 'user-message') {
            return (
              <UserMessage
                key={message.id}
                message={message}
                isActive={activeMessage === message.id}
                branchColor={getBranchColor(message.branch_id)}
                onMessageSelect={handleMessageSelect}
              />
            );
          }

          // For assistant messages
          if (message.type === 'assistant-message') {
            const stationNumber = getStationNumber(message, index, displayedChatNodes);
            const branchPointInfo = getBranchPointInfo(message.id);
            const hasBranchOptions = branchPointInfo && (
              branchPointInfo.parentBranchId === message.branch_id ||
              branchPointInfo.childBranchId === message.branch_id
            );
            
            return (
              <AssistantMessage
                key={message.id}
                message={message}
                isActive={activeMessage === message.id}
                streamingContent={streamingContent}
                branchColor={getBranchColor(message.branch_id)}
                stationNumber={stationNumber}
                onMessageSelect={handleMessageSelect}
                onBranchClick={handleBranchClick}
                hasBranchOptions={hasBranchOptions}
                branchPointInfo={branchPointInfo}
                getBranchSwitchTarget={getBranchSwitchTarget}
                currentBranchId={currentBranchId}
                switchBranch={switchBranch}
              />
            );
          }

          return null;
        })}

        {/* Loading indicator for new messages */}
        {streamingContent && (
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
          onClick={() => {
            scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          <CornerDownRight className="size-5" />
        </Button>
      )}
    </>
  );
}; 