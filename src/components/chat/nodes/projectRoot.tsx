import { Train } from 'lucide-react';
import React from 'react';

interface ProjectRootProps {
	branchColor: string;
}

export const ProjectRoot: React.FC<ProjectRootProps> = ({
	branchColor
}) => {
	return (
		<div
			className="relative py-5 z-10 mx-auto w-full max-w-3xl px-16 flex flex-col items-center"
			data-node="project-root"
		>
			{/* Continuous track for the bottom half only (since this is the start of a conversation) */}
			<div
				className="absolute left-1/2 top-1/2 bottom-0 transform -translate-x-1/2 z-0"
				style={{ width: "2.5px", background: branchColor }}
			/>

			<div className="flex items-center justify-center w-full relative py-4">
				<div
					className="size-14 rounded-full flex items-center justify-center border-3 shadow-md bg-background z-10 relative"
					style={{ borderColor: branchColor }}
				>
					<Train className="size-7" style={{ color: branchColor }} />
				</div>
			</div>
		</div>
	);
}; 