import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineNode } from '@/components/views/expertView/timelineNode';
import { ConversationNode } from '@/lib/types/chat';

export function ExpertView() {
	const {
		uiState,
		getVisibleNodes,
		navigateToNode,
		getNode,
	} = useConversationTimelineContext();

	const visibleNodes = getVisibleNodes();

	if (!uiState.selectedExpert) return null;

	// Group nodes by their depth level
	const nodesByDepth = visibleNodes.reduce((acc, node) => {
		const depth = node.metadata?.depth || 0;
		if (!acc[depth]) acc[depth] = [];
		acc[depth].push(node);
		return acc;
	}, {} as Record<number, ConversationNode[]>);

	// Calculate branch positions
	const getBranchPosition = (node: ConversationNode) => {
		const branchCount = node.branchNodeIds.length;
		if (branchCount === 0) return null;

		// Alternate branches left and right
		return node.branchNodeIds.map((branchId, index) => ({
			id: branchId,
			isLeft: index % 2 === 0,
			offset: Math.ceil((index + 1) / 2) * 200 // pixels offset from center
		}));
	};

	return (
		<div className="h-full flex flex-col">
			{/* Expert Configuration Card */}
			<Card className="m-4">
				<CardHeader>
					<CardTitle className="flex items-center gap-4">
						<div className="h-3 w-3 rounded-full bg-primary" /> {/* Expert's color indicator */}
						{uiState.selectedExpert.name}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">{uiState.selectedExpert.domain}</p>
					<p className="mt-2 text-sm leading-relaxed">{uiState.selectedExpert.longTermMemory}</p>
				</CardContent>
			</Card>

			{/* Subway Map Visualization */}
			<ScrollArea className="flex-1 w-full">
				<div className="relative min-h-[800px] w-full">
					{/* Center container for the main timeline */}
					<div className="absolute left-1/2 top-0 bottom-0 w-[400px] -translate-x-1/2">
						{/* Main Timeline Line */}
						<div className="absolute left-1/2 top-0 bottom-0 w-2 bg-primary -translate-x-1/2" />

						{/* Main Timeline Nodes */}
						{Object.entries(nodesByDepth).map(([depth, nodes]) => (
							<div
								key={depth}
								className="absolute left-0 right-0"
								style={{ top: `${Number(depth) * 160}px` }}
							>
								{nodes.filter(node => node.metadata?.isMainTimeline).map(node => (
									<div key={node.id}>
										<TimelineNode
											node={node}
											onClick={() => navigateToNode(node.id)}
											isCurrent={node.id === uiState.view.nodeId}
										/>

										{/* Branch Lines and Nodes */}
										{getBranchPosition(node)?.map(branch => {
											const branchNode = getNode(branch.id);
											if (!branchNode) return null;

											return (
												<div
													key={branch.id}
													className="absolute top-1/2"
													style={{
														left: branch.isLeft ? '0' : '100%',
														transform: `translateX(${branch.isLeft ? -branch.offset : branch.offset}px)`
													}}
												>
													{/* Branch connection line */}
													<div
														className="absolute top-1/2 h-0.5 bg-primary/50"
														style={{
															right: branch.isLeft ? '0' : 'auto',
															left: branch.isLeft ? 'auto' : '0',
															width: `${branch.offset}px`
														}}
													/>

													<TimelineNode
														node={branchNode}
														onClick={() => navigateToNode(branch.id)}
														isCurrent={branch.id === uiState.view.nodeId}
														isBranch
													/>
												</div>
											);
										})}
									</div>
								))}
							</div>
						))}
					</div>
				</div>
			</ScrollArea>
		</div>
	);
}