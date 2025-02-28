import React from 'react';
import { Train } from 'lucide-react';
import { TrackSegment } from './trackSegment';

interface ProjectRootProps {
  branchColor: string;
}

export const ProjectRoot: React.FC<ProjectRootProps> = ({
  branchColor
}) => {
  return (
    <div className="relative flex justify-center py-8 mb-2" data-node="project-root">
      <div
        className="size-14 rounded-full flex items-center justify-center border-3 shadow-md bg-background z-10 relative"
        style={{ borderColor: branchColor }}
      >
        <Train className="size-7" style={{ color: branchColor }} />
      </div>
      
      {/* Track segment below */}
      <TrackSegment 
        color={branchColor}
        height="50px"
        position="below"
      />
    </div>
  );
}; 