"use client";

/**
 * Subway Minimap Component
 * 
 * This component visualizes conversation branches as a subway map using ReactFlow.
 * It integrates with SubwayLayoutService to calculate optimal branch positions
 * and avoid overlaps in complex branch hierarchies.
 * 
 * Key features:
 * - Tree-aware layout using the Dagre algorithm
 * - Automatic branch direction assignment
 * - Visual indicators for branch points with multiple children
 * - Responsive scaling for different viewport sizes
 * - Automatic recalculation when branches are added
 * - Manual recalculation option
 * 
 * Layout data flow:
 * 1. On initial load, attempts to fetch layout data from API
 * 2. If layout data exists, it's used for branch positioning
 * 3. If layout data is missing, falls back to basic calculations
 * 4. When layout is recalculated, updates branch metadata in the database
 */

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap as ReactFlowMiniMap,
  Node,
  NodeProps,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Branch, TimelineNode } from '@/lib/types/database';
import { GitBranch, MessageSquare, Train, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BranchLayout } from '@/lib/layout/subwayLayoutService';

interface MinimapProps {
  projectId: string;
  currentBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
}

// Define custom node types
const nodeTypes = {
  stationNode: StationNode,
  rootNode: RootNode,
  branchPointNode: BranchPointNode,
  branchRootNode: BranchRootNode
};

// Generate branch colors - only used as fallback if branch doesn't have a color
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

// Custom node for branch points (where branches diverge)
function BranchPointNode({ data }: NodeProps) {
  // Determine which way the branch is going (left or right)
  const isRightBranch = data.childBranchDirection === 'right';
  
  // Show an indicator if this point has multiple children
  const hasMultipleChildren = data.childCount > 1;
  
  return (
    <div 
      className={cn(
        "p-1 rounded-full shadow-md flex items-center justify-center bg-white transition-all duration-300",
        data.isActive ? "ring-2 ring-offset-1 shadow-lg" : "hover:shadow-md",
        data.isOnActivePath ? "scale-110" : "",
        hasMultipleChildren ? "ring-1 ring-offset-1" : ""
      )}
      style={{ 
        borderColor: data.color,
        border: `2px solid ${data.color}`,
        width: '32px',
        height: '32px',
        background: data.isActive ? '#f8fafc' : 'white',
        boxShadow: data.isOnActivePath ? `0 0 8px rgba(${hexToRgb(data.childBranchColor || data.color)}, 0.5)` : undefined,
      }}
      title={`Branch point to: ${data.childBranchName || 'another branch'}${hasMultipleChildren ? ` (+ ${data.childCount - 1} more)` : ''}`}
    >
      <GitBranch size={16} style={{ color: data.color, transform: isRightBranch ? 'scaleX(1)' : 'scaleX(-1)' }} />
      
      {/* Show a small indicator for multiple branches */}
      {hasMultipleChildren && (
        <div className="absolute -bottom-1 -right-1 bg-gray-100 rounded-full w-4 h-4 border border-gray-300 flex items-center justify-center">
          <span className="text-[8px] font-bold text-gray-700">{data.childCount}</span>
        </div>
      )}
      
      <Handle 
        id="target-main"
        type="target" 
        position={Position.Top} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          top: '-4px', // Position exactly at the top center
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }}
      />
      <Handle 
        id="source-main"
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          bottom: '-4px', // Position exactly at the bottom center
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }}
      />
      
      {/* Dynamically place the branch handle based on direction */}
      <Handle 
        id={isRightBranch ? "right" : "left"}
        type="source" 
        position={isRightBranch ? Position.Right : Position.Left} 
        style={{ 
          background: data.childBranchColor || data.color, 
          width: '8px', 
          height: '8px',
          borderWidth: '2px',
          borderColor: 'white',
          [isRightBranch ? 'right' : 'left']: '-4px', // Position exactly at the edge center
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1
        }} 
      />
    </div>
  );
}

// Custom node for branch roots (starting points of new branches)
function BranchRootNode({ data }: NodeProps) {
  // Determine which way the branch is going
  const isRightBranch = data.branchDirection === 'right';
  
  return (
    <div 
      className={cn(
        "p-1 rounded-full shadow-md flex items-center justify-center bg-white transition-all duration-300",
        data.isActive ? "ring-2 ring-offset-1 shadow-lg scale-110" : "hover:shadow-md hover:scale-105",
      )}
      style={{ 
        borderColor: data.color,
        border: `3px solid ${data.color}`, // Thicker border
        width: '28px', // Slightly larger
        height: '28px',
        background: data.isActive ? '#f8fafc' : 'white', // Subtle background change when active
        boxShadow: data.isActive ? `0 0 8px rgba(${hexToRgb(data.color)}, 0.5)` : undefined,
      }}
      title={`Start of branch: ${data.branchName || 'Branch'}`}
    >
      <div className="w-3 h-3 rounded-full" style={{ background: data.color }} />
      
      {/* Direction indicator */}
      <div 
        className="absolute top-full mt-3 text-[9px] font-bold opacity-70" 
        style={{ color: data.color }}
      >
        {isRightBranch ? '→' : '←'}
      </div>
      
      <Handle 
        id="left"
        type="target" 
        position={Position.Left} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          left: '-4px', // Position exactly at the left center
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1
        }} 
      />
      <Handle 
        id="target-center"
        type="target" 
        position={Position.Top} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          top: '-4px', // Position exactly at the top center
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }} 
      />
      <Handle 
        id="source-center"
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          bottom: '-4px', // Position exactly at the bottom center
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }} 
      />
      
      {data.branchName && (
        <div className="absolute top-full mt-1 text-[11px] whitespace-nowrap font-semibold" style={{ color: data.color }}>
          {data.branchName}
        </div>
      )}
    </div>
  );
}

// Custom node for stations (message pairs)
function StationNode({ data, selected }: NodeProps) {
  const isActive = data.isActive;
  const [isHovering, setIsHovering] = useState(false);
  
  // Determine node size based on content length
  const hasUserContent = !!data.userContent;
  const hasAssistantContent = !!data.assistantContent;
  const contentLength = (data.userContent?.length || 0) + (data.assistantContent?.length || 0);
  
  // Much wider nodes for better visualization
  const getNodeSize = () => {
    // Use significantly wider nodes for better visualization
    return { 
      width: `${data.calculatedWidth || 140}px`, 
      height: isHovering ? '90px' : '45px' // Expand height on hover
    };
  };
  
  const { width, height } = getNodeSize();
  
  // Format timestamps if available
  const formattedTime = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';
  
  // Get the station number for badge display
  const stationNumber = data.stationNumber || '';
  
  // Prepare tooltip with more extensive content previews
  const tooltipContent = [
    data.userContent ? `User: ${data.userContent.substring(0, 150)}${data.userContent.length > 150 ? '...' : ''}` : '',
    data.assistantContent ? `Assistant: ${data.assistantContent.substring(0, 150)}${data.assistantContent.length > 150 ? '...' : ''}` : ''
  ].filter(Boolean).join('\n\n');
  
  return (
    <div 
      className={cn(
        "px-4 py-2 rounded-lg border-2 flex flex-col items-center justify-center bg-white shadow-md transition-all duration-300",
        isActive ? "shadow-lg scale-110 ring-2 ring-offset-1" : "hover:shadow-lg hover:scale-105",
        selected ? "ring-2 ring-offset-2 ring-primary" : "",
        !hasUserContent && !hasAssistantContent ? "opacity-70" : "",
        "cursor-pointer select-none"
      )}
      style={{ 
        borderColor: data.color,
        width,
        height,
        boxShadow: isActive ? `0 0 8px rgba(${hexToRgb(data.color)}, 0.5)` : undefined,
        transition: 'all 0.2s ease-in-out, height 0.15s ease-in-out',
        overflow: 'hidden'
      }}
      title={tooltipContent}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => {
        // Add subtle feedback on click
        const el = document.activeElement as HTMLElement;
        if (el) el.blur();
      }}
    >
      {/* Normal view */}
      <div className="flex items-center justify-between w-full">
        {/* Left: Station icon with number badge */}
        <div className="flex items-center flex-shrink-0 mr-2 relative">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.color }}
          />
          {stationNumber && (
            <div className="absolute -top-2 -left-2 text-[9px] font-bold" style={{ color: data.color }}>
              {stationNumber}
            </div>
          )}
        </div>
        
        {/* Center: Content preview */}
        <div className="flex-grow overflow-hidden text-center">
          {hasUserContent && (
            <div 
              className={cn(
                "text-xs font-medium truncate text-center",
                isActive ? "font-semibold" : ""
              )}
              style={{ color: data.color }}
            >
              {data.userContent.length > 30 
                ? data.userContent.substring(0, 30) + '...' 
                : data.userContent}
            </div>
          )}
        </div>
        
        {/* Right: Station time */}
        {formattedTime && (
          <div className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
            {formattedTime}
          </div>
        )}
      </div>
      
      {/* Expanded hover content */}
      {isHovering && (
        <div className="w-full mt-2 overflow-hidden animate-fadeIn" style={{ animationDuration: '0.15s' }}>
          <div className="h-px w-full bg-muted mb-2"></div>
          
          {hasUserContent && (
            <div className="text-xs text-left mb-1 text-ellipsis overflow-hidden">
              <span className="font-semibold inline-block">User:</span>{' '}
              <span className="inline-block">{data.userContent.substring(0, 70)}
              {data.userContent.length > 70 ? '...' : ''}</span>
            </div>
          )}
          
          {hasAssistantContent && (
            <div className="text-xs text-left text-muted-foreground text-ellipsis overflow-hidden">
              <span className="font-semibold inline-block">AI:</span>{' '}
              <span className="inline-block">{data.assistantContent.substring(0, 70)}
              {data.assistantContent.length > 70 ? '...' : ''}</span>
            </div>
          )}
          
          {/* Hover action hint */}
          <div className="text-[9px] text-center mt-1 text-muted-foreground">
            Click to navigate to this conversation
          </div>
        </div>
      )}
      
      {/* Station connectors */}
      <Handle 
        id="target-top" 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          top: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
      />
      <Handle 
        id="source-bottom" 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
      />
    </div>
  );
}

// Custom node for root node (start of conversation)
function RootNode({ data }: NodeProps) {
  return (
    <div 
      className={cn(
        "p-2 rounded-full border-2 bg-white shadow-md flex items-center justify-center",
        data.isActive ? "ring-2 ring-offset-1 shadow-lg" : ""
      )}
      style={{ 
        borderColor: data.color,
        border: `3px solid ${data.color}`, // Thicker border
        width: '46px', // Slightly larger
        height: '46px',
        background: data.isActive ? '#f8fafc' : 'white',
      }}
      title={`Project: ${data.projectName || 'Main Project'}`}
    >
      <Train className="text-primary" size={22} />
      <Handle 
        id="source-bottom" 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: data.color, 
          width: '8px', 
          height: '8px',
          bottom: '-4px', // Position exactly at the bottom center
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }} 
      />
      
      {data.projectName && (
        <div className="absolute top-full mt-1 text-xs whitespace-nowrap font-bold">
          {data.projectName}
        </div>
      )}
    </div>
  );
}

// Helper function to convert hex color to RGB values for use in rgba()
function hexToRgb(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert 3-digit hex to 6-digits
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `${r}, ${g}, ${b}`;
}

export function Minimap({ projectId, currentBranchId, onSelectBranch }: MinimapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reactFlowInstance = useReactFlow();
  const [layoutData, setLayoutData] = useState<Record<string, BranchLayout> | null>(null);
  
  // State to track if we're showing the branch labels
  const [showBranchLabels, setShowBranchLabels] = useState(false);
  
  // Transform timeline nodes to React Flow format
  const transformDataToReactFlow = useCallback((data: TimelineNode[], branches: Branch[]) => {
    if (!data.length) return { nodes: [], edges: [] };
    
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    
    // Calculate branch positions
    const branchMap = new Map<string, { 
      depth: number, 
      color: string, 
      nodes: TimelineNode[],
      branch: Branch,
      xPosition: number,
      yOffset: number,
      direction?: 'left' | 'right' // Add direction property
    }>();
    
    // Find the main branch (depth 0)
    const mainBranch = branches.find(b => b.depth === 0);
    if (!mainBranch) {
      console.warn('No main branch found');
      return { nodes: [], edges: [] };
    }
    
    console.log(`Main branch: ${mainBranch.id}, ${mainBranch.name || 'Unnamed'}`);
    
    // Sort branches by depth
    const sortedBranches = [...branches].sort((a, b) => a.depth - b.depth);
    
    // Center position for the visualization
    const centerX = 400; 
    
    // Responsive branch spacing based on viewport width (for fallback calculations)
    const getResponsiveBranchSpacing = () => {
      const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
      if (width < 640) return 180; // Small screens
      if (width < 1024) return 220; // Medium screens
      return 250; // Large screens
    };
    
    const branchSpacing = getResponsiveBranchSpacing();
    
    // Scaling factors for layout coordinates to ReactFlow coordinates
    const xScaleFactor = 1.5;  // Adjust based on visual testing
    const yScaleFactor = 100;  // Vertical spacing between nodes
    
    // Assign positions using layout data when available, fall back to default calculation
    sortedBranches.forEach(branch => {
      let xPosition;
      let yOffset = 0;
      let direction: 'left' | 'right' | undefined = undefined;
      
      // If we have layout data for this branch, use it
      if (layoutData && layoutData[branch.id]) {
        const layout = layoutData[branch.id];
        
        // Apply proper coordinate scaling from layout service to ReactFlow
        xPosition = centerX + (layout.x * xScaleFactor);
        yOffset = layout.siblingIndex * 30; // Vertical offset based on sibling index
        
        // Use direction from layout data
        direction = layout.direction as 'left' | 'right';
        
        console.log(`Using layout data for branch ${branch.id}: x=${xPosition}, yOffset=${yOffset}, direction=${direction}`);
      } else {
        // Fall back to the old calculation method
        if (branch.depth === 0) {
          xPosition = centerX; // Main branch in center
          direction = 'right'; // Default direction for main branch
        } else if (branch.depth % 2 === 1) {
          xPosition = centerX + (Math.ceil(branch.depth / 2) * branchSpacing);
          direction = 'right';
        } else {
          xPosition = centerX - (branch.depth / 2 * branchSpacing);
          direction = 'left';
        }
      }
      
      branchMap.set(branch.id, {
        depth: branch.depth,
        color: branch.color || getBranchColor(branch.depth),
        nodes: [],
        branch,
        xPosition,
        yOffset,
        direction
      });
    });
    
    // Group nodes by branch
    data.forEach(node => {
      const branchData = branchMap.get(node.branch_id);
      if (branchData) {
        branchData.nodes.push(node);
      } else {
        console.warn(`No branch found for node ${node.id} (branch_id: ${node.branch_id})`);
      }
    });
    
    // Track active branches (highlighting the current path)
    const activeBranches = new Set<string>();
    if (currentBranchId) {
      // Add the current branch
      activeBranches.add(currentBranchId);
      
      // Find parent branches
      let currentBranch = branches.find(b => b.id === currentBranchId);
      while (currentBranch && currentBranch.parent_branch_id) {
        activeBranches.add(currentBranch.parent_branch_id);
        currentBranch = branches.find(b => b.id === currentBranch?.parent_branch_id);
      }
    } else {
      // If no current branch, highlight main branch
      activeBranches.add(mainBranch.id);
    }
    
    // Find the root node
    const rootNode = data.find(n => n.type === 'root');
    if (!rootNode) {
      console.warn('No root node found in data');
      return { nodes: [], edges: [] };
    }
    
    // Get the project name (if available)
    const projectName = mainBranch.name || 'Main Line';
    
    // Add root node
    const mainBranchData = branchMap.get(mainBranch.id);
    if (!mainBranchData) {
      console.warn('Main branch data not found');
      return { nodes: [], edges: [] };
    }
    
    // Add root node at the top of the main branch - ENSURE perfect X alignment with stations
    // Root node is 46px wide, so adjust x position to center it on the branch line
    flowNodes.push({
      id: rootNode.id,
      type: 'rootNode',
      position: { 
        x: mainBranchData.xPosition - 23, // Center the 46px wide root node
        y: 50 
      },
      data: {
        color: mainBranchData.color,
        branchId: mainBranch.id,
        isActive: activeBranches.has(mainBranch.id),
        projectName
      }
    });
    
    // Process branch connections first (to establish the subway layout)
    const branchConnections: {
      branchPointId: string,
      branchRootId: string,
      parentBranchId: string,
      childBranchId: string,
      position: number,
      branchPointNode: TimelineNode, // Store the branch point node reference
      direction?: 'left' | 'right' // Add direction from layout
    }[] = [];
    
    // Find all branch connections
    branches.forEach(branch => {
      if (branch.parent_branch_id && branch.branch_point_node_id) {
        // Find the branch point node
        const branchPointNode = data.find(n => n.id === branch.branch_point_node_id);
        if (!branchPointNode) return;
        
        // Find the branch root node in this branch
        const branchRootNode = data.find(n => 
          n.type === 'branch-root' && n.branch_id === branch.id
        );
        if (!branchRootNode) return;
        
        // Get direction from layout data if available
        let direction: 'left' | 'right' | undefined = undefined;
        if (layoutData && layoutData[branch.id]) {
          direction = layoutData[branch.id].direction as 'left' | 'right';
        }
        
        branchConnections.push({
          branchPointId: branch.branch_point_node_id,
          branchRootId: branchRootNode.id,
          parentBranchId: branch.parent_branch_id,
          childBranchId: branch.id,
          position: branchPointNode.position,
          branchPointNode,
          direction
        });
      }
    });
    
    // Process each branch to create subway lines with stations
    branchMap.forEach((branchData, branchId) => {
      const { xPosition, color, nodes: branchNodes, branch } = branchData;
      const isActive = activeBranches.has(branchId);
      const isMainBranch = branchId === mainBranch.id;
      
      // This is the true center position of this branch line
      const branchCenterX = xPosition;
      
      // Get branch name
      const branchName = branch.name || `Branch ${branch.depth}`;
      
      // Sort all nodes by position
      const sortedNodes = [...branchNodes].sort((a, b) => a.position - b.position);
      
      // Find specific node types
      const branchRoot = sortedNodes.find(n => n.type === 'branch-root');
      
      // Filter for just message nodes and branch points
      const messageNodes = sortedNodes.filter(n => 
        n.type === 'user-message' || n.type === 'assistant-message' || n.type === 'branch-point'
      );
      
      // Create "stations" from the messages
      // A station can be:
      // 1. A user message with its corresponding assistant response
      // 2. A branch point (which appears on the parent branch)
      // 3. A solo user message (if no response)
      // 4. A solo assistant message (rare edge case)
      
      const stations: {
        position: number,
        yPosition: number,
        id: string,
        userMessage?: TimelineNode,
        assistantMessage?: TimelineNode,
        branchPoint?: TimelineNode
      }[] = [];
      
      // Track processed nodes to avoid duplicates
      const processedNodes = new Set<string>();
      
      // Process message pairs and branch points
      messageNodes.forEach(node => {
        // Skip if already processed
        if (processedNodes.has(node.id)) return;
        
        // Mark this node as processed
        processedNodes.add(node.id);
        
        if (node.type === 'branch-point') {
          // Add branch point as its own station
          stations.push({
            position: node.position,
            yPosition: 150 + (node.position * 100),
            id: node.id,
            branchPoint: node
          });
        } else if (node.type === 'user-message') {
          // Find corresponding assistant message (if any)
          const assistantMessage = messageNodes.find(n => 
            n.type === 'assistant-message' && n.parent_id === node.id
          );
          
          // If found, mark it as processed
          if (assistantMessage) {
            processedNodes.add(assistantMessage.id);
          }
          
          stations.push({
            position: node.position,
            yPosition: 150 + (node.position * 100),
            id: node.id,
            userMessage: node,
            assistantMessage
          });
        } else if (node.type === 'assistant-message' && !processedNodes.has(node.id)) {
          // Handle solo assistant messages
          stations.push({
            position: node.position,
            yPosition: 150 + (node.position * 100),
            id: node.id,
            assistantMessage: node
          });
        }
      });
      
      // Sort stations by position
      stations.sort((a, b) => a.position - b.position);

      // Apply vertical offset to branch root position
      let branchRootYPosition = 150; // Default Y position
      if (branchRoot) {
        // Find the matching branch connection
        const connection = branchConnections.find(c => c.branchRootId === branchRoot.id);
        
        if (connection) {
          // Calculate branch root Y position (same as the branch point)
          branchRootYPosition = 150 + (connection.position * 100);
          
          // Add the branch root node - BranchRootNode is 28px wide
          flowNodes.push({
            id: branchRoot.id,
            type: 'branchRootNode',
            position: { 
              x: xPosition - 14, // Center the 28px wide branch root
              y: branchRootYPosition 
            },
            data: {
              color,
              branchId,
              isActive,
              branchName: branch.metadata?.siblingInfo 
                ? `${branchName} ${branch.metadata.siblingInfo}` 
                : branchName,
              branchDirection: branchData.direction || // First use branch data from layout
                              connection.direction || // Then connection direction from layout
                              (branchData.xPosition > mainBranchData.xPosition ? 'right' : 'left') // Fallback calculation
            }
          });
        }
      }
      
      // Add station nodes and connect them with straight lines
      let previousNodeId: string | undefined = undefined;
      let previousNodeType: string | undefined = undefined;
      
      // If this is the main branch, start from the root
      if (branchId === mainBranch.id) {
        previousNodeId = rootNode.id;
        previousNodeType = 'rootNode';
      } 
      // If this is a child branch, start from the branch root
      else if (branchRoot) {
        previousNodeId = branchRoot.id;
        previousNodeType = 'branchRootNode';
      }

      // For child branches, adjust station Y positions to start below the branch root
      // This ensures child branch stations are properly positioned in relation to the branch root
      if (branchId !== mainBranch.id && branchRoot) {
        // Get any vertical offset that was applied to this branch
        const verticalOffset = branchData.yOffset || 0;
        
        // Recalculate Y positions for stations in child branches
        stations.forEach((station, index) => {
          // Start positioning stations below the branch root with proper spacing
          // Add a little extra spacing for the first station to create separation from the branch root
          const spacing = index === 0 ? 120 : 100;
          station.yPosition = branchRootYPosition + ((index + 1) * spacing);
        });
      }
      
      // Process stations in order
      stations.forEach((station, index) => {
        if (station.branchPoint) {
          // This is a branch point - add it specifically as a branch point node
          
          // Find the child branch that stems from this branch point
          const childBranchConnection = branchConnections.find(conn => 
            conn.branchPointId === station.branchPoint?.id
          );
          
          if (childBranchConnection) {
            // Get child branch data for styling
            const childBranchData = branchMap.get(childBranchConnection.childBranchId);
            if (!childBranchData) return;
            
            // Use direction from layout service when available, otherwise calculate it
            const branchDirection = childBranchConnection.direction || 
                                    (childBranchData.direction || 
                                    (childBranchData.xPosition > xPosition ? 'right' : 'left'));
            
            // Add branch point node - ENSURE perfect X alignment with parent branch
            flowNodes.push({
              id: station.branchPoint.id,
              type: 'branchPointNode',
              position: { 
                x: xPosition - 16, // Center the 32px wide branch point
                y: station.yPosition 
              },
              data: {
                color: color, // Use THIS branch's color for the branch point
                childBranchColor: childBranchData.color, // Use CHILD branch color for handle/arrow
                branchId: branchId,
                isActive: isActive,
                isOnActivePath: isActive && activeBranches.has(childBranchConnection.childBranchId),
                childBranchName: childBranchData.branch.name || 'Branch',
                childBranchDirection: branchDirection,
                childCount: childBranchData.branch.metadata?.siblingCount || 1,
                siblingIndex: childBranchData.branch.metadata?.siblingIndex || 0
              }
            });
            
            // Connect previous node to branch point - ensure perfectly vertical line
            if (previousNodeId) {
              // Define source handle based on previous node type
              const sourceHandle = (() => {
                if (previousNodeType === 'rootNode') return 'source-bottom';
                if (previousNodeType === 'branchRootNode') return 'source-center';
                if (previousNodeType === 'branchPointNode') return 'source-main';
                return 'source-bottom'; // For station nodes, use consistent bottom handle
              })();
              
              flowEdges.push({
                id: `edge-${previousNodeId}-${station.branchPoint.id}`,
                source: previousNodeId,
                target: station.branchPoint.id,
                sourceHandle: sourceHandle,
                targetHandle: 'target-main',
                type: 'straight',
                style: { 
                  stroke: color, 
                  strokeWidth: isMainBranch ? 4 : 3,
                  strokeLinecap: 'round' as const,
                  opacity: isActive ? 1 : 0.85,
                }
              });
            }
            
            // Add a curved connection from branch point to branch root
            flowEdges.push({
              id: `edge-branch-${station.branchPoint.id}-${childBranchConnection.branchRootId}`,
              source: station.branchPoint.id,
              target: childBranchConnection.branchRootId,
              type: 'default', // Use default bezier curve for smoother transitions
              animated: activeBranches.has(childBranchConnection.childBranchId),
              // Set source and target handles based on branch direction
              sourceHandle: branchDirection === 'right' ? 'right' : 'left',
              targetHandle: 'left',
              style: { 
                stroke: childBranchData.color, 
                strokeWidth: activeBranches.has(childBranchConnection.childBranchId) ? 4 : 3,
                strokeOpacity: activeBranches.has(childBranchConnection.childBranchId) ? 1 : 0.85,
                strokeLinecap: 'round' as const,
                opacity: activeBranches.has(childBranchConnection.childBranchId) ? 1 : 0.85,
                // Add smooth curve effect for a more subway-like appearance
                strokeDasharray: activeBranches.has(childBranchConnection.childBranchId) ? undefined : '0',
              }
            });
            
            // Update previous node
            previousNodeId = station.branchPoint.id;
            previousNodeType = 'branchPointNode';
          }
        } else {
          // Create regular station node for message pairs
          // Calculate a more accurate station width that accounts for content and styling
          const contentLength = (station.userMessage?.message_text?.length || 0) + 
                                (station.assistantMessage?.message_text?.length || 0);
          
          // Calculate width - much wider nodes for better visualization
          // These values should match the actual rendered width in the StationNode component
          let stationWidth = 140; // Base width for all station nodes
          
          // Scale width based on content length, but maintain a reasonable maximum
          if (contentLength > 200) stationWidth = 180;
          else if (contentLength > 100) stationWidth = 160;
          
          // Add extra width for padding and border
          stationWidth += 16; // 8px padding × 2 + 2px border × 2
          
          // Get timestamp if available
          const messageTimestamp = station.userMessage?.created_at || station.assistantMessage?.created_at;
          
          flowNodes.push({
            id: station.id,
            type: 'stationNode',
            position: { 
              x: xPosition - (stationWidth / 2), // Center the station with accurate width
              y: station.yPosition 
            },
            data: {
              color,
              branchId,
              isActive,
              userContent: station.userMessage?.message_text || '',
              assistantContent: station.assistantMessage?.message_text || '',
              timestamp: messageTimestamp,
              calculatedWidth: stationWidth,
              stationNumber: index + 1, // Add station number for reference
              fullData: {
                userMessage: station.userMessage,
                assistantMessage: station.assistantMessage,
              }
            }
          });
          
          // Connect to previous node if exists
          if (previousNodeId) {
            // Determine source handle based on previous node type for perfect alignment
            const sourceHandle = (() => {
              if (previousNodeType === 'rootNode') return 'source-bottom';
              if (previousNodeType === 'branchRootNode') return 'source-center';
              if (previousNodeType === 'branchPointNode') return 'source-main';
              return 'source-bottom'; // For station nodes, use consistent bottom handle
            })();

            flowEdges.push({
              id: `edge-${previousNodeId}-${station.id}`,
              source: previousNodeId,
              target: station.id,
              sourceHandle: sourceHandle,
              targetHandle: 'target-top',
              type: 'straight', // Straight vertical line
              style: { 
                stroke: color, 
                strokeWidth: isMainBranch ? 4 : 3, // Thicker line for main branch
                strokeLinecap: 'round' as const,
                opacity: isActive ? 1 : 0.85, // Slightly fade inactive branches
                filter: isActive ? 'none' : 'saturate(0.9)' // Slightly desaturate inactive branches
              }
            });
          }
          
          // Update previous node
          previousNodeId = station.id;
          previousNodeType = 'stationNode';
        }
      });
    });
    
    return { nodes: flowNodes, edges: flowEdges };
  }, [currentBranchId, layoutData]);
  
  // Fetch layout data for branch positions
  const fetchLayoutData = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/layout`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch layout data');
      }
      
      const layoutInfo = await response.json();
      
      // Transform layout data into a map keyed by branch ID
      const layoutMap: Record<string, BranchLayout> = {};
      layoutInfo.forEach((item: any) => {
        if (item.layout) {
          layoutMap[item.id] = item.layout;
        }
      });
      
      setLayoutData(layoutMap);
      return layoutMap;
    } catch (error) {
      console.error('Error fetching layout data:', error);
      return null;
    }
  }, [projectId]);
  
  // Function to fetch data and update the flow
  const fetchDataAndUpdateFlow = useCallback(async () => {
    console.log('Fetching data for minimap, project:', projectId);
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all branches for this project
      const branchesResponse = await fetch(`/api/projects/${projectId}/branches`);
      if (!branchesResponse.ok) {
        throw new Error(`Failed to fetch branches: ${branchesResponse.status}`);
      }
      const branches = await branchesResponse.json();
      
      // Fetch all nodes for this project
      const nodesResponse = await fetch(`/api/nodes?project_id=${projectId}&limit=1000`);
      if (!nodesResponse.ok) {
        throw new Error(`Failed to fetch nodes: ${nodesResponse.status}`);
      }
      const nodes = await nodesResponse.json();
      
      console.log(`Received ${nodes.length} timeline nodes and ${branches.length} branches`);
      
      const { nodes: flowNodes, edges: flowEdges } = transformDataToReactFlow(nodes, branches);
      
      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error('Failed to fetch minimap data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectId, transformDataToReactFlow]);
  
  // Recalculate layout for all branches
  const recalculateLayout = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/projects/${projectId}/layout`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to recalculate layout');
      }
      
      // Fetch the updated layout data
      await fetchLayoutData();
      
      // Reload branches and nodes data
      await fetchDataAndUpdateFlow();
    } catch (error) {
      console.error('Error recalculating layout:', error);
      setError('Failed to recalculate branch layout');
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchLayoutData, fetchDataAndUpdateFlow]);
  
  // Fetch data effect - modified to use layout service
  useEffect(() => {
    const initialLoad = async () => {
      if (!projectId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // First try to fetch layout data
        await fetchLayoutData();
        // Then load all data
        await fetchDataAndUpdateFlow();
      } catch (error) {
        console.error('Error during initial data load:', error);
        setError('Failed to load subway map data');
      } finally {
        setLoading(false);
      }
    };
    
    initialLoad();
  }, [projectId, fetchLayoutData, fetchDataAndUpdateFlow]);
  
  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.data.branchId) {
      onSelectBranch(node.data.branchId);
    }
  }, [onSelectBranch]);
  
  // Add automatic recalculation when nodes or branches change
  useEffect(() => {
    const checkForLayoutRecalculation = async () => {
      // Only auto-recalculate if:
      // 1. We have nodes loaded
      // 2. We don't have layout data for some branches
      if (nodes.length > 0) {
        // Find branches without layout data
        const branchIdsWithoutLayout = nodes
          .filter(node => node.data.branchId)
          .map(node => node.data.branchId)
          .filter((id, index, self) => self.indexOf(id) === index) // unique only
          .filter(id => !layoutData || !layoutData[id]);
        
        // If we found branches without layout data, trigger a recalculation
        if (branchIdsWithoutLayout.length > 0) {
          console.log(`Found ${branchIdsWithoutLayout.length} branches without layout data, recalculating...`);
          await recalculateLayout();
        }
      }
    };
    
    // Run the check when nodes are updated
    if (nodes.length > 0) {
      checkForLayoutRecalculation();
    }
  }, [nodes, layoutData, recalculateLayout]);
  
  // Loading state
  if (loading && nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="subway-loading-animation mb-6">
          <div className="subway-line"></div>
          <div className="subway-train"></div>
          <div className="subway-station station-1"></div>
          <div className="subway-station station-2"></div>
          <div className="subway-station station-3"></div>
        </div>
        <p className="text-sm text-muted-foreground">Loading subway map...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <MessageSquare className="h-8 w-8 text-destructive mb-2" />
        <p className="text-destructive font-medium">Failed to load subway map</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }
  
  // Find all unique branches represented in the nodes
  const branchColors = new Map<string, { color: string, name?: string }>();
  nodes.forEach(node => {
    if (node.data.branchId && node.data.color) {
      branchColors.set(node.data.branchId, { 
        color: node.data.color,
        name: node.data.branchName || undefined
      });
    }
  });
  
  return (
    <div className="h-full w-full relative">
      <style jsx global>{`
        /* Custom subway-themed background */
        .react-flow__background {
          background-image: 
            linear-gradient(to right, rgba(226, 232, 240, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(226, 232, 240, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        
        /* Fade in animation for hover effects */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation-name: fadeIn;
          animation-duration: 0.3s;
          animation-fill-mode: both;
        }
        
        /* Make edges look more like subway lines */
        .react-flow__edge-path {
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        
        /* Enhance the visualization with subtle zoom effects */
        .react-flow__node {
          transition: transform 0.2s ease;
        }
        
        /* Subway loading animation styles */
        .subway-loading-animation {
          position: relative;
          width: 200px;
          height: 60px;
        }
        
        .subway-line {
          position: absolute;
          top: 30px;
          left: 0;
          width: 100%;
          height: 4px;
          background-color: #3b82f6;
          border-radius: 2px;
        }
        
        .subway-train {
          position: absolute;
          top: 20px;
          left: 0;
          width: 20px;
          height: 20px;
          background-color: #3b82f6;
          border-radius: 4px;
          animation: train-move 3s infinite ease-in-out;
        }
        
        .subway-station {
          position: absolute;
          top: 25px;
          width: 10px;
          height: 10px;
          background-color: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
        }
        
        .station-1 { left: 40px; }
        .station-2 { left: 100px; }
        .station-3 { left: 160px; }
        
        @keyframes train-move {
          0% { left: 0; }
          25% { left: 40px; }
          35% { left: 40px; }
          60% { left: 100px; }
          70% { left: 100px; }
          95% { left: 160px; }
          100% { left: 180px; }
        }
        
        /* Custom ReactFlow minimap styling */
        .react-flow__minimap {
          background-color: rgba(255, 255, 255, 0.9) !important;
          border-radius: 8px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1) !important;
        }
      `}</style>
      
      {/* Recalculate layout button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          className={cn(
            "bg-white p-2 rounded-md shadow-sm border border-gray-200 text-xs text-muted-foreground hover:bg-gray-50 transition-colors",
            loading ? "opacity-70 cursor-not-allowed" : ""
          )}
          onClick={recalculateLayout}
          disabled={loading}
          title="Recalculate branch layout"
        >
          <RefreshCw 
            size={16} 
            className={loading ? "animate-spin" : ""} 
          />
          {loading && <span className="sr-only">Calculating layout...</span>}
        </button>
      </div>
      
      {/* Branch legend toggle button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          className="bg-white p-2 rounded-md shadow-sm border border-gray-200 text-xs text-muted-foreground hover:bg-gray-50 transition-colors"
          onClick={() => setShowBranchLabels(!showBranchLabels)}
          title="Toggle branch labels"
        >
          <GitBranch size={16} />
        </button>
      </div>
      
      {/* Branch legend */}
      {showBranchLabels && (
        <div className="absolute top-14 right-4 z-10 bg-white p-2 rounded-md shadow-md border border-gray-200 max-w-[200px]">
          <div className="text-xs font-semibold mb-1">Branch Lines</div>
          <div className="max-h-[200px] overflow-y-auto">
            {Array.from(branchColors.entries()).map(([branchId, { color, name }]) => (
              <div 
                key={branchId}
                className={cn(
                  "flex items-center py-1 px-2 text-xs rounded-sm cursor-pointer transition-colors",
                  branchId === currentBranchId ? "bg-gray-100" : "hover:bg-gray-50"
                )}
                onClick={() => onSelectBranch(branchId)}
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: color }}
                />
                <div className="truncate">
                  {name || `Branch ${branchId.substring(0, 4)}`}
                </div>
                {branchId === currentBranchId && (
                  <div className="ml-auto">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesFocusable={true}
        elementsSelectable={true}
        onlyRenderVisibleElements={true} // Performance optimization for large maps
      >
        <Background color="#718096" gap={20} size={0.5} />
        <Controls 
          showInteractive={false}
          className="bg-white bg-opacity-90 p-1 rounded-lg shadow-sm border border-gray-100"
        />
        <ReactFlowMiniMap 
          style={{ 
            height: 120,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            margin: '8px'
          }} 
          zoomable 
          pannable 
          maskColor="rgba(0, 0, 0, 0.1)"
          nodeColor={(node) => {
            // Highlight the current branch in the minimap
            return node.data.branchId === currentBranchId 
              ? node.data.color 
              : `${node.data.color}80`; // Add 50% transparency
          }}
        />
      </ReactFlow>
    </div>
  );
} 