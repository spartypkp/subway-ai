"use client";

/**
 * Subway Minimap Component
 * 
 * This component visualizes conversation branches as a subway map using ReactFlow.
 * It leverages the ConversationContext for data fetching, state management, and 
 * layout calculations, allowing it to focus solely on visualization.
 * 
 * Key features:
 * - Visualizes conversation branches as subway lines
 * - Interactive subway map navigation
 * - Visual indicators for branch points with multiple children
 * - Responsive scaling for different viewport sizes
 * - Branch selection and navigation
 * 
 * The component uses ReactFlow for the visualization and relies entirely on
 * the ConversationContext for data management and transformations.
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap as ReactFlowMiniMap,
  Node,
  NodeProps,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Branch } from '@/lib/types/database';
import { GitBranch, MessageSquare, Train, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversation,  } from '@/lib/contexts/ConversationContext';


// Define props interface
interface MinimapProps {
  onSelectNode?: (nodeId: string) => void;
}



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

export function Minimap({ onSelectNode }: MinimapProps) {
  // Use the conversation context
  const {
    projectId,
    currentBranchId,
    branches,
    switchBranch,
    fetchData,
    fetchLayoutData,
    recalculateLayout,
    getNodesForReactFlow,
    loading
  } = useConversation();

  // Memoize nodeTypes to prevent recreation on each render
  const memoizedNodeTypes = useMemo(() => ({
    stationNode: StationNode,
    rootNode: RootNode,
    branchPointNode: BranchPointNode,
    branchRootNode: BranchRootNode
  }), []);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState<string | null>(null);
  const [showBranchLabels, setShowBranchLabels] = useState(false);
  
  
  // Update nodes and edges when data changes
  useEffect(() => {
    try {
      // Get nodes and edges from the context
      const { nodes: flowNodes, edges: flowEdges } = getNodesForReactFlow();
      
      // Update ReactFlow state
      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      console.error('Error updating flow nodes:', err);
      setError('Failed to update flow visualization');
    }
  }, [getNodesForReactFlow, setNodes, setEdges]);
  

  
  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Call onSelectNode if provided
    if (onSelectNode) {
      onSelectNode(node.id);
    }
    
    // Switch to the branch if it has a branch ID
    if (node.data.branchId && node.data.branchId !== currentBranchId) {
      switchBranch(node.data.branchId);
    }
  }, [onSelectNode, switchBranch, currentBranchId]);
  
  // Loading state with subway-themed animation
  if (loading.data && nodes.length === 0) {
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
        name: (node.data as any).branchName || undefined
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
            loading.layout ? "opacity-70 cursor-not-allowed" : ""
          )}
          onClick={() => recalculateLayout()}
          disabled={loading.layout}
          title="Recalculate branch layout"
        >
          <RefreshCw 
            size={16} 
            className={loading.layout ? "animate-spin" : ""} 
          />
          {loading.layout && <span className="sr-only">Calculating layout...</span>}
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
                onClick={() => switchBranch(branchId)}
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
        nodeTypes={memoizedNodeTypes}
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