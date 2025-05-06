import { TimelineNode } from '@/lib/types/database';
import { ArrowRight } from 'lucide-react';
import React from 'react';

interface BranchRootProps {
	node: TimelineNode;
	branchColor: string;
}

export const BranchRoot: React.FC<BranchRootProps> = ({
	node,
	branchColor
}) => {
	return (
		<div
			className="relative py-5 z-10 mx-auto w-full max-w-3xl px-16 flex flex-col items-center"
			data-node="branch-root"
			data-id={node.id}
			data-branch={node.branch_id}
		>
			{/* Continuous vertical track that runs through the entire component */}
			<div className="absolute left-1/2 top-0 bottom-0 transform -translate-x-1/2 z-0" style={{ width: "2.5px", background: branchColor }} />

			<div className="flex items-center justify-center w-full relative py-4">
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
			</div>
		</div>
	);
};