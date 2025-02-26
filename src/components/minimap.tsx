"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { TimelineNode } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Train, GitBranch, ZoomIn, ZoomOut, List, MapPin } from 'lucide-react';

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

// Enhance the branch label helper function
function getBranchLabel(branch: Branch, nodes: TimelineNode[], index: number): string {
  // Default label is based on index
  let label = `Branch ${index + 1}`;
  
  try {
    // Find the first message in the branch to use as a label
    const firstMessage = nodes.find(node => 
      node.branch_id === branch.id && 
      node.type === 'message' &&
      typeof node.content === 'object' && 
      node.content !== null
    );

    if (firstMessage && typeof firstMessage.content === 'object') {
      // Use the first few words of the first message as the label
      const content = firstMessage.content as any;
      let text = '';
      
      if (content.text) {
        text = content.text;
      } else if (typeof content === 'string') {
        text = content;
      }
      
      if (text) {
        // Get first 3-5 words
        const words = text.split(' ').slice(0, 4);
        label = words.join(' ');
        if (label.length > 25) {
          label = label.substring(0, 25) + '...';
        }
      }
    }
    
    console.log(`🔍 DEBUG: Created branch label "${label}" for branch ${branch.id}`);
    return label;
  } catch (error) {
    console.error(`🔍 DEBUG: Error creating branch label for branch ${branch.id}:`, error);
    return label;
  }
}

export function Minimap({ projectId, currentBranchId, onSelectBranch }: MinimapProps) {
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "subway">("subway");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Add lifecycle debugging
  useEffect(() => {
    console.log('🔍 DEBUG: Minimap mounted with projectId:', projectId, 'currentBranchId:', currentBranchId);
    return () => console.log('🔍 DEBUG: Minimap unmounted');
  }, [projectId, currentBranchId]);

  // Log when branches or nodes change
  useEffect(() => {
    console.log(`🔍 DEBUG: Minimap has ${branches.length} branches and ${nodes.length} nodes`);
  }, [branches, nodes]);

  const fetchData = useCallback(async () => {
    console.log('🔍 DEBUG: Minimap fetchData called for project:', projectId);
    if (!projectId) {
      console.log('🔍 DEBUG: No projectId provided, skipping fetch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all nodes for the project using the complete_tree parameter
      const url = `/api/nodes?project_id=${projectId}&complete_tree=true`;
      console.log('🔍 DEBUG: Fetching nodes from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`🔍 DEBUG: Received ${data.length} nodes:`, data);
      
      // Extract branches from nodes
      const branchMap = new Map<string, Branch>();
      
      data.forEach((node: TimelineNode) => {
        const branchId = node.branch_id;
        
        if (!branchMap.has(branchId)) {
          console.log(`🔍 DEBUG: Adding new branch: ${branchId}`);
          branchMap.set(branchId, {
            id: branchId,
            nodes: [],
            parentId: null, // Default to null, will be updated later if needed
            label: `Branch ${branchMap.size + 1}`, // Default label
            depth: branchMap.size, // Depth based on order of discovery
            color: getBranchColor(branchMap.size) // Generate color based on depth
          });
        }
        
        const branch = branchMap.get(branchId);
        if (branch) {
          branch.nodes.push(node);
        }
      });
      
      // Convert Map to array and sort
      const branchesArray = Array.from(branchMap.values());
      console.log(`🔍 DEBUG: Created ${branchesArray.length} branches from nodes`);
      
      // Add more detailed node information
      data.forEach((node: TimelineNode, index: number) => {
        console.log(`🔍 DEBUG: Node ${index}: id=${node.id.substring(0, 8)}, type=${node.type}, branch=${node.branch_id.substring(0, 8)}`);
        if (node.parent_id) {
          console.log(`🔍 DEBUG: Node ${node.id.substring(0, 8)} has parent ${node.parent_id.substring(0, 8)}`);
        }
      });
      
      setNodes(data);
      setBranches(branchesArray);
    } catch (error: any) {
      console.error('🔍 DEBUG: Error fetching minimap data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    console.log('🔍 DEBUG: Minimap fetchData effect triggered');
    fetchData();
  }, [fetchData, projectId]);

  // Function to handle branch selection
  const handleBranchSelect = (branchId: string) => {
    console.log(`🔍 DEBUG: Minimap branch selected: ${branchId}`);
    onSelectBranch(branchId);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 space-y-2">
        <div className="animate-pulse h-3 w-36 bg-muted rounded-full"></div>
        <div className="animate-pulse h-2 w-24 bg-muted rounded-full"></div>
        <div className="animate-pulse h-3 w-32 bg-muted rounded-full mt-4"></div>
        <div className="animate-pulse h-2 w-28 bg-muted rounded-full"></div>
        <p className="text-sm text-muted-foreground mt-4">Loading subway map...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-md overflow-hidden bg-muted/10">
      <div className="flex items-center justify-between p-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Train className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Navigation Map</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('list')}
          >
            <List className="h-3.5 w-3.5 mr-1" />
            List
          </Button>
          <Button 
            variant={viewMode === 'subway' ? 'secondary' : 'ghost'} 
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('subway')}
          >
            <Train className="h-3.5 w-3.5 mr-1" />
            Map
          </Button>
          
          {viewMode === 'subway' && (
            <div className="flex items-center ml-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))}
              >
                <ZoomOut className="h-3.5 w-3.5" />
                <span className="sr-only">Zoom out</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 w-7 p-0 ml-1"
                onClick={() => setZoomLevel(z => Math.min(2, z + 0.1))}
              >
                <ZoomIn className="h-3.5 w-3.5" />
                <span className="sr-only">Zoom in</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <GitBranch className="h-8 w-8 text-muted-foreground opacity-70 mb-2" />
            <p className="text-muted-foreground text-sm mb-1">No conversation branches yet</p>
            <p className="text-xs text-muted-foreground">Start a conversation to create your subway map</p>
          </div>
        ) : viewMode === 'list' ? (
          <ScrollArea className="h-full py-2">
            <div className="space-y-4 px-3">
              {branches.map((branch) => {
                const isActiveBranch = branch.id === currentBranchId || 
                  branch.nodes.some(n => n.id === currentBranchId);
                
                return (
                  <div key={branch.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: branch.color }}
                      ></div>
                      <h4 className="text-sm font-medium">{branch.label}</h4>
                    </div>
                    
                    <div className="pl-5 border-l-2 ml-1.5 space-y-1 pt-1" style={{ borderColor: branch.color }}>
                      {branch.nodes.map((node) => {
                        if (node.type !== 'message') return null;
                        
                        try {
                          const content = JSON.parse(typeof node.content === 'string' ? node.content : JSON.stringify(node.content));
                          const isNodeActive = node.id === currentBranchId;
                          
                          // Only show user messages in the list view for clarity
                          if (content.role !== 'user') return null;
                          
                          return (
                            <Button
                              key={node.id}
                              variant={isNodeActive ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                "justify-start text-xs py-1 h-auto w-full text-left font-normal truncate",
                                isNodeActive && "bg-primary/10 text-primary"
                              )}
                              onClick={() => handleBranchSelect(node.branch_id)}
                            >
                              {content.text.length > 30
                                ? content.text.slice(0, 30) + '...'
                                : content.text}
                            </Button>
                          );
                        } catch (e) {
                          return null;
                        }
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div
            className="h-full overflow-hidden relative"
            onMouseDown={(e) => {
              if (e.button === 0) { // Left click only
                setIsDragging(true);
                setDragStart({ x: e.clientX, y: e.clientY });
              }
            }}
            onMouseMove={(e) => {
              if (isDragging) {
                setPanOffset({
                  x: panOffset.x + (e.clientX - dragStart.x) / zoomLevel,
                  y: panOffset.y + (e.clientY - dragStart.y) / zoomLevel
                });
                setDragStart({ x: e.clientX, y: e.clientY });
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox="0 0 300 500"
              className={cn(
                "subway-map transition-transform duration-200", 
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                touchAction: 'none' // Prevents default touch actions like scrolling
              }}
            >
              <defs>
                <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              
              {/* Main branch - vertical line with stations */}
              {branches[0] && (
                <g className={cn(
                  "subway-line transition-opacity duration-300",
                  branches[0].id === currentBranchId ? "opacity-100" : "opacity-80 hover:opacity-100"
                )}>
                  {/* Main line */}
                  <path
                    d={`M 150,50 L 150,${50 + branches[0].nodes.length * 60}`}
                    fill="none"
                    stroke={branches[0].color}
                    strokeWidth={branches[0].id === currentBranchId ? 12 : 8}
                    strokeLinecap="round"
                    filter="url(#glow)"
                    className="transition-all duration-300"
                  />
                  
                  {/* Starting station with label */}
                  <g transform="translate(150, 50)">
                    <circle 
                      r={14} 
                      fill="white" 
                      stroke={branches[0].color}
                      strokeWidth={4}
                      filter="url(#glow)"
                    />
                    <text 
                      x="-18" 
                      y="-18" 
                      fontSize="12" 
                      fontWeight="bold"
                      textAnchor="end" 
                      fill={branches[0].color}
                    >
                      Start
                    </text>
                  </g>
                  
                  {/* Stations (nodes) */}
                  {branches[0].nodes.map((node, index) => {
                    if (node.type !== 'message') return null;
                    
                    try {
                      const content = JSON.parse(typeof node.content === 'string' ? node.content : JSON.stringify(node.content));
                      if (content.role !== 'user') return null; // Only show user message stations
                      
                      const y = 80 + index * 60;
                      const isNodeActive = node.branch_id === currentBranchId;
                      
                      return (
                        <g 
                          key={node.id}
                          transform={`translate(150, ${y})`}
                          className={cn(
                            "cursor-pointer transition-all duration-300 group",
                            isNodeActive ? "scale-105" : "hover:scale-105"
                          )}
                          onClick={() => handleBranchSelect(node.branch_id)}
                        >
                          <circle 
                            r={isNodeActive ? 12 : 8} 
                            fill="white" 
                            stroke={branches[0].color}
                            strokeWidth={isNodeActive ? 4 : 2}
                            filter="url(#glow)"
                            className="transition-all duration-300"
                          />
                          
                          {/* Current location marker */}
                          {isNodeActive && (
                            <circle 
                              r={4}
                              fill={branches[0].color}
                              className="animate-pulse"
                            />
                          )}
                          
                          {/* Station name with background for readability */}
                          <rect
                            x="16"
                            y="-12"
                            width={Math.min(content.text.length * 5, 150)}
                            height="24"
                            fill="white"
                            stroke={branches[0].color}
                            strokeWidth="1"
                            rx="4"
                            ry="4"
                            opacity={isNodeActive ? 1 : 0.9}
                            className={cn(
                              "transition-opacity duration-300",
                              isNodeActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                          />
                          <text 
                            x="20" 
                            y="4" 
                            fontSize="11" 
                            fontWeight={isNodeActive ? "bold" : "normal"}
                            textAnchor="start" 
                            fill={isNodeActive ? branches[0].color : "black"}
                            className={cn(
                              "transition-opacity duration-300",
                              isNodeActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                          >
                            {content.text.length > 25
                              ? content.text.slice(0, 25) + '...'
                              : content.text}
                          </text>
                        </g>
                      );
                    } catch (e) {
                      return null;
                    }
                  })}
                </g>
              )}
              
              {/* Branch lines */}
              {branches.slice(1).map((branch, branchIndex) => {
                const isActiveBranch = branch.id === currentBranchId || 
                  branch.nodes.some(n => n.id === currentBranchId);
                  
                // Branch lines come out at angles with curved paths
                const parentNode = branches[0].nodes.find(n => n.id === branch.parentId);
                const parentIndex = parentNode ? branches[0].nodes.indexOf(parentNode) : 0;
                const branchStartY = 80 + parentIndex * 60;
                
                // Alternate branch sides based on index for better readability
                const isLeft = branchIndex % 2 === 0;
                const branchOffsetX = isLeft ? -100 : 100;
                const endX = 150 + branchOffsetX;
                const controlPointX = 150 + (branchOffsetX * 0.5);
                
                return (
                  <g 
                    key={branch.id} 
                    className={cn(
                      "subway-line transition-all duration-300",
                      isActiveBranch ? "opacity-100" : "opacity-70 hover:opacity-100"
                    )}
                  >
                    {/* Connection point marker */}
                    <circle
                      cx="150"
                      cy={branchStartY}
                      r="6"
                      fill={branch.color}
                      stroke="white"
                      strokeWidth="2"
                      filter="url(#glow)"
                    />
                    
                    {/* Branch label */}
                    <rect
                      x={isLeft ? endX - 120 : endX + 10}
                      y={branchStartY - 40}
                      width={Math.min(branch.label.length * 7, 100)}
                      height="20"
                      rx="10"
                      ry="10"
                      fill={branch.color}
                      opacity="0.9"
                      filter="url(#glow)"
                    />
                    <text
                      x={isLeft ? endX - 60 : endX + 60}
                      y={branchStartY - 27}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="white"
                    >
                      {branch.label}
                    </text>
                    
                    {/* Curved connector for branch */}
                    <path
                      d={`M 150,${branchStartY} C ${controlPointX},${branchStartY} ${controlPointX},${branchStartY + 50} ${endX},${branchStartY + 50}`}
                      fill="none"
                      stroke={branch.color}
                      strokeWidth={isActiveBranch ? 10 : 6}
                      strokeLinecap="round"
                      filter="url(#glow)"
                      className="transition-all duration-300"
                    />
                    
                    {/* Vertical segment for branch */}
                    <path
                      d={`M ${endX},${branchStartY + 50} L ${endX},${branchStartY + 50 + (branch.nodes.length * 40)}`}
                      fill="none"
                      stroke={branch.color}
                      strokeWidth={isActiveBranch ? 10 : 6}
                      strokeLinecap="round"
                      filter="url(#glow)"
                      className="transition-all duration-300"
                    />
                    
                    {/* Stations on branch */}
                    {branch.nodes.map((node, index) => {
                      if (node.type !== 'message') return null;
                      
                      try {
                        const content = JSON.parse(typeof node.content === 'string' ? node.content : JSON.stringify(node.content));
                        if (content.role !== 'user') return null; // Only show user message stations
                        
                        const y = branchStartY + 50 + index * 40;
                        const isNodeActive = node.id === currentBranchId;
                        
                        return (
                          <g 
                            key={node.id}
                            transform={`translate(${endX}, ${y})`}
                            className={cn(
                              "cursor-pointer transition-all duration-300 group",
                              isNodeActive ? "scale-105" : "hover:scale-105"
                            )}
                            onClick={() => handleBranchSelect(node.branch_id)}
                          >
                            <circle 
                              r={isNodeActive ? 10 : 7} 
                              fill="white" 
                              stroke={branch.color}
                              strokeWidth={isNodeActive ? 3 : 2}
                              filter="url(#glow)"
                              className="transition-all duration-300"
                            />
                            
                            {/* Current location marker */}
                            {isNodeActive && (
                              <circle 
                                r={3}
                                fill={branch.color}
                                className="animate-pulse"
                              />
                            )}
                            
                            {/* Station label background */}
                            <rect
                              x={isLeft ? -125 : 15}
                              y="-10"
                              width={Math.min(content.text.length * 5, 110)}
                              height="20"
                              fill="white"
                              stroke={branch.color}
                              strokeWidth="1"
                              rx="4"
                              ry="4"
                              opacity={isNodeActive ? 1 : 0.9}
                              className={cn(
                                "transition-opacity duration-300",
                                isNodeActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              )}
                            />
                            <text 
                              x={isLeft ? -120 : 20} 
                              y="4" 
                              fontSize="10" 
                              fontWeight={isNodeActive ? "bold" : "normal"}
                              textAnchor={isLeft ? "start" : "start"} 
                              fill={isNodeActive ? branch.color : "black"}
                              className={cn(
                                "transition-opacity duration-300",
                                isNodeActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              )}
                            >
                              {content.text.length > 20
                                ? content.text.slice(0, 20) + '...'
                                : content.text}
                            </text>
                          </g>
                        );
                      } catch (e) {
                        return null;
                      }
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
      
      {viewMode === 'subway' && branches.length > 0 && (
        <div className="border-t p-2 flex justify-between text-xs text-muted-foreground bg-muted/20">
          <div>
            <span className="flex items-center">
              <MapPin className="h-3 w-3 mr-1 text-primary" />
              {currentBranchId ? 'Selected branch active' : 'Main line active'}
            </span>
          </div>
          <div>
            {branches.length} branch{branches.length !== 1 && 'es'} • {Math.floor(zoomLevel * 100)}% zoom
          </div>
        </div>
      )}
    </div>
  );
} 