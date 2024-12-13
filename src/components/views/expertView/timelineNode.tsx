import { ConversationNode } from '@/lib/types/chat';

interface TimelineNodeProps {
	node: ConversationNode;
	onClick: () => void;
}

export function TimelineNode({ node, onClick }: TimelineNodeProps) {
	return (
		<div
			className="relative flex items-center justify-center cursor-pointer group"
			onClick={onClick}
		>
			{/* Node circle */}
			<div className="w-4 h-4 rounded-full bg-primary group-hover:scale-110 transition-transform" />

			{/* Summary */}
			<div className="absolute left-[calc(50%+2rem)] bg-card p-2 rounded-lg border shadow-sm">
				<p className="text-sm">{node.summary}</p>
				{node.branchNodeIds.length > 0 && (
					<span className="text-xs text-muted-foreground">
						{node.branchNodeIds.length} branches
					</span>
				)}
			</div>

			{/* TODO: Add branch indicators */}
			{/* TODO: Add hover preview */}
			{/* TODO: Add active state */}
		</div>
	);
}