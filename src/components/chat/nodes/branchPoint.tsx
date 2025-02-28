import React from 'react';
import { GitBranch, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimelineNode } from '@/lib/types/database';
import { TrackSegment } from './trackSegment';
import { BranchPointInfo } from '../conversationView'

interface BranchPointProps {
  message: TimelineNode;
  branchPointInfo: BranchPointInfo;
  currentBranchId: string | null;
  getBranchName: (branchId: string) => string | null;
  switchBranch: (branchId: string) => void;
}

export const BranchPoint: React.FC<BranchPointProps> = ({
  message,
  branchPointInfo,
  currentBranchId,
  getBranchName,
  switchBranch
}) => {
  const isOnChildBranch = currentBranchId === branchPointInfo.childBranchId;
  
  // Determine which branch continues vertically (current branch) and which goes to the side
  const mainLineColor = isOnChildBranch ? branchPointInfo.childBranchColor : branchPointInfo.parentBranchColor;
  const sideLineColor = isOnChildBranch ? branchPointInfo.parentBranchColor : branchPointInfo.childBranchColor;
  const sideLineBranchName = isOnChildBranch ? getBranchName(branchPointInfo.parentBranchId) : getBranchName(branchPointInfo.childBranchId);
  const targetBranchId = isOnChildBranch ? branchPointInfo.parentBranchId : branchPointInfo.childBranchId;

  return (
    <div
      className="relative py-12 z-10"
      data-node="branch-point"
      data-id={message.id}
      data-branch={message.branch_id}
      data-parent-branch={branchPointInfo.parentBranchId}
      data-child-branch={branchPointInfo.childBranchId}
      data-current-view={isOnChildBranch ? 'child' : 'parent'}
    >
      {/* Connection to original branch before the split */}
      <TrackSegment 
        color={branchPointInfo.parentBranchColor}
        height="20px"
        position="above"
      />

      <div className="flex items-center justify-center">
        {/* Branch point node with parent branch color */}
        <div
          className="rounded-full border-3 bg-background size-14 flex items-center justify-center shadow-lg relative z-20"
          style={{
            borderColor: branchPointInfo.parentBranchColor,
            boxShadow: `0 0 0 4px white, 0 0 0 5px ${branchPointInfo.parentBranchColor}30`
          }}
        >
          <GitBranch className="size-6" style={{ color: branchPointInfo.parentBranchColor }} />
        </div>

        {/* Side branch line to the right with target branch color */}
        <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ zIndex: 0 }}>
          <div className="relative">
            {/* Horizontal branch line with target branch color */}
            <div
              className="absolute h-3"
              style={{
                background: sideLineColor,
                borderTopRightRadius: '4px',
                width: 'calc(50vw - 20px)',
                left: '-10px',
                top: '-1.5px',
                zIndex: 0
              }}
            />

            {/* Branch switch button with target branch color */}
            <div className="absolute transform translate-y-8 pointer-events-auto" style={{ left: '40px', zIndex: 1 }}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs bg-white shadow-md border-2 px-4 flex items-center gap-2 font-medium transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  switchBranch(targetBranchId);
                }}
                style={{
                  color: sideLineColor,
                  borderColor: sideLineColor,
                }}
              >
                <SwitchCamera className="h-4 w-4" />
                <span>Switch to {sideLineBranchName || 'branch'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Continuing vertical line (current branch) */}
        <TrackSegment 
          color={mainLineColor}
          height="50px"
          styles={{
            top: 'calc(50% + 28px)',
          }}
        />

        {/* Visual label */}
        <div 
          className="absolute top-20 text-xs font-medium px-2 py-1 rounded-full bg-background/80 border"
          style={{ 
            borderColor: `${branchPointInfo.parentBranchColor}40`, 
            color: branchPointInfo.parentBranchColor 
          }}
        >
          Branch point
        </div>
      </div>
    </div>
  );
};