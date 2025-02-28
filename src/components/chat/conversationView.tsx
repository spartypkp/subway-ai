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
  nodeId: string | null;
  position: number;
  parentBranchColor: string;
  childBranchColor: string;
}

interface ConversationViewProps {
  onMessageSelect?: (nodeId: string) => void;
  onBranchClick?: (nodeId: string) => void;
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
  const handleMessageSelect = (nodeId: string) => {
    setActiveMessage(nodeId);
    if (onMessageSelect) {
      onMessageSelect(nodeId);
    }
  };

  // Handle branch creation click
  const handleBranchClick = (nodeId: string) => {
    if (onBranchClick) {
      onBranchClick(nodeId);
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
  const getBranchPointInfo = (nodeId: string): BranchPointInfo | undefined => {
    // Find the branch that has this message as its branch point
    console.log('Message ID', nodeId);
    console.log('Branches', branches);
    const childBranch = branches.find(b => b.branch_point_node_id === nodeId);
    console.log('childBranch', childBranch);
    console.log(`Not child branch`, !childBranch);
    console.log(`Not parent branch`, !childBranch?.parent_branch_id);
    
    if (!childBranch || !childBranch.parent_branch_id) return undefined;
    
    // Only return branch point info if we're on one of the relevant branches
    // This helps prevent showing branch UI when viewing an unrelated branch
   
    
    return {
        parentBranchId: childBranch.parent_branch_id,
        childBranchId: childBranch.id,
        childBranchName: childBranch.name,
        nodeId: childBranch.branch_point_node_id,
        position: allNodes.find(m => m.id === nodeId)?.position || 0,
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
        className="flex flex-col mx-auto max-w-3xl p-0 pb-32 h-[calc(100vh-200px)] overflow-y-auto overflow-x-hidden relative scroll-smooth"
      >
        {/* Project root indicator */}
        {displayedChatNodes.length > 0 && (
          <ProjectRoot branchColor={getBranchColor(displayedChatNodes[0]?.branch_id || '')} />
        )}

        {/* Render all chat nodes */}
        {displayedChatNodes.map((node, index) => {
          // Skip root nodes as they're not visible messages
          if (node.type === 'root') {
            return null;
          }

          // For branch roots
          if (node.type === 'branch-root') {
            return (
              <BranchRoot
                key={node.id}
                node={node}
                branchColor={getBranchColor(node.branch_id)}
              />
            );
          }

          // For branch points
          if (node.type === 'branch-point') {
            const branchPointInfo = getBranchPointInfo(node.id);
            if (!branchPointInfo) {
                console.log('No branch point info found for message', node.id);
                return null;
            }
            return (
              <BranchPoint
                key={node.id}
                node={node}
                branchPointInfo={branchPointInfo}
                currentBranchId={currentBranchId}
                getBranchName={getBranchName}
                switchBranch={switchBranch}
              />
            );
          }

          // For user messages
          if (node.type === 'user-message') {
            return (
              <UserMessage
                key={node.id}
                node={node}
                isActive={activeMessage === node.id}
                branchColor={getBranchColor(node.branch_id)}
                onMessageSelect={handleMessageSelect}
              />
            );
          }

          // For assistant messages
          if (node.type === 'assistant-message') {
            const stationNumber = getStationNumber(node, index, displayedChatNodes);
            const branchPointInfo = getBranchPointInfo(node.id);
            const hasBranchOptions = branchPointInfo && (
              branchPointInfo.parentBranchId === node.branch_id ||
              branchPointInfo.childBranchId === node.branch_id
            );
            
            return (
              <AssistantMessage
                key={node.id}
                node={node}
                isActive={activeMessage === node.id}
                streamingContent={streamingContent}
                branchColor={getBranchColor(node.branch_id)}
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
            className="flex justify-center py-3 z-10 w-full max-w-3xl mx-auto px-16"
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