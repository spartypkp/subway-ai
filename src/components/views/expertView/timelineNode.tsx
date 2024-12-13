// components/views/ExpertView/TimelineNode.tsx
import { ConversationNode } from '@/lib/types/chat';
import { cn } from '@/lib/utils';

interface TimelineNodeProps {
	node: ConversationNode;
	onClick: () => void;
	isCurrent?: boolean;
	isBranch?: boolean;
}

export function TimelineNode({
	node,
	onClick,
	isCurrent = false,
	isBranch = false
}: TimelineNodeProps) {
	return (
		<div
			className={cn(
				"relative flex items-center justify-center cursor-pointer group",
				"min-h-[2rem]", // Ensure consistent height
				isBranch && "opacity-80" // Slightly fade branch nodes
			)}
			onClick={onClick}
		>
			{/* Node circle */}
			<div className={cn(
				"w-4 h-4 rounded-full",
				"group-hover:scale-110 transition-transform",
				isBranch ? "bg-primary/70" : "bg-primary",
				isCurrent && "ring-2 ring-primary ring-offset-2",
				// Add pulse animation for current node
				isCurrent && "animate-pulse"
			)} />

			{/* Connection lines - only show for branch nodes */}
			{isBranch && (
				<div className="absolute left-0 right-0 h-px bg-primary/50 -translate-y-1/2" />
			)}

			{/* Summary card */}
			<div className={cn(
				"absolute bg-card p-2 rounded-lg border shadow-sm",
				"transition-all duration-200",
				"group-hover:shadow-md",
				// Position differently based on branch status
				isBranch
					? "left-6 w-48"
					: "left-[calc(50%+2rem)] w-56",
				// Add subtle slide animation on hover
				"transform group-hover:translate-x-1"
			)}>
				<p className="text-sm font-medium">{node.summary}</p>

				{/* Show branch count if any exist */}
				{node.branchNodeIds.length > 0 && (
					<div className="mt-1 flex items-center gap-2">
						<span className="text-xs text-muted-foreground">
							{node.branchNodeIds.length} branch{node.branchNodeIds.length > 1 ? 'es' : ''}
						</span>

						{/* Visual branch indicators */}
						<div className="flex gap-0.5">
							{node.branchNodeIds.map((_, i) => (
								<div
									key={i}
									className="w-1 h-1 rounded-full bg-primary/50"
								/>
							))}
						</div>
					</div>
				)}

				{/* Optional metadata - can be expanded based on needs */}
				{node.metadata && node.metadata.branchName && (
					<p className="text-xs text-muted-foreground mt-1">
						Branch: {node.metadata.branchName}
					</p>
				)}
			</div>

			{/* Quick action buttons - only show on hover */}
			<div className={cn(
				"absolute right-2 top-1/2 -translate-y-1/2",
				"opacity-0 group-hover:opacity-100 transition-opacity",
				"flex items-center gap-2"
			)}>
				{/* TODO: Add quick actions like:
          - Create branch
          - Edit summary
          - Delete node (if permitted)
        */}
			</div>
		</div>
	);
}