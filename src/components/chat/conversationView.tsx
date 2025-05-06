import { Button } from '@/components/ui/button';
import { useConversation } from '@/lib/contexts/ConversationContext';
import { TimelineNode } from '@/lib/types/database';
import { CornerDownRight, Train } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AssistantMessage } from './nodes/assistantMessage';
import { BranchPoint } from './nodes/branchPoint';
import { BranchRoot } from './nodes/branchRoot';
import { ProjectRoot } from './nodes/projectRoot';
import { UserMessage } from './nodes/userMessage';

// Define the shape we expect for timeline nodes as used by our components


// Define branch info structure for each direction
export interface BranchInfo {
	branchId: string;
	branchName: string | null;
	branchColor: string;
	direction: 'left' | 'right' | 'auto';
}

// Define branch point info structure to support multiple directions
export interface BranchPointInfo {
	parentBranchId: string;
	nodeId: string;
	position: number;
	parentBranchColor: string;
	branches: {
		left?: BranchInfo;
		right?: BranchInfo;
		auto?: BranchInfo;
	};
}

interface ConversationViewProps {
	onMessageSelect?: (nodeId: string) => void;
	onBranchClick?: (nodeId: string, direction?: 'left' | 'right' | 'auto') => void;
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
	const handleBranchClick = (nodeId: string, direction?: 'left' | 'right' | 'auto') => {
		if (onBranchClick) {
			onBranchClick(nodeId, direction);
		}
	};

	// Get message station number (position in the conversation)
	const getStationNumber = (message: TimelineNode, index: number, messages: TimelineNode[]): number => {
		// Count only user and assistant messages
		return messages.slice(0, index + 1).filter(
			m => m.type === 'user-message' || m.type === 'assistant-message'
		).length;
	};

	// Update getBranchPointInfo to handle multiple branches
	const getBranchPointInfo = (nodeId: string): BranchPointInfo | undefined => {
		// Find all branches that have this message as their branch point
		const childBranches = branches.filter(b => b.branch_point_node_id === nodeId);

		if (childBranches.length === 0) return undefined;

		// Get parent branch ID from first child (all should have the same parent)
		const parentBranchId = childBranches[0].parent_branch_id;

		if (!parentBranchId) return undefined;

		// Build branch mapping by direction
		const branchMap: {
			left?: BranchInfo;
			right?: BranchInfo;
			auto?: BranchInfo;
		} = {};

		// Process each child branch and organize by direction
		childBranches.forEach(branch => {
			let direction: 'left' | 'right' | 'auto' = 'auto';

			// Extract direction from branch metadata
			if (branch.metadata?.layout?.direction) {
				if (['left', 'right', 'auto'].includes(branch.metadata.layout.direction)) {
					direction = branch.metadata.layout.direction as 'left' | 'right' | 'auto';
				}
			}

			// Add to appropriate direction in map
			branchMap[direction] = {
				branchId: branch.id,
				branchName: branch.name,
				branchColor: getBranchColor(branch.id),
				direction
			};
		});

		return {
			parentBranchId,
			nodeId,
			position: allNodes.find(m => m.id === nodeId)?.position || 0,
			parentBranchColor: getBranchColor(parentBranchId),
			branches: branchMap
		};
	};

	// Determine the target branch for switching based on current branch
	const getBranchSwitchTarget = (branchPointInfo: BranchPointInfo | undefined, currentBranchId: string | null) => {
		if (!branchPointInfo) return null;

		// Get all branches at this point
		const branches = Object.values(branchPointInfo.branches).filter(Boolean);

		// If we're on the parent branch, suggest first available child branch
		if (currentBranchId === branchPointInfo.parentBranchId) {
			// Find first available branch
			const firstBranch = branches[0];
			if (firstBranch) {
				return {
					branchId: firstBranch.branchId,
					branchName: firstBranch.branchName,
					branchColor: firstBranch.branchColor
				};
			}
			return null;
		}

		// If we're on one of the child branches, suggest parent
		if (branches.some(b => b.branchId === currentBranchId)) {
			return {
				branchId: branchPointInfo.parentBranchId,
				branchName: getBranchName(branchPointInfo.parentBranchId),
				branchColor: branchPointInfo.parentBranchColor
			};
		}

		return null;
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

	// Get the current active branch color for the track
	// Commented out because it's not currently used but might be needed later
	/* 
	const getCurrentBranchColor = () => {
	  if (!displayedChatNodes.length) return "#3b82f6"; // Default blue if no nodes
	  
	  // Use the branch color from the most recent node
	  const lastNode = displayedChatNodes[displayedChatNodes.length - 1];
	  return getBranchColor(lastNode.branch_id);
	};
	*/

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
				className="flex flex-col mx-auto max-w-3xl p-0 pb-32 h-full overflow-y-auto overflow-x-hidden relative scroll-smooth"
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
							branchPointInfo.nodeId === node.branch_id
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

				{/* Add the continuing track segment INSIDE the scroll container */}
				{/* <div className="relative w-full max-w-3xl mx-auto flex-1 min-h-[100px]">
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 z-0" 
            style={{
              width: "2.5px",
              background: getCurrentBranchColor(),
              top: '0',
              height: '100%'
            }}
          />
        </div> */}

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