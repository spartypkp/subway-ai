import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TimelineNode } from '@/lib/types/database';
import { TrackSegment } from './trackSegment';

interface BranchRootProps {
  message: TimelineNode;
  branchColor: string;
}

export const BranchRoot: React.FC<BranchRootProps> = ({
  message,
  branchColor
}) => {
  return (
    <div
      className="relative py-8 z-10" // Less vertical space than branch point
      data-node="branch-root"
      data-id={message.id}
      data-branch={message.branch_id}
    >
      {/* Connection from above */}
      <TrackSegment 
        color={branchColor}
        height="20px"
        width="2px"
        position="above"
      />
      
      <div className="flex items-center justify-center">
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
        
        {/* Connection below */}
        <TrackSegment 
          color={branchColor}
          height="50px"
          width="2px"
          styles={{
            top: 'calc(50% + 20px)',
          }}
        />
      </div>
    </div>
  );
};