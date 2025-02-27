"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  Node,
  Edge,
  NodeProps,
  useReactFlow,
  Panel,
  NodeTypes,
  Position,
  PanelPosition
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { 
  GitBranch, 
  Train, 
  MessageSquare, 
  RefreshCw, 
  User, 
  Bot,
  ArrowLeft,
  ArrowRight,
  Tag
} from 'lucide-react';
import { TimelineNode, Branch } from '@/lib/types/database';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useConversation } from '@/lib/contexts/ConversationContext';
import { BranchLayout } from '@/lib/layout/subwayLayoutService';

/**
 * Simple theme context as a replacement for next-themes
 */
interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
});

const useTheme = () => useContext(ThemeContext);

/**
 * Subway Minimap Component with Context Integration
 * 
 * This component visualizes conversation branches as a subway map using ReactFlow.
 * It consumes data from the ConversationContext provider instead of managing its own state.
 * This approach eliminates redundant data fetching and improves coordination between UI components.
 * 
 * Key features:
 * - Tree-aware layout using the SubwayLayoutService
 * - Automatic branch direction assignment (left/right)
 * - Visual indicators for branch points with multiple children
 * - Responsive scaling for different viewport sizes
 * - Manual recalculation option
 * - Persistent layout data stored in backend
 * 
 * Integration with ConversationContext:
 * - Uses shared branch and node data from context
 * - Calls context methods for branch switching
 * - Uses layout data fetched and managed by the context
 */

// Get a fallback color for branches based on depth
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
  
  return colors[(depth % colors.length)];
};

// Branch Point Node
function BranchPointNode({ data }: NodeProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const reactFlowInstance = useReactFlow();
  
  // State for hover effect
  const [isHovered, setIsHovered] = useState(false);
  
  // Colors based on theme
  const fillColor = isDark ? '#1e293b' : '#f8fafc';
  const strokeColor = data.color || '#3b82f6';
  const dimColor = isDark ? '#334155' : '#e2e8f0';
  
  const handleClick = () => {
    if (data.onClick) {
      data.onClick(data.id);
    }
  };
  
  // Show branch point with multiple branches as a diamond
  const hasFork = data.childBranches && data.childBranches.length > 1;
  
  return (
    <div
      className="nodrag flex flex-col items-center cursor-pointer transition-transform"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
      onClick={handleClick}
    >
      {hasFork ? (
        /* Diamond shape for branch points with multiple children */
        <div
          style={{
            width: '24px',
            height: '24px',
            transform: 'rotate(45deg)',
            backgroundColor: fillColor,
            border: `2px solid ${strokeColor}`,
            boxShadow: `0 0 5px ${strokeColor}80`,
            marginBottom: '2px',
          }}
        />
      ) : (
        /* Circle for regular branch points */
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: fillColor,
            border: `2px solid ${strokeColor}`,
            boxShadow: `0 0 5px ${strokeColor}80`,
            marginBottom: '2px',
          }}
        >
          <GitBranch
            style={{
              color: strokeColor,
              width: '12px',
              height: '12px',
              margin: '4px',
            }}
          />
        </div>
      )}
      
      {/* Show branch name as label */}
      {data.showLabels && data.label && (
        <div
          style={{
            backgroundColor: fillColor,
            border: `1px solid ${dimColor}`,
            borderRadius: '4px',
            padding: '2px 4px',
            fontSize: '10px',
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: strokeColor,
          }}
        >
          {data.label}
        </div>
      )}
    </div>
  );
}

// Branch Root Node
function BranchRootNode({ data }: NodeProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // State for hover effect
  const [isHovered, setIsHovered] = useState(false);
  
  // Colors based on theme
  const fillColor = isDark ? '#1e293b' : '#f8fafc';
  const strokeColor = data.color || '#3b82f6';
  const textColor = isDark ? '#f8fafc' : '#1e293b';
  
  const handleClick = () => {
    if (data.onClick) {
      data.onClick(data.branchId);
    }
  };
  
  // Direction indicator (left or right branch)
  const showDirectionIndicator = data.direction && (data.direction === 'left' || data.direction === 'right');
  
  return (
    <div
      className="nodrag flex flex-col items-center cursor-pointer transition-transform"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
      onClick={handleClick}
    >
      {/* Root node circle with number */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: fillColor,
          border: `2px solid ${strokeColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 5px ${strokeColor}80`,
          position: 'relative',
        }}
      >
        <Train
          style={{
            color: strokeColor,
            width: '14px',
            height: '14px',
          }}
        />
        
        {/* Direction indicator */}
        {showDirectionIndicator && (
          <div style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            backgroundColor: fillColor,
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${strokeColor}`,
          }}>
            {data.direction === 'left' ? (
              <ArrowLeft size={10} style={{ color: strokeColor }} />
            ) : (
              <ArrowRight size={10} style={{ color: strokeColor }} />
            )}
          </div>
        )}
      </div>
      
      {/* Show branch name as label */}
      {data.showLabels && data.label && (
        <div
          style={{
            backgroundColor: fillColor,
            border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
            borderRadius: '4px',
            padding: '2px 4px',
            marginTop: '3px',
            fontSize: '11px',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: strokeColor,
            fontWeight: 500,
            boxShadow: isHovered ? `0 1px 3px ${strokeColor}40` : 'none',
          }}
        >
          {data.label}
        </div>
      )}
    </div>
  );
}

// Station Node (User or AI message)
function StationNode({ data, selected }: NodeProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // State for hover effect
  const [isHovered, setIsHovered] = useState(false);
  
  // Node size based on type
  const getNodeSize = () => {
    if (data.type === 'user-message') {
      return { width: 22, height: 22 };
    } else if (data.type === 'assistant-message') {
      return { width: 22, height: 22 };
    }
    return { width: 20, height: 20 };
  };
  
  const { width, height } = getNodeSize();
  
  // Colors based on theme
  const fillColor = isDark ? '#1e293b' : '#f8fafc';
  const strokeColor = data.color || '#3b82f6';
  const selectedColor = '#fb923c'; // orange-400
  
  const handleClick = () => {
    if (data.onClick) {
      data.onClick(data.id);
    }
  };
  
  return (
    <div
      className="nodrag cursor-pointer transition-transform"
      style={{
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Station circle */}
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: '50%',
          backgroundColor: fillColor,
          border: `2px solid ${selected ? selectedColor : strokeColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected ? `0 0 6px ${selectedColor}` : `0 0 4px ${strokeColor}60`,
        }}
      >
        {data.type === 'user-message' ? (
          <User size={12} style={{ color: strokeColor }} />
        ) : (
          <Bot size={12} style={{ color: strokeColor }} />
        )}
      </div>
    </div>
  );
}

// Main Root Node
function RootNode({ data }: NodeProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Hover state
  const [isHovered, setIsHovered] = useState(false);
  
  // Colors based on theme
  const fillColor = isDark ? '#1e293b' : '#f8fafc';
  const strokeColor = data.color || '#3b82f6';
  
  const handleClick = () => {
    if (data.onClick) {
      data.onClick(data.branchId);
    }
  };
  
  return (
    <div
      className="nodrag flex flex-col items-center cursor-pointer transition-transform"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
      onClick={handleClick}
    >
      {/* Root node */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: fillColor,
          border: `3px solid ${strokeColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 8px ${strokeColor}80`,
        }}
      >
        <MessageSquare
          style={{
            color: strokeColor,
            width: '16px',
            height: '16px',
          }}
        />
      </div>
      
      {/* Show "Main" label */}
      {data.showLabels && (
        <div
          style={{
            backgroundColor: fillColor,
            border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
            borderRadius: '4px',
            padding: '2px 6px',
            marginTop: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            color: strokeColor,
            boxShadow: isHovered ? `0 1px 3px ${strokeColor}40` : 'none',
          }}
        >
          Main
        </div>
      )}
    </div>
  );
}

// Helper function to convert hex to rgb for edge gradients
function hexToRgb(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `${r}, ${g}, ${b}`;
}

interface MinimapWithContextProps {
  onSelectNode?: (nodeId: string) => void;
}

export function MinimapWithContext({ onSelectNode }: MinimapWithContextProps) {
  // Use conversation context instead of managing own state
  const {
    projectId,
    currentBranchId,
    branches,
    allNodes,
    layoutData,
    loading,
    switchBranch,
    recalculateLayout,
    fetchLayoutData
  } = useConversation();
  
  // Local state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [showBranchLabels, setShowBranchLabels] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  // Ref for the container
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Define custom node types
  const nodeTypes: NodeTypes = {
    branchPoint: BranchPointNode,
    branchRoot: BranchRootNode, 
    station: StationNode,
    root: RootNode,
  };

  // Get responsive scaling based on viewport width
  const getResponsiveScaling = useCallback(() => {
    if (viewportWidth < 640) return { scale: 0.7, nodeSpacing: 40 }; // Small screens
    if (viewportWidth < 1024) return { scale: 0.8, nodeSpacing: 50 }; // Medium screens
    return { scale: 1, nodeSpacing: 60 }; // Large screens
  }, [viewportWidth]);

  // Transform data to React Flow format
  const transformDataToReactFlow = useCallback(() => {
    if (!branches.length || !allNodes.length) {
      return { nodes: [], edges: [] };
    }
    
    const { scale, nodeSpacing } = getResponsiveScaling();
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Track processed branches to avoid duplicates
    const processedBranches = new Set<string>();
    
    // Process each branch
    branches.forEach(branch => {
      if (processedBranches.has(branch.id)) return;
      processedBranches.add(branch.id);
      
      // Get branch color
      const branchColor = branch.color || getBranchColor(branch.depth || 0);
      
      // Get or calculate branch position
      let branchX = 0;
      let branchDirection: 'left' | 'right' | null = null;
      
      // Use layout data if available
      if (layoutData && layoutData[branch.id]) {
        const layout = layoutData[branch.id];
        branchX = layout.x * scale;
        // Filter out 'auto' direction, only accept 'left' or 'right'
        if (layout.direction === 'left' || layout.direction === 'right') {
          branchDirection = layout.direction;
        }
      } else {
        // Fallback calculation if no layout data
        branchX = (branch.depth || 0) * 150 * scale;
        if (branch.depth && branch.depth > 0) {
          // Alternate branches left and right
          branchDirection = branch.depth % 2 === 0 ? 'right' : 'left';
          branchX = branchDirection === 'left' ? -branchX : branchX;
        }
      }
      
      // Define branch base Y position
      let branchY = 0;
      
      // Apply Y position from layout if available
      if (layoutData && layoutData[branch.id] && layoutData[branch.id].y) {
        branchY = layoutData[branch.id].y * scale;
      }
      
      // Find messages in this branch
      const branchMessages = allNodes.filter(
        node => node.branch_id === branch.id && 
               (node.type === 'user-message' || 
                node.type === 'assistant-message')
      ).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      // Skip empty branches
      if (branchMessages.length === 0 && branch.depth !== 0) return;
      
      // Add branch root node
      const branchRootId = `branch-root-${branch.id}`;
      nodes.push({
        id: branchRootId,
        type: 'branchRoot',
        position: { x: branchX, y: branchY },
        data: {
          branchId: branch.id,
          color: branchColor,
          label: branch.name || (branch.depth === 0 ? 'Main' : `Branch ${branch.id.substring(0, 4)}`),
          onClick: (branchId: string) => switchBranch(branchId),
          showLabels: showBranchLabels,
          selected: branch.id === currentBranchId,
          direction: branchDirection,
        },
      });
      
      // Add message nodes
      branchMessages.forEach((message, index) => {
        const nodeId = `message-${message.id}`;
        const yPos = branchY + (index + 1) * nodeSpacing * scale;
        
        // Add message node
        nodes.push({
          id: nodeId,
          type: 'station',
          position: { x: branchX, y: yPos },
          data: {
            id: message.id,
            type: message.type,
            color: branchColor,
            onClick: (id: string) => {
              if (onSelectNode) onSelectNode(id);
            },
            selected: false,
          },
        });
        
        // Add edge to previous node
        const sourceId = index === 0 ? branchRootId : `message-${branchMessages[index - 1].id}`;
        
        edges.push({
          id: `edge-${sourceId}-${nodeId}`,
          source: sourceId,
          target: nodeId,
          style: {
            stroke: `rgb(${hexToRgb(branchColor)})`,
            strokeWidth: 3,
          },
        });
      });
      
      // If this is a child branch, add branch point node and connect to parent
      if (branch.parent_branch_id && branch.branch_point_node_id) {
        // Find the parent branch message that serves as the branch point
        const branchPointNodeId = `branch-point-${branch.branch_point_node_id}`;
        
        // Check if we already created this branch point
        if (!nodes.some(node => node.id === branchPointNodeId)) {
          // Find the parent message
          const parentMessage = allNodes.find(msg => msg.id === branch.branch_point_node_id);
          if (parentMessage) {
            // Find other branches that stem from the same point
            const childBranches = branches.filter(
              b => b.branch_point_node_id === branch.branch_point_node_id && 
                  b.id !== branch.id
            );
            
            // Find parent branch's position
            const parentBranch = branches.find(b => b.id === branch.parent_branch_id);
            if (parentBranch) {
              const parentColor = parentBranch.color || getBranchColor(parentBranch.depth || 0);
              
              // Get parent X position
              let parentX = 0;
              if (layoutData && layoutData[parentBranch.id]) {
                parentX = layoutData[parentBranch.id].x * scale;
              } else {
                parentX = (parentBranch.depth || 0) * 150 * scale;
                if (parentBranch.depth && parentBranch.depth > 0) {
                  parentX = parentBranch.depth % 2 === 0 ? parentX : -parentX;
                }
              }
              
              // Get parent Y position
              let parentY = 0;
              if (layoutData && layoutData[parentBranch.id]) {
                parentY = layoutData[parentBranch.id].y * scale;
              }
              
              // Find message position in parent branch
              const parentMessages = allNodes.filter(
                msg => msg.branch_id === parentBranch.id && 
                      (msg.type === 'user-message' || 
                       msg.type === 'assistant-message')
              ).sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              
              const parentMessageIndex = parentMessages.findIndex(msg => msg.id === parentMessage.id);
              if (parentMessageIndex !== -1) {
                const branchPointY = parentY + (parentMessageIndex + 1) * nodeSpacing * scale;
                
                // Add branch point node
                nodes.push({
                  id: branchPointNodeId,
                  type: 'branchPoint',
                  position: { x: parentX, y: branchPointY },
                  data: {
                    id: branch.branch_point_node_id,
                    color: parentColor,
                    childBranches: [branch, ...childBranches],
                    onClick: (id: string) => {
                      if (onSelectNode) onSelectNode(id);
                    },
                    showLabels: showBranchLabels,
                    selected: false,
                  },
                });
                
                // Connect branch point to parent message
                const parentMessageNodeId = `message-${parentMessage.id}`;
                edges.push({
                  id: `edge-${parentMessageNodeId}-${branchPointNodeId}`,
                  source: parentMessageNodeId,
                  target: branchPointNodeId,
                  style: {
                    stroke: `rgb(${hexToRgb(parentColor)})`,
                    strokeWidth: 3,
                  },
                });
                
                // Connect branch point to child branch root
                edges.push({
                  id: `edge-${branchPointNodeId}-${branchRootId}`,
                  source: branchPointNodeId,
                  target: branchRootId,
                  style: {
                    stroke: `rgb(${hexToRgb(branchColor)})`,
                    strokeWidth: 3,
                  },
                  // Use a smooth bezier curve for branch connections
                  type: 'smoothstep',
                });
              }
            }
          }
        } else {
          // If branch point already exists, just connect it to the branch root
          edges.push({
            id: `edge-${branchPointNodeId}-${branchRootId}`,
            source: branchPointNodeId,
            target: branchRootId,
            style: {
              stroke: `rgb(${hexToRgb(branchColor)})`,
              strokeWidth: 3,
            },
            // Use a smooth bezier curve for branch connections
            type: 'smoothstep',
          });
        }
      }
      
      // If this is a root branch, add the special root node
      if (branch.depth === 0) {
        const rootNodeId = 'root-node';
        nodes.push({
          id: rootNodeId,
          type: 'root',
          position: { x: branchX, y: branchY - nodeSpacing * scale },
          data: {
            branchId: branch.id,
            color: branchColor,
            onClick: (branchId: string) => switchBranch(branchId),
            showLabels: showBranchLabels,
          },
        });
        
        // Connect root node to branch root
        edges.push({
          id: `edge-${rootNodeId}-${branchRootId}`,
          source: rootNodeId,
          target: branchRootId,
          style: {
            stroke: `rgb(${hexToRgb(branchColor)})`,
            strokeWidth: 3,
          },
        });
      }
    });
    
    return { nodes, edges };
  }, [branches, allNodes, currentBranchId, viewportWidth, layoutData, showBranchLabels, getResponsiveScaling, onSelectNode, switchBranch]);
  
  // Handle window resize to update responsive layouts
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setViewportWidth(containerRef.current.offsetWidth);
      }
    };
    
    // Set initial width
    handleResize();
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Update React Flow nodes and edges when data changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = transformDataToReactFlow();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [transformDataToReactFlow]);
  
  // Handle recalculating layout
  const handleRecalculateLayout = async () => {
    setIsRecalculating(true);
    try {
      await recalculateLayout();
    } finally {
      setIsRecalculating(false);
    }
  };
  
  // Function to handle branch selection
  const handleBranchSelect = (branchId: string) => {
    switchBranch(branchId);
  };
  
  // If loading initially and no data yet
  if (loading.data && !branches.length) {
    return (
      <div className="h-full flex items-center justify-center p-4 border rounded-lg">
        <div className="flex flex-col items-center text-muted-foreground">
          <Train className="h-8 w-8 mb-2 animate-pulse" />
          <p>Loading subway map...</p>
        </div>
      </div>
    );
  }
  
  // If no branches at all
  if (!branches.length) {
    return (
      <div className="h-full flex items-center justify-center p-4 border rounded-lg">
        <div className="flex flex-col items-center text-muted-foreground">
          <Train className="h-8 w-8 mb-2" />
          <p>No branches available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <ReactFlowProvider>
        <div className="flex-1 h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
            
            {/* Control panel at the top */}
            <Panel position={"top" as PanelPosition} className="flex items-center gap-2 p-2 bg-background/80 backdrop-blur rounded-md">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRecalculateLayout}
                disabled={isRecalculating}
                className="flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Recalculating...' : 'Recalculate Layout'}
              </Button>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="branch-labels"
                  checked={showBranchLabels}
                  onCheckedChange={setShowBranchLabels}
                />
                <Label htmlFor="branch-labels" className="text-xs">Branch Labels</Label>
              </div>
            </Panel>
            
            {/* Branch legend panel */}
            <Panel position={"bottom" as PanelPosition} className="bg-background/80 backdrop-blur rounded-md p-2">
              <div className="text-xs font-medium mb-1">Branches:</div>
              <div className="flex flex-wrap gap-2 max-w-md">
                {branches.map(branch => (
                  <div
                    key={branch.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: `${branch.color || getBranchColor(branch.depth || 0)}20`,
                      border: `1px solid ${branch.color || getBranchColor(branch.depth || 0)}`,
                      opacity: branch.id === currentBranchId ? 1 : 0.7,
                      fontWeight: branch.id === currentBranchId ? 500 : 400,
                    }}
                    onClick={() => handleBranchSelect(branch.id)}
                  >
                    {branch.id === currentBranchId && (
                      <Train className="h-3 w-3" style={{ color: branch.color || getBranchColor(branch.depth || 0) }} />
                    )}
                    {branch.name || (branch.depth === 0 ? 'Main' : `Branch ${branch.id.substring(0, 4)}`)}
                  </div>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </div>
  );
} 