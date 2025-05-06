import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TimelineNode } from '@/lib/types/database';
import { ArrowLeftCircle, ArrowRightCircle, GitBranch, SwitchCamera } from 'lucide-react';
import React from 'react';
import { BranchPointInfo } from '../conversationView';

interface BranchPointProps {
	node: TimelineNode;
	branchPointInfo: BranchPointInfo;
	currentBranchId: string | null;
	getBranchName: (branchId: string) => string | null;
	switchBranch: (branchId: string) => void;
}

export const BranchPoint: React.FC<BranchPointProps> = ({
	node,
	branchPointInfo,
	currentBranchId,
	getBranchName,
	switchBranch
}) => {
	// Extract branch information
	const leftBranch = branchPointInfo.branches.left;
	const rightBranch = branchPointInfo.branches.right;

	// Determine which branch we're currently on
	const isOnParentBranch = currentBranchId == null || currentBranchId === branchPointInfo.parentBranchId;

	const isOnLeftBranch = currentBranchId === leftBranch?.branchId;
	const isOnRightBranch = currentBranchId === rightBranch?.branchId;

	// Determine the current branch color (for the bottom track)
	const currentBranchColor = isOnParentBranch
		? branchPointInfo.parentBranchColor
		: isOnLeftBranch
			? leftBranch?.branchColor
			: isOnRightBranch
				? rightBranch?.branchColor
				: branchPointInfo.parentBranchColor;

	return (
		<div
			className="relative py-6 z-10 mx-auto w-full max-w-3xl px-16 flex flex-col items-center"
			data-node="branch-point"
			data-id={node.id}
			data-branch={node.branch_id}
			data-parent-branch={branchPointInfo.parentBranchId}
			data-left-branch={leftBranch?.branchId || null}
			data-right-branch={rightBranch?.branchId || null}
			data-current-view={
				isOnParentBranch ? 'parent' :
					isOnLeftBranch ? 'left' :
						isOnRightBranch ? 'right' : 'unknown'
			}
		>
			{!isOnParentBranch && (
				<div className="absolute transform z-20">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="h-6 w-6 bg-white shadow-sm border rounded-full"
									onClick={(e) => {
										e.stopPropagation();
										switchBranch(branchPointInfo.parentBranchId);
									}}
									style={{
										color: branchPointInfo.parentBranchColor,
										borderColor: `${branchPointInfo.parentBranchColor}60`,
									}}
								>
									<SwitchCamera className="h-3 w-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top">
								<p>Return to main branch</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			)}
			{/* Top track - always parent branch color coming in */}
			<div
				className="absolute left-1/2 top-0 transform -translate-x-1/2 z-0"
				style={{
					width: "2.5px",
					background: branchPointInfo.parentBranchColor,
					height: "50%"
				}}
			/>

			{/* Bottom track - color of the currently viewed branch */}
			<div
				className="absolute left-1/2 bottom-0 transform -translate-x-1/2 z-0"
				style={{
					width: "2.5px",
					background: currentBranchColor,
					height: "50%"
				}}
			/>

			<div className="flex items-center justify-center w-full relative py-8">
				{/* Branch point node */}
				<div
					className="rounded-full border-3 bg-background size-14 flex items-center justify-center shadow-lg relative z-20"
					style={{
						borderColor: branchPointInfo.parentBranchColor,
						boxShadow: `0 0 0 4px white, 0 0 0 5px ${branchPointInfo.parentBranchColor}30`
					}}
				>
					<GitBranch className="size-6" style={{ color: branchPointInfo.parentBranchColor }} />
				</div>

				{/* Left branch - only show if it exists and we're not currently on it */}
				{leftBranch && !isOnLeftBranch && (
					<div className="absolute right-1/2 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
						<div className="relative">
							{/* Horizontal branch line to the left */}
							<div
								className="absolute h-[2.5px]"
								style={{
									background: leftBranch.branchColor,
									borderTopLeftRadius: '4px',
									width: 'calc(50vw - 20px)',
									right: '-10px',
									top: '-1.5px',
									zIndex: 1
								}}
							/>

							{/* Switch to left branch button - now positioned on top of track */}
							<div className="absolute transform -translate-y-1/2 pointer-events-auto" style={{ right: '80px', zIndex: 2 }}>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="outline"
												size="icon"
												className="h-6 w-6 bg-white shadow-sm border rounded-full"
												onClick={(e) => {
													e.stopPropagation();
													switchBranch(leftBranch.branchId);
												}}
												style={{
													color: leftBranch.branchColor,
													borderColor: leftBranch.branchColor,
												}}
											>
												<ArrowLeftCircle className="h-3 w-3" />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="top">
											<p>Switch to {leftBranch.branchName || 'left branch'}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>
					</div>
				)}

				{/* Right branch - only show if it exists and we're not currently on it */}
				{rightBranch && !isOnRightBranch && (
					<div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
						<div className="relative">
							{/* Horizontal branch line to the right */}
							<div
								className="absolute h-[2.5px]"
								style={{
									background: rightBranch.branchColor,
									borderTopRightRadius: '4px',
									width: 'calc(50vw - 20px)',
									left: '-10px',
									top: '-1.5px',
									zIndex: 1
								}}
							/>

							{/* Switch to right branch button - now positioned on top of track */}
							<div className="absolute transform -translate-y-1/2 pointer-events-auto" style={{ left: '80px', zIndex: 2 }}>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="outline"
												size="icon"
												className="h-6 w-6 bg-white shadow-sm border rounded-full"
												onClick={(e) => {
													e.stopPropagation();
													switchBranch(rightBranch.branchId);
												}}
												style={{
													color: rightBranch.branchColor,
													borderColor: rightBranch.branchColor,
												}}
											>
												<ArrowRightCircle className="h-3 w-3" />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="top">
											<p>Switch to {rightBranch.branchName || 'right branch'}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Visual label with branch info */}
			<div
				className="absolute top-1 right-3 text-xs font-medium px-2 py-1 rounded-full bg-background/80 border z-10"
				style={{
					borderColor: `${branchPointInfo.parentBranchColor}40`,
					color: branchPointInfo.parentBranchColor
				}}
			>
				{isOnParentBranch ? 'Branch junction' : 'Branch point'}
			</div>
		</div>
	);
};