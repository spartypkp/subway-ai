// components/views/ExpertView/index.tsx
import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { TimelineNode } from '@/components/views/expertView/timelineNode';

export function ExpertView() {
	const { uiState, getVisibleNodes, navigateToNode } = useConversationTimelineContext();
	const visibleNodes = getVisibleNodes();

	if (!uiState.selectedExpert) return null;

	return (
		<div className="relative w-full h-full overflow-hidden p-8">
			{/* Expert header with configuration */}
			<div className="mb-8 p-4 border rounded-lg">
				<h2 className="text-2xl font-bold">{uiState.selectedExpert.name}</h2>
				<p className="text-muted-foreground">{uiState.selectedExpert.domain}</p>
				<p className="mt-2 text-sm">Memory: {uiState.selectedExpert.longTermMemory}</p>
			</div>

			{/* Timeline visualization - will be replaced with subway map style */}
			<div className="relative">
				{/* Main vertical line */}
				<div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />

				{/* Nodes */}
				<div className="space-y-8 relative">
					{visibleNodes.map((node) => (
						<TimelineNode
							key={node.id}
							node={node}
							onClick={() => navigateToNode(node.id)}
						/>
					))}
				</div>
			</div>

			{/* TODO: Add branch visualizations */}
			{/* TODO: Add timeline controls */}
			{/* TODO: Add proper subway map styling */}
		</div>
	);
}
