"use client";

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
import { TimelineNode } from '@/lib/types/database';
import { GitBranch, MessageSquare, Train } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MinimapProps {
  projectId: string;
  currentBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
}

// Define custom node types
const nodeTypes = {
  stationNode: StationNode,
  rootNode: RootNode,
  branchNode: BranchNode,
  assistantNode: AssistantNode
};

// Generate branch colors
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

// Custom node for assistant messages
function AssistantNode({ data }: NodeProps) {
  const isActive = data.isActive;
  
  return (
    <div 
      className={cn(
        "p-1 rounded-full flex items-center justify-center bg-white",
        isActive ? "scale-105" : ""
      )}
      style={{ 
        borderColor: data.color,
        border: `1px solid ${data.color}`,
        width: '16px',
        height: '16px',
      }}
    >
      <div
        className="rounded-full"
        style={{ background: data.color, width: '6px', height: '6px' }}
      />
      <Handle type="target" position={Position.Top} style={{ background: data.color, width: '6px', height: '6px' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: data.color, width: '6px', height: '6px' }} />
    </div>
  );
}

// Custom node for stations (user messages)
function StationNode({ data, selected }: NodeProps) {
  const isActive = data.isActive;
  
  return (
    <div 
      className={cn(
        "px-2 py-1 rounded-full border-2 flex items-center justify-center bg-white shadow-md transition-all duration-300",
        isActive ? "shadow-lg scale-110" : "hover:shadow-lg hover:scale-105",
        selected ? "ring-2 ring-offset-2" : ""
      )}
      style={{ 
        borderColor: data.color,
        minWidth: '30px',
        minHeight: '30px',
      }}
    >
      <div 
        className="text-xs font-medium truncate max-w-[120px]"
        style={{ color: data.color }}
      >
        {data.content && data.content.length > 15 
          ? data.content.substring(0, 15) + '...' 
          : data.content || "Message"}
      </div>
      <Handle type="target" position={Position.Top} style={{ background: data.color, width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: data.color, width: '8px', height: '8px' }} />
    </div>
  );
}

// Custom node for root node (start of conversation)
function RootNode({ data }: NodeProps) {
  return (
    <div 
      className="p-2 rounded-full border-2 bg-white shadow-md flex items-center justify-center"
      style={{ 
        borderColor: data.color,
        width: '40px',
        height: '40px',
      }}
    >
      <Train className="text-primary" size={20} />
      <Handle type="source" position={Position.Bottom} style={{ background: data.color, width: '8px', height: '8px' }} />
    </div>
  );
}

// Custom node for branch points
function BranchNode({ data }: NodeProps) {
  return (
    <div 
      className="p-1 rounded-full shadow-md flex items-center justify-center bg-white animate-pulse"
      style={{ 
        borderColor: data.color,
        border: `2px solid ${data.color}`,
        width: '30px',
        height: '30px',
      }}
    >
      <GitBranch size={16} style={{ color: data.color }} />
      <Handle type="target" position={Position.Top} style={{ background: data.color, width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: data.color, width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Right} style={{ background: data.color, width: '8px', height: '8px' }} />
    </div>
  );
}

// Extract content from message nodes
const extractMessageContent = (node: TimelineNode): string => {
  try {
    if (!node.content) return '';
    
    // Handle object content
    if (typeof node.content === 'object') {
      const content = node.content as any;
      return content.text || content.content || '';
    }
    
    // Handle string content
    if (typeof node.content === 'string') {
      try {
        const parsed = JSON.parse(node.content);
        return parsed.text || parsed.content || '';
      } catch {
        return node.content;
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting message content:', error);
    return '';
  }
};

// Extract role from message nodes
const extractMessageRole = (node: TimelineNode): 'user' | 'assistant' => {
  try {
    if (!node.content) return 'assistant';
    
    // Handle object content
    if (typeof node.content === 'object') {
      const content = node.content as any;
      return content.role || 'assistant';
    }
    
    // Handle string content
    if (typeof node.content === 'string') {
      try {
        const parsed = JSON.parse(node.content);
        return parsed.role || 'assistant';
      } catch {
        return 'assistant';
      }
    }
    
    return 'assistant';
  } catch (error) {
    console.error('Error extracting message role:', error);
    return 'assistant';
  }
};

export function Minimap({ projectId, currentBranchId, onSelectBranch }: MinimapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reactFlowInstance = useReactFlow();
  
  // Transform timeline nodes to React Flow format
  const transformDataToReactFlow = useCallback((data: TimelineNode[]) => {
    if (!data.length) return { nodes: [], edges: [] };
    
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    const branchMap = new Map<string, { depth: number, color: string, nodes: TimelineNode[] }>();
    
    // First pass: create branches and organize nodes by branch
    data.forEach(node => {
      const branchId = node.branch_id;
      
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          depth: 0,
          color: '#3b82f6', // Default blue
          nodes: []
        });
      }
      
      const branch = branchMap.get(branchId);
      if (branch) {
        branch.nodes.push(node);
      }
    });
    
    console.log(`Found ${branchMap.size} branches in the data`);
    
    // Second pass: assign depths and colors to branches
    const rootNode = data.find(n => n.type === 'root');
    if (!rootNode) {
      console.warn('No root node found in data');
      return { nodes: [], edges: [] };
    }
    
    const mainBranchId = rootNode.branch_id;
    const mainBranch = branchMap.get(mainBranchId);
    
    if (!mainBranch) {
      console.warn('Main branch not found');
      return { nodes: [], edges: [] };
    }
    
    // Find all fork nodes to establish branch relationships
    const forkNodes = data.filter(n => n.type === 'fork');
    console.log(`Found ${forkNodes.length} fork nodes`);
    
    // Set up the main branch
    mainBranch.depth = 0;
    mainBranch.color = getBranchColor(0);
    
    // Track branch parent relationships
    const branchParents: Record<string, {parentBranchId: string, forkNodeId: string}> = {};
    
    // Establish branch hierarchy
    forkNodes.forEach(fork => {
      if (!fork.parent_id) return;
      
      const parentNode = data.find(n => n.id === fork.parent_id);
      if (!parentNode) return;
      
      const parentBranchId = parentNode.branch_id;
      const childBranchId = fork.branch_id;
      
      if (parentBranchId === childBranchId) return; // Skip self-references
      
      // Store the branch relationship
      branchParents[childBranchId] = {
        parentBranchId: parentBranchId,
        forkNodeId: fork.id
      };
    });
    
    // Assign depths to branches using BFS
    const visited = new Set<string>([mainBranchId]);
    const queue = [mainBranchId];
    
    while (queue.length > 0) {
      const currentBranchId = queue.shift()!;
      const currentBranch = branchMap.get(currentBranchId);
      
      if (!currentBranch) continue;
      
      // Find all direct child branches
      Object.entries(branchParents).forEach(([childBranchId, {parentBranchId}]) => {
        if (parentBranchId === currentBranchId && !visited.has(childBranchId)) {
          const childBranch = branchMap.get(childBranchId);
          if (childBranch) {
            childBranch.depth = currentBranch.depth + 1;
            childBranch.color = getBranchColor(childBranch.depth);
            visited.add(childBranchId);
            queue.push(childBranchId);
            console.log(`Branch ${childBranchId} is at depth ${childBranch.depth} with color ${childBranch.color}`);
          }
        }
      });
    }
    
    // Track active branches (highlighting the current path)
    const activeBranches = new Set<string>();
    if (currentBranchId) {
      let branch = currentBranchId;
      while (branch) {
        activeBranches.add(branch);
        const parent = branchParents[branch];
        branch = parent ? parent.parentBranchId : '';
      }
    } else {
      // If no current branch, highlight main branch
      activeBranches.add(mainBranchId);
    }
    
    // Position calculation utility
    const calculateNodePositions = () => {
      // Track node positions for each branch
      const positions: Record<string, {
        x: number, 
        y: number, 
        nodeCount: number,
        messageCount: number,
        lastNodeId: string
      }> = {};
      
      // Start with root node
      flowNodes.push({
        id: rootNode.id,
        type: 'rootNode',
        position: { x: 250, y: 50 },
        data: {
          label: 'Start',
          color: mainBranch.color,
          branchId: mainBranchId,
          isActive: activeBranches.has(mainBranchId)
        }
      });
      
      // Set initial position for main branch
      positions[mainBranchId] = {
        x: 250,
        y: 120,
        nodeCount: 0,
        messageCount: 0,
        lastNodeId: rootNode.id
      };
      
      // Process branches by depth to ensure proper layout
      const sortedBranchIds = Array.from(branchMap.keys()).sort((a, b) => {
        return (branchMap.get(a)?.depth || 0) - (branchMap.get(b)?.depth || 0);
      });
      
      // Process each branch
      sortedBranchIds.forEach(branchId => {
        const branch = branchMap.get(branchId)!;
        const parent = branchParents[branchId];
        
        // Skip the main branch (already processed)
        if (branchId === mainBranchId) return;
        
        // Skip if we don't have parent information
        if (!parent) {
          console.warn(`Branch ${branchId} has no parent, skipping`);
          return;
        }
        
        const parentBranchId = parent.parentBranchId;
        const parentBranch = branchMap.get(parentBranchId)!;
        const parentPos = positions[parentBranchId];
        
        if (!parentPos) {
          console.warn(`Parent branch ${parentBranchId} has no position information`);
          return;
        }
        
        // Find parent message node
        const parentNode = data.find(n => n.id === parent.forkNodeId)!;
        const parentMsgNode = data.find(n => n.id === parentNode.parent_id)!;
        
        if (!parentMsgNode) {
          console.warn(`Parent message for fork ${parent.forkNodeId} not found`);
          return;
        }
        
        // Find the fork point position
        let forkPosition = { x: 0, y: 0 };
        
        // Try to find the already placed parent message node
        const parentNodeObj = flowNodes.find(n => n.id === parentMsgNode.id);
        if (parentNodeObj) {
          forkPosition = { 
            x: parentNodeObj.position.x, 
            y: parentNodeObj.position.y + 40 
          };
        } else {
          // If not found (shouldn't happen), use approximate position
          forkPosition = { 
            x: parentPos.x, 
            y: parentPos.y + parentPos.messageCount * 80 
          };
        }
        
        // Create branch point node
        const branchPointId = `branch-${parent.forkNodeId}`;
        flowNodes.push({
          id: branchPointId,
          type: 'branchNode',
          position: forkPosition,
          data: {
            color: branch.color,
            branchId: branchId,
            isActive: activeBranches.has(branchId),
            label: `Branch ${branch.depth}`
          }
        });
        
        // Add edge from parent message to branch point
        flowEdges.push({
          id: `edge-to-branch-${parent.forkNodeId}`,
          source: parentMsgNode.id,
          target: branchPointId,
          animated: activeBranches.has(parentBranchId),
          style: { stroke: parentBranch.color, strokeWidth: 3 }
        });
        
        // Set position for this branch (offset to the right)
        const xOffset = 300 + (branch.depth * 50);
        positions[branchId] = {
          x: forkPosition.x + xOffset,
          y: forkPosition.y,
          nodeCount: 0,
          messageCount: 0,
          lastNodeId: branchPointId
        };
      });
      
      return positions;
    };
    
    // Calculate initial positions
    const positions = calculateNodePositions();
    
    // Process each branch to create nodes and edges
    Object.entries(positions).forEach(([branchId, position]) => {
      const branch = branchMap.get(branchId)!;
      const branchColor = branch.color;
      const isActive = activeBranches.has(branchId);
      
      // Sort nodes by creation time
      const branchNodes = branch.nodes
        .filter(n => n.type !== 'root' && n.type !== 'fork') // Only process message nodes
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      // Skip empty branches
      if (branchNodes.length === 0) return;
      
      // Track the last node added for this branch
      let lastNodeId = position.lastNodeId;
      let currentY = position.y;
      
      // Process messages in this branch
      branchNodes.forEach((node) => {
        if (node.type !== 'message') return;
        
        const role = extractMessageRole(node);
        const content = extractMessageContent(node);
        
        // Calculate position - user messages get more space
        const isUser = role === 'user';
        currentY += isUser ? 100 : 60;
        position.nodeCount++;
        
        if (isUser) {
          position.messageCount++;
        }
        
        // Create the node
        flowNodes.push({
          id: node.id,
          type: isUser ? 'stationNode' : 'assistantNode',
          position: { x: position.x, y: currentY },
          data: {
            content,
            color: branchColor,
            branchId,
            isActive,
            isAssistant: !isUser,
            role
          }
        });
        
        // Connect to previous node
        flowEdges.push({
          id: `edge-${lastNodeId}-${node.id}`,
          source: lastNodeId,
          target: node.id,
          animated: isActive,
          style: { 
            stroke: branchColor, 
            strokeWidth: isUser ? 3 : 2,
            strokeDasharray: isUser ? undefined : '5,5'
          }
        });
        
        // Update last node
        lastNodeId = node.id;
      });
    });
    
    return { nodes: flowNodes, edges: flowEdges };
  }, [currentBranchId]);
  
  // Fetch data effect
  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching data for minimap, project:', projectId);
      if (!projectId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const url = `/api/nodes?project_id=${projectId}&complete_tree=true`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data.length} timeline nodes`);
        
        const { nodes: flowNodes, edges: flowEdges } = transformDataToReactFlow(data);
        
        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch (error) {
        console.error('Failed to fetch minimap data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [projectId, transformDataToReactFlow]);
  
  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.data.branchId) {
      onSelectBranch(node.data.branchId);
    }
  }, [onSelectBranch]);
  
  // Center view on the active node when it changes
  useEffect(() => {
    if (!loading && reactFlowInstance) {
      const activeNode = nodes.find(node => 
        node.data.branchId === currentBranchId || 
        (currentBranchId === null && node.type === 'rootNode')
      );
      
      if (activeNode) {
        // Zoom to fit all nodes with a little padding
        reactFlowInstance.fitView({ padding: 0.2, includeHiddenNodes: false });
        
        // After fitView, center on the active node
        setTimeout(() => {
          reactFlowInstance.setCenter(activeNode.position.x, activeNode.position.y, { zoom: 1, duration: 800 });
        }, 100);
      }
    }
  }, [currentBranchId, loading, nodes, reactFlowInstance]);
  
  if (loading && nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/30"></div>
          <div className="h-2 w-24 bg-muted rounded-full"></div>
          <div className="h-2 w-32 bg-muted rounded-full mt-4"></div>
        </div>
        <p className="text-sm text-muted-foreground mt-6">Loading subway map...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <MessageSquare className="h-8 w-8 text-destructive mb-2" />
        <p className="text-destructive font-medium">Failed to load subway map</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="h-full w-full">
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
      >
        <Background color="#aaaaaa" gap={16} size={1} />
        <Controls showInteractive={false} />
        <ReactFlowMiniMap style={{ height: 100 }} zoomable pannable />
      </ReactFlow>
    </div>
  );
}