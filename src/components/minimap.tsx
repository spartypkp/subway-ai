"use client";

import { useEffect, useState, useRef } from 'react';
import { TimelineNode } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Train, GitBranch } from 'lucide-react';

interface MinimapProps {
  projectId: string;
  currentBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
}

interface Branch {
  id: string;
  parentId: string | null;
  label: string;
  nodes: TimelineNode[];
  depth: number;
  color: string;
}

// Generate a color based on branch depth
const getBranchColor = (depth: number): string => {
  const colors = [
    '#3b82f6', // blue-500 (main line)
    '#ef4444', // red-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
  ];
  
  return colors[depth % colors.length];
};

export function Minimap({ projectId, currentBranchId, onSelectBranch }: MinimapProps) {
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [visualMode, setVisualMode] = useState<'list' | 'subway'>('subway');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch all nodes for the project
  useEffect(() => {
    const fetchNodes = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/nodes?project_id=${projectId}&all=true`);
        const data = await response.json();
        setNodes(data);
        organizeBranches(data);
      } catch (error) {
        console.error('Failed to fetch nodes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, [projectId]);

  // Organize nodes into branches
  const organizeBranches = (nodes: TimelineNode[]) => {
    const branches: Branch[] = [];
    const rootNode = nodes.find(n => n.type === 'root');
    
    if (!rootNode) return;

    // Helper function to find all child nodes that form a branch
    const findBranchNodes = (startNodeId: string): TimelineNode[] => {
      const result: TimelineNode[] = [];
      let currentId = startNodeId;
      
      while (currentId) {
        const node = nodes.find(n => n.id === currentId);
        if (!node) break;
        
        result.push(node);
        
        // Find children - if multiple, we have a branch point
        const children = nodes.filter(n => n.parent_id === currentId);
        if (children.length !== 1) break;
        
        currentId = children[0].id;
      }
      
      return result;
    };
    
    // Create main branch starting from root
    const mainBranchStart = nodes.find(n => n.parent_id === rootNode.id);
    if (mainBranchStart) {
      const mainBranchNodes = findBranchNodes(mainBranchStart.id);
      branches.push({
        id: mainBranchStart.id,
        parentId: null,
        label: 'Main Line',
        nodes: mainBranchNodes,
        depth: 0,
        color: getBranchColor(0)
      });
      
      // Find fork points in the main branch
      mainBranchNodes.forEach(node => {
        const children = nodes.filter(n => n.parent_id === node.id && !mainBranchNodes.includes(n));
        children.forEach((child, index) => {
          const branchNodes = findBranchNodes(child.id);
          const branchId = branches.length + 1;
          branches.push({
            id: child.id,
            parentId: node.id,
            label: `Branch ${branchId}`,
            nodes: branchNodes,
            depth: 1,
            color: getBranchColor(branchId)
          });
        });
      });
    }
    
    setBranches(branches);
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading branches...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Subway Map</h3>
        <div className="flex items-center gap-2">
          {visualMode === 'subway' && (
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))}
              >
                <span className="sr-only">Zoom out</span>
                -
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => setZoomLevel(z => Math.min(2, z + 0.1))}
              >
                <span className="sr-only">Zoom in</span>
                +
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                title="Reset view"
              >
                <span className="sr-only">Reset view</span>
                ↻
              </Button>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setVisualMode(mode => mode === 'list' ? 'subway' : 'list')}
            title={`Switch to ${visualMode === 'list' ? 'subway' : 'list'} view`}
          >
            {visualMode === 'list' ? <Train className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {visualMode === 'list' ? (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1">
            {branches.map((branch) => {
              const isActive = currentBranchId === branch.id || 
                branch.nodes.some(n => n.id === currentBranchId);
              
              return (
                <Button
                  key={branch.id}
                  variant="ghost"
                  className={cn(
                    "justify-start h-auto py-2 px-3 text-left",
                    isActive && "bg-muted font-medium"
                  )}
                  onClick={() => onSelectBranch(branch.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: branch.color }}
                    />
                    <span className="truncate">{branch.label}</span>
                    <span 
                      className={cn(
                        "text-xs ml-auto px-1.5 py-0.5 rounded-full",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {branch.nodes.length}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div 
          className="flex-1 bg-muted/20 rounded-md overflow-hidden relative"
          onMouseDown={(e) => {
            setIsDragging(true);
            setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
          }}
          onMouseMove={(e) => {
            if (isDragging) {
              setPanOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
              });
            }
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          <svg 
            ref={svgRef}
            className="w-full h-full transition-transform duration-150 ease-out" 
            viewBox="0 0 300 400" 
            preserveAspectRatio="xMidYMid meet"
            style={{
              transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
          >
            <defs>
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <marker
                id="station-marker"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
              >
                <circle cx="5" cy="5" r="3" fill="white" stroke="currentColor" />
              </marker>
            </defs>
            
            {/* Background grid for visual reference */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(100,100,100,0.1)" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Draw branches as subway lines */}
            {branches.map((branch, branchIndex) => {
              const isActive = currentBranchId === branch.id || 
                branch.nodes.some(n => n.id === currentBranchId);
              
              // Main branch is vertical down the center
              if (branch.depth === 0) {
                return (
                  <g key={branch.id} className="subway-line transition-opacity duration-300">
                    <line 
                      x1="150" 
                      y1="50" 
                      x2="150" 
                      y2="350" 
                      stroke={branch.color}
                      strokeWidth={isActive ? 10 : 8}
                      strokeLinecap="round"
                      opacity={isActive ? 1 : 0.7}
                      filter="url(#glow)"
                      className="transition-all duration-300"
                    />
                    
                    {/* Stations (nodes) */}
                    {branch.nodes.map((node, index) => {
                      if (node.type !== 'message') return null;
                      const y = 80 + index * 40;
                      const nodeIsActive = currentBranchId === node.id;
                      
                      return (
                        <g 
                          key={node.id}
                          transform={`translate(150, ${y})`}
                          className={cn(
                            "cursor-pointer transition-all duration-300",
                            nodeIsActive ? '' : 'opacity-70 hover:opacity-100'
                          )}
                          onClick={() => onSelectBranch(node.id)}
                        >
                          <circle 
                            r={nodeIsActive ? 12 : 10} 
                            fill="white" 
                            stroke={branch.color}
                            strokeWidth={nodeIsActive ? 4 : 2}
                            filter="url(#glow)"
                            className="transition-all duration-300"
                          />
                          
                          {/* Station name with background for readability */}
                          <rect
                            x="14"
                            y="-10"
                            width="100"
                            height="20"
                            fill="rgba(255,255,255,0.8)"
                            rx="4"
                            ry="4"
                            className={nodeIsActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity duration-300"}
                          />
                          <text 
                            x="18" 
                            y="4" 
                            fontSize="12" 
                            textAnchor="start" 
                            className="fill-foreground"
                          >
                            {(node.content as any).text?.slice(0, 15)}
                            {(node.content as any).text?.length > 15 ? "..." : ""}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              }
              
              // Branch lines come out at angles with curved paths
              const parentNode = branches[0].nodes.find(n => n.id === branch.parentId);
              const parentIndex = parentNode ? branches[0].nodes.indexOf(parentNode) : 0;
              const branchStartY = 80 + parentIndex * 40;
              
              // Alternate branch sides based on index
              const branchOffsetX = 100 + (branchIndex % 2 === 0 ? -80 : 80);
              const endX = 150 + branchOffsetX;
              
              return (
                <g key={branch.id} className="subway-line transition-opacity duration-300">
                  {/* Connection point marker */}
                  <circle
                    cx="150"
                    cy={branchStartY}
                    r="6"
                    fill={branch.color}
                    stroke="white"
                    strokeWidth="1"
                    filter="url(#glow)"
                    className="transition-all duration-300"
                  />
                  
                  {/* Branch connection curve */}
                  <path 
                    d={`M 150,${branchStartY} C 150,${branchStartY + 20} ${(150 + endX) / 2},${branchStartY + 20} ${endX},${branchStartY + 40}`} 
                    stroke={branch.color}
                    strokeWidth={isActive ? 10 : 8}
                    strokeLinecap="round"
                    fill="none"
                    opacity={isActive ? 1 : 0.7}
                    filter="url(#glow)"
                    className="transition-all duration-300"
                  />
                  
                  {/* Vertical branch line */}
                  <line 
                    x1={endX} 
                    y1={branchStartY + 40} 
                    x2={endX} 
                    y2={branchStartY + 40 + branch.nodes.length * 30} 
                    stroke={branch.color}
                    strokeWidth={isActive ? 10 : 8}
                    strokeLinecap="round"
                    opacity={isActive ? 1 : 0.7}
                    filter="url(#glow)"
                    className="transition-all duration-300"
                  />
                  
                  {/* Branch label */}
                  <rect
                    x={endX - 50}
                    y={branchStartY + 10}
                    width="100"
                    height="20"
                    fill={branch.color}
                    rx="10"
                    ry="10"
                    opacity="0.9"
                  />
                  <text
                    x={endX}
                    y={branchStartY + 25}
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="fill-white"
                  >
                    {branch.label}
                  </text>
                  
                  {/* Branch stations */}
                  {branch.nodes.map((node, index) => {
                    if (node.type !== 'message') return null;
                    const y = branchStartY + 40 + index * 30;
                    const nodeIsActive = currentBranchId === node.id;
                    
                    return (
                      <g 
                        key={node.id}
                        transform={`translate(${endX}, ${y})`}
                        className={cn(
                          "cursor-pointer transition-all duration-300",
                          nodeIsActive ? '' : 'opacity-70 hover:opacity-100'
                        )}
                        onClick={() => onSelectBranch(node.id)}
                      >
                        <circle 
                          r={nodeIsActive ? 12 : 10} 
                          fill="white" 
                          stroke={branch.color}
                          strokeWidth={nodeIsActive ? 4 : 2}
                          filter="url(#glow)"
                          className="transition-all duration-300"
                        />
                        
                        {/* Station name with background for readability */}
                        <rect
                          x={branchIndex % 2 === 0 ? -110 : 14}
                          y="-10"
                          width="100"
                          height="20"
                          fill="rgba(255,255,255,0.8)"
                          rx="4"
                          ry="4"
                          className={nodeIsActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity duration-300"}
                        />
                        <text 
                          x={branchIndex % 2 === 0 ? -18 : 18} 
                          y="4" 
                          fontSize="12" 
                          textAnchor={branchIndex % 2 === 0 ? "end" : "start"} 
                          className="fill-foreground"
                        >
                          {(node.content as any).text?.slice(0, 10)}
                          {(node.content as any).text?.length > 10 ? "..." : ""}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
} 