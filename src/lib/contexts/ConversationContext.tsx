"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Branch, TimelineNode, NodeType } from '@/lib/types/database';

import { useProject } from './ProjectContext';
import { Edge, Node } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { processStreamingResponse } from '@/lib/streaming';

// React Flow node data interfaces
interface BaseNodeData {
  color: string;
  branchId: string;
  isActive: boolean;
}

interface RootNodeData extends BaseNodeData {
  projectName: string;
}

interface BranchRootNodeData extends BaseNodeData {
  branchName: string;
  branchDirection: 'left' | 'right' | 'auto';
}

interface BranchPointNodeData extends BaseNodeData {
  childBranches: {
    branchId: string;
    branchColor: string;
    branchName: string;
    direction: 'left' | 'right' | 'auto';
    isOnActivePath: boolean;
    handleId?: string;
  }[];
  leftBranch?: {
    branchId: string;
    branchColor: string;
    branchName: string;
    isOnActivePath: boolean;
  };
  rightBranch?: {
    branchId: string;
    branchColor: string;
    branchName: string;
    isOnActivePath: boolean;
  };
}

interface StationNodeData extends BaseNodeData {
  userContent: string;
  assistantContent: string;
  timestamp: string;
  calculatedWidth: number;
  stationNumber: number;
  summary?: string; // Optional AI-generated summary of the conversation at this point
  fullData: {
    userMessage?: TimelineNode;
    assistantMessage?: TimelineNode;
  };
}

// TypeScript types for subway branch connection
interface BranchConnection {
  branchPointId: string;
  branchRootId: string;
  parentBranchId: string;
  childBranchId: string;
  position: number;
  branchPointNode: TimelineNode;
  direction?: 'left' | 'right' | 'auto';
}

// TypeScript types for subway station
interface Station {
  position: number;
  yPosition: number;
  id: string;
  userMessage?: TimelineNode;
  assistantMessage?: TimelineNode;
  branchPoint?: TimelineNode;
}

// TypeScript types for branch map entry
interface BranchMapEntry {
  depth: number;
  color: string;
  nodes: TimelineNode[];
  branch: Branch;
  xPosition: number;
  yOffset: number;
  direction?: 'left' | 'right' | 'auto';
}

/**
 * ConversationContext
 * 
 * A shared context provider that handles data fetching, state management, and layout calculations
 * for conversation components (MessageList and Minimap).
 * 
 * This centralizes data fetching and management to:
 * 1. Eliminate duplicate API calls
 * 2. Ensure data consistency across components
 * 3. Coordinate layout calculations and branch navigation
 * 4. Provide optimistic updates for a responsive UI
 */

// Main context interface
interface ConversationContextValue {
  // Data
  branches: Branch[];
  allNodes: TimelineNode[];
  
  displayedChatNodes: TimelineNode[];
  
  // State
  projectId: string;
  currentBranchId: string | null;
  loading: {
    data: boolean;
    layout: boolean;
  };
  
  // Simplified streaming state
  isStreaming: boolean;
  streamingContent: string | null;
  streamingParentId: string | null;
  
  // Actions
  fetchData: () => Promise<void>;
  recalculateLayout: (layoutType?: 'tree' | 'slot') => Promise<void>;
  switchBranch: (branchId: string | null) => void;
  createBranch: (params: {
    branchPointNodeId: string;
    name?: string;
    createdBy?: string;
    direction?: 'left' | 'right' | 'auto';
  }) => Promise<string>;
  updateStreamingContent: (content: string | null) => void;
  sendMessage: (text: string) => Promise<void>;
  
  // Utility functions
  getBranchColor: (branchId: string) => string;
  getBranchName: (branchId: string) => string;
  getBranchPath: (targetBranchId: string | null) => TimelineNode[];
  getNodesForReactFlow: () => { nodes: Node<BaseNodeData>[]; edges: Edge[] };
}

// Create the context with a default undefined value
const ConversationContext = createContext<ConversationContextValue | undefined>(undefined);

// Props for the provider component
interface ConversationProviderProps {
  children: ReactNode;
  pollingInterval?: number;
}

export const ConversationProvider: React.FC<ConversationProviderProps> = ({
  children,
  pollingInterval = 5000,
}) => {
  // Get project data from ProjectContext
  const { selectedProjectId, mainBranchId, loading: projectLoading } = useProject();
  
  // Ensure we have a valid project ID
  const projectId = selectedProjectId || '';

  // Data state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allNodes, setAllNodes] = useState<TimelineNode[]>([]);
  
  // UI state
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  
  // Simplified streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingParentId, setStreamingParentId] = useState<string | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    data: true,
    layout: false,
  });
  
  // Track if conversation context is ready (has valid project data)
  const [isReady, setIsReady] = useState(false);

  // Add console.logging logs
  useEffect(() => {
    if (projectId && !projectLoading) {
      console.log('🔍 console.log: ConversationProvider initialized with:');
      
    }
  }, [projectId, currentBranchId, projectLoading, mainBranchId]);

  // Check if conversation context is ready
  useEffect(() => {
    if (projectId && !projectLoading) {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [projectId, projectLoading]);

  // Reset state when project changes
  useEffect(() => {
    if (!projectId) return;     
    // Clear state when project changes
    setBranches([]);
    setAllNodes([]);
    
    // Reset to main branch when project changes
    setCurrentBranchId(null);
    
    // Set loading state
    setLoading({
      data: true,
      layout: true,
    });
    
    // Fetch data for the new project if we have a valid project ID AND project loading is complete
    if (projectId && !projectLoading) {
      fetchData();
    }
  }, [projectId, projectLoading]);

  // Fetch all branches for the project
  const fetchBranches = async (): Promise<Branch[]> => {
    if (!projectId) return [];
    
    try {
      const response = await fetch(`/api/projects/${projectId}/branches`);
      if (!response.ok) {
        throw new Error(`Failed to fetch branches: ${response.status}`);
      }
      const branchesData = await response.json();
      setBranches(branchesData);
      return branchesData;
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      return [];
    }
  };

  // Fetch all nodes for the project
  const fetchNodes = async (): Promise<TimelineNode[]> => {
    if (!projectId) return [];
    
    try {
      const url = `/api/nodes?project_id=${projectId}&complete_tree=true`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      setAllNodes(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
      return [];
    }
  };

  // Recalculate layout for all branches
  const recalculateLayout = async (layoutType: 'tree' | 'slot' = 'tree'): Promise<void> => {
    if (!projectId) return;
    
    setLoading(prev => ({ ...prev, layout: true }));
    try {
      const response = await fetch(`/api/projects/${projectId}/layout?layoutType=${layoutType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to recalculate layout: ${response.status}`);
      }
      
      // Fetch the updated branches which will include the new layout data in metadata
      await fetchBranches();
    } catch (error) {
      console.error('Failed to recalculate layout:', error);
    } finally {
      setLoading(prev => ({ ...prev, layout: false }));
    }
  };

  // Main data fetching function
  const fetchData = async (): Promise<void> => {
    if (!projectId || projectLoading) {
      console.log('Cannot fetch data - projectId is missing or project is loading');
      return;
    }
    
    
    
    setLoading(prev => ({ ...prev, data: true }));
    
    try {
      // Fetch data in parallel for better performance
      const [branchesData, nodesData] = await Promise.all([
        fetchBranches(),
        fetchNodes(),
      ]);
      
      // Enhanced logging
      
      
      // Get unique branch IDs in the data
      const branchIds = [...new Set(nodesData.map(node => node.branch_id))];
      
      
      // Log the available branches
     
      
      // Log the root node if found
      const rootNode = nodesData.find(node => node.type === 'root');
      if (!rootNode) {
    
        console.log('WARNING: No root node found in fetched data');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(prev => ({ ...prev, data: false }));
    }
  };

  // Switch to a different branch
  const switchBranch = useCallback((branchId: string | null) => {
    
    // Prevent switching to the same branch
    if (branchId === currentBranchId) {
      return;
    }
    
    setCurrentBranchId(branchId);
    
    // Schedule a refresh of data after switching
    setTimeout(fetchData, 100);
  }, [currentBranchId, fetchData]);

  // Create a new branch
  const createBranch = async (params: {
    branchPointNodeId: string;
    name?: string;
    createdBy?: string;
    direction?: 'left' | 'right' | 'auto';
  }): Promise<string> => {
    if (!projectId) throw new Error('No project selected');
    
    const { branchPointNodeId, name, createdBy = 'user', direction = 'auto' } = params;
    
    try {
      // Find the message and its branch
      const message = allNodes.find(m => m.id === branchPointNodeId);
      if (!message) throw new Error('Selected message not found');
      
      const response = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          parent_branch_id: message.branch_id,
          branch_point_node_id: branchPointNodeId,
          name: name || undefined,
          created_by: createdBy,
          direction: direction
        })
      });
      
      if (!response.ok) throw new Error('Failed to create branch');
     
      const result = await response.json();
      // Calculate layout after new branch is crated
      await recalculateLayout('slot');
      // Refresh data after creating branch
      await fetchData();
      
      return result.id;
    } catch (error) {
      console.error('Failed to create branch:', error);
      throw error;
    }
  };

  // Simplified updateStreamingContent function
  const updateStreamingContent = (content: string | null) => {
    // If content is null, it means streaming has ended
    if (content === null) {
     
      
      // Clear streaming state
      setIsStreaming(false);
      setStreamingContent(null);
      
      // Fetch data to get the real message
      fetchData();
    } else {
      // Just update the streaming content
      setStreamingContent(content);
    }
  };

  // Refactored sendMessage method with simplified streaming approach
  const sendMessage = async (text: string): Promise<void> => {
    if (!projectId) throw new Error('No project selected');
    if (!text.trim()) return;
    
    try {
      // Find the parent node - get the last node in the current branch regardless of type
      
      
      // Filter nodes to current branch, or all nodes if no branch is selected
      const branchNodes = currentBranchId
        ? allNodes.filter(node => node.branch_id === currentBranchId)
        : allNodes;
        
      if (branchNodes.length === 0) {
        console.log('No nodes found in this branch or project');
        throw new Error('Cannot find a parent node to attach message to');
      }
      
      // Sort by position and created_at to find the last node
      const sortedNodes = [...branchNodes].sort((a, b) => {
        // First sort by position
        if (a.position !== b.position) {
          return b.position - a.position; // Descending order
        }
        // If same position, sort by creation date
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      const parentNode = sortedNodes[0];
      //console.log(`Using node as parent: id=${parentNode.id}, type=${parentNode.type}, branch_id=${parentNode.branch_id}`);
      
      const parentId = parentNode.id;
      const targetBranchId = parentNode.branch_id || '';
      
      // 1. Save user message directly to database
      const userMessageResponse = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          branch_id: targetBranchId,
          parent_id: parentId,
          text: text.trim(),
          created_by: 'user'
        })
      });
      
      if (!userMessageResponse.ok) {
        const errorText = await userMessageResponse.text();
        throw new Error(`Failed to save user message: ${errorText}`);
      }
      
      // Get user message ID from response
      const userMessageResponseText = await userMessageResponse.text();
      
      let userMessageData;
      try {
        userMessageData = JSON.parse(userMessageResponseText);
      } catch (e) {
        console.error('Failed to parse user message response as JSON:', e);
        throw new Error('Invalid response from server when saving user message');
      }
      
      // The response structure is { user_message: { id: "..." } }
      if (!userMessageData || !userMessageData.user_message || !userMessageData.user_message.id) {
        console.error('User message response is missing expected data structure:', userMessageData);
        throw new Error('Server did not return a valid message ID');
      }
      
      const userMessageId = userMessageData.user_message.id;
      
      // 2. Refetch data to update UI with user message
      await fetchData();
      
      // 3. Set streaming flag
      setIsStreaming(true);
      setStreamingContent('');
      setStreamingParentId(userMessageId);
      
      // 4. Make API call for assistant response with streaming
      
      // Prepare messages array from displayedChatNodes - only include user and assistant messages
      const messageHistory = displayedChatNodes
        .filter(node => node.type === 'user-message' || node.type === 'assistant-message')
        .map(node => ({
          role: node.type === 'user-message' ? 'user' : 'assistant',
          content: node.message_text || ''
        }));
      
      // Add the current user message that we just sent (which may not be in displayedChatNodes yet)
      messageHistory.push({
        role: 'user',
        content: text.trim()
      });
      
      // Create the request payload explicitly for console.logging
      const requestPayload = {
        project_id: projectId,
        parent_id: userMessageId,
        messages: messageHistory,
        stream: true
      };
      
      
      const assistantResponse = await fetch('/api/messages/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      
      // 5. Handle streaming response
      if (assistantResponse.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = assistantResponse.body?.getReader();
        let responseText = '';
        let done = false;
        
        // Reading the stream
        if (reader) {
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            
            if (value) {
              const chunk = new TextDecoder().decode(value);
              responseText += chunk;
              
              // Update streaming content as we go
              setStreamingContent(responseText);
            }
          }
          
          // When streaming is complete, clear state and refetch data
          updateStreamingContent(null); // This will clear streaming state and fetch data
        }
      } else {
        // Handle non-streaming response
        if (!assistantResponse.ok) {
          const errorText = await assistantResponse.text();
          throw new Error(`Server error: ${assistantResponse.status} ${errorText}`);
        }
        
        // Just refresh data
        updateStreamingContent(null);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Reset streaming state
      setIsStreaming(false);
      setStreamingContent(null);
      setStreamingParentId(null);
      
      // Show error in UI
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.log(`Error in sendMessage: ${errorMessage}`);
    }
  };
  
  // Get branch color based on branch ID with improved allocation
  const getBranchColor = useCallback((branchId: string): string => {
    // First check if we have this branch in our branches list
    const branch = branches.find(b => b.id === branchId);
    if (branch && branch.color) {
      return branch.color;
    }
    
    // Improved color allocation logic - different colors for sibling branches
    // Define our color palette (avoid colors that are too similar)
    const colors = [
      '#3b82f6', // blue-500 (reserved for main branch)
      '#ef4444', // red-500
      '#10b981', // emerald-500
      '#8b5cf6', // violet-500
      '#f59e0b', // amber-500
      '#06b6d4', // cyan-500
      '#ec4899', // pink-500
      '#84cc16', // lime-500
      '#6366f1', // indigo-500
      '#14b8a6', // teal-500
      '#f97316', // orange-500
      '#a855f7', // purple-500
    ];
    
    // Main branch always gets blue
    if (branch?.depth === 0 || !branch?.parent_branch_id) {
      return colors[0]; // Blue for main branch
    }
    
    // For child branches, pick based on sibling position to ensure variation
    if (branch?.parent_branch_id) {
      // Find all sibling branches (branches with the same parent)
      const siblingBranches = branches.filter(b => 
        b.parent_branch_id === branch.parent_branch_id
      );
      
      // Get the index of this branch among its siblings
      const siblingIndex = siblingBranches.findIndex(b => b.id === branchId);
      
      // Use different colors for siblings, but skip the main branch color
      if (siblingIndex >= 0) {
        // +1 to skip the main branch color
        return colors[1 + (siblingIndex % (colors.length - 1))];
      }
    }
    
    // Fallback: use a hash of the branch ID to pick a color (skip main branch color)
    const hash = branchId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    // Skip the first color (reserved for main branch)
    return colors[1 + (hash % (colors.length - 1))];
  }, [branches]);

  // Get branch name from branchId
  const getBranchName = useCallback((branchId: string): string => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unnamed Branch';
  }, [branches]);

  // Build a path from root to the current branch node
  const getBranchPath = useCallback((targetBranchId: string | null): TimelineNode[] => {
    console.log(`Building branch path for targetBranchId: ${targetBranchId}`);
    if (!allNodes.length) {
      console.log('No nodes available in allNodes array');
      return [];
    }

    // If no specific branch is selected, show messages from the main branch
    if (!targetBranchId) {
      // Make sure we have a valid mainBranchId
      if (!mainBranchId) {
        console.log('No mainBranchId available yet, returning empty path');
        return [];
      }
      
      // Find the root node
      const rootNode = allNodes.find(m => m.type === 'root');
      if (!rootNode) {
        console.log('No root node found in allNodes');
        return [];
      }
      
      const mainBranchNodes = allNodes
        .filter(m => m.branch_id === mainBranchId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      console.log(`Found ${mainBranchNodes.length} nodes in main branch (${mainBranchId})`);
      return mainBranchNodes;
    }
    
    // If a specific branch is selected, build the full path from root to the current branch
    const result: TimelineNode[] = [];
    
    // First, find all nodes in the target branch
    const branchMessages = allNodes
      .filter(m => m.branch_id === targetBranchId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    console.log(`Found ${branchMessages.length} nodes in target branch (${targetBranchId})`);
    
    if (!branchMessages.length) {
      console.log(`WARNING: No messages found for branch ${targetBranchId}`);
      return [];
    }
    
    // Find the branch in our branches list
    const currentBranch = branches.find(b => b.id === targetBranchId);
    if (!currentBranch) {
      console.log(`WARNING: Branch ${targetBranchId} not found in branches list`);
      return branchMessages;
    }
    
    // If this branch has a parent branch, we need to include messages from the parent branch
    if (currentBranch.parent_branch_id) {
      console.log(`Branch ${targetBranchId} has parent branch ${currentBranch.parent_branch_id}`);
      
      // Find the branch point node
      const branchPointNode = allNodes.find(m => m.id === currentBranch.branch_point_node_id);
      
      if (branchPointNode) {
        console.log(`Found branch point node ${branchPointNode.id} for branch ${targetBranchId}`);
        
        // Recursively build the parent branch path up to the branch point
        const parentPath = getBranchPath(currentBranch.parent_branch_id);
        
        // Only include parent messages up to the branch point
        const branchPointIndex = parentPath.findIndex(m => m.id === branchPointNode.id);
        if (branchPointIndex !== -1) {
          console.log(`Including ${branchPointIndex + 1} nodes from parent branch path`);
          result.push(...parentPath.slice(0, branchPointIndex + 1));
        } else {
          console.log(`WARNING: Branch point node ${branchPointNode.id} not found in parent path`);
        }
      } else {
        console.log(`WARNING: Branch point node not found for branch ${targetBranchId}`);
      }
    }
    
    // Add the branch messages to the result, excluding the branch-root node
    const nonBranchRootMessages = branchMessages.filter(m => m.type !== 'branch-root');
    
    // Sort messages to ensure correct order after branch switch
    const sortedMessages = nonBranchRootMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    console.log(`Adding ${sortedMessages.length} sorted messages from branch ${targetBranchId}`);
    result.push(...sortedMessages);
    
    console.log(`Final branch path has ${result.length} nodes`);
    if (result.length > 0) {
      console.log('First node:', { type: result[0].type, id: result[0].id });
      console.log('Last node:', { type: result[result.length-1].type, id: result[result.length-1].id });
    }
    
    return result;
  }, [allNodes, branches, mainBranchId]);

  // Simplified displayedChatNodes calculation
  const displayedChatNodes = useMemo(() => {
    if (!projectId) {
      return [];
    }

   
    
    // Get the branch path - nodes that should be displayed for the current branch
    const branchPathNodes = getBranchPath(currentBranchId);
    
    // If we're not streaming, just return the branch path
    if (!isStreaming || !streamingContent || !streamingParentId) {
      return branchPathNodes;
    }
    
    // Find the parent message (which should be a user message)
    const parentMessage = branchPathNodes.find(node => node.id === streamingParentId);
    
    if (parentMessage) {
      // Create a temporary assistant message node
      const tempStreamingNode: TimelineNode = {
        id: 'streaming-message', // Fixed ID for streaming message
        project_id: projectId,
        branch_id: parentMessage.branch_id,
        type: 'assistant-message',
        parent_id: parentMessage.id,
        position: parentMessage.position + 1,
        message_text: streamingContent,
        created_at: new Date().toISOString(),
        created_by: 'assistant',
        isLoading: false,
        isStreaming: true,
        // Add other required fields with default values
        ...parentMessage.metadata && { metadata: parentMessage.metadata }
      };
      
      // Return nodes with the streaming message appended
      const result = [...branchPathNodes, tempStreamingNode];
      return result;
    }
    
    // Default: return branch path without streaming
    return branchPathNodes;
  }, [projectId, currentBranchId, getBranchPath, isStreaming, streamingContent, streamingParentId]);

  // Transform nodes for React Flow (Minimap)
  const getNodesForReactFlow = useCallback(() => {
    // Early return if we don't have data
    if (!allNodes.length || !branches.length) return { nodes: [] as Node<BaseNodeData>[], edges: [] as Edge[] };
    
    const flowNodes: Node<BaseNodeData>[] = [];
    const flowEdges: Edge[] = [];
    
    // Calculate branch positions
    const branchMap = new Map<string, BranchMapEntry>();
    
    // Find the main branch (depth 0)
    const mainBranch = branches.find(b => b.depth === 0);
    if (!mainBranch) {
      console.warn('No main branch found');
      return { nodes: [] as Node<BaseNodeData>[], edges: [] as Edge[] };
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
      let direction: 'left' | 'right' | 'auto' = 'auto';
      
      // If we have layout data in branch metadata, use it
      if (branch.metadata?.layout) {
        const layout = branch.metadata.layout;
        
        // Apply proper coordinate scaling from layout service to ReactFlow
        xPosition = centerX + (layout.x * xScaleFactor);
        yOffset = layout.siblingIndex * 30; // Vertical offset based on sibling index
        
        // Use direction from layout data
        direction = layout.direction;
        
        console.log(`Using layout data for branch ${branch.id}: x=${xPosition}, yOffset=${yOffset}, direction=${direction}`);
      } else {
        // Fall back to the old calculation method
        if (branch.depth === 0) {
          xPosition = centerX; // Main branch in center
        } else {
          // Alternate branches left and right of center
          const siblingIndex = branches
            .filter(b => b.parent_branch_id === branch.parent_branch_id)
            .findIndex(b => b.id === branch.id);
          
          const isEven = siblingIndex % 2 === 0;
          const offset = Math.ceil((siblingIndex + 1) / 2) * branchSpacing;
          
          xPosition = isEven 
            ? centerX + offset // Even siblings go right
            : centerX - offset; // Odd siblings go left
          
          direction = isEven ? 'right' : 'left';
        }
      }
      
      branchMap.set(branch.id, {
        depth: branch.depth,
        color: branch.color || getBranchColor(branch.id),
        nodes: [],
        branch,
        xPosition,
        yOffset,
        direction
      });
    });
    
    // Group nodes by branch
    allNodes.forEach(node => {
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
    const rootNode = allNodes.find(n => n.type === 'root');
    if (!rootNode) {
      console.warn('No root node found in data');
      return { nodes: [] as Node<BaseNodeData>[], edges: [] as Edge[] };
    }
    
    // Get the project name (if available)
    const projectName = mainBranch.name || 'Main Line';
    
    // Add root node
    const mainBranchData = branchMap.get(mainBranch.id);
    if (!mainBranchData) {
      console.warn('Main branch data not found');
      return { nodes: [] as Node<BaseNodeData>[], edges: [] as Edge[] };
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
      } as RootNodeData
    });
    
    // Process branch connections first (to establish the subway layout)
    const branchConnections: BranchConnection[] = [];
    
    // Find all branch connections
    branches.forEach(branch => {
      if (branch.parent_branch_id && branch.branch_point_node_id) {
        // Find the branch point node
        const branchPointNode = allNodes.find(n => n.id === branch.branch_point_node_id);
        if (!branchPointNode) return;
        
        // Find the branch root node in this branch
        const branchRootNode = allNodes.find(n => 
          n.type === 'branch-root' && n.branch_id === branch.id
        );
        if (!branchRootNode) return;
        
        // Get direction from layout data if available
        let direction: 'left' | 'right' | 'auto' | undefined = undefined;
        if (branch.metadata?.layout) {
          direction = branch.metadata.layout.direction as 'left' | 'right' | 'auto';
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
    
    // Group branch connections by branch point ID for multi-branch support
    const branchPointConnectionsMap = new Map<string, BranchConnection[]>();
    branchConnections.forEach(connection => {
      if (!branchPointConnectionsMap.has(connection.branchPointId)) {
        branchPointConnectionsMap.set(connection.branchPointId, []);
      }
      branchPointConnectionsMap.get(connection.branchPointId)?.push(connection);
    });
    
    // Map to store actual branch point Y positions for use in positioning branch roots
    const branchPointYPositions = new Map<string, number>();
    // Map to store branch root Y positions for use in positioning stations
    const branchRootYPositions = new Map<string, number>();
    
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
      
      const stations: Station[] = [];
      
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
          // Check if the branch point has a calculated Y position already
          const parentBranchPointY = branchPointYPositions.get(connection.branchPointId);
          
          if (parentBranchPointY) {
            // Use the exact Y position of the branch point
            branchRootYPosition = parentBranchPointY;
          } else {
            // Calculate based on position in the parent branch
            branchRootYPosition = 150 + (connection.position * 100);
          }
          
          // Store the branch root Y position for future reference
          branchRootYPositions.set(branchId, branchRootYPosition);
          
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
            } as BranchRootNodeData
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
          // Get all child branch connections for this branch point
          const childConnections = branchPointConnectionsMap.get(station.branchPoint.id) || [];
          
          if (childConnections.length > 0) {
            // Collect branch data for all connections
            const childBranches = childConnections.map(conn => {
              const childBranchData = branchMap.get(conn.childBranchId);
              if (!childBranchData) return null;
              
              // Determine direction if not explicitly set
              const direction = conn.direction || 
                (childBranchData.xPosition > xPosition ? 'right' : 'left');
              
              return {
                branchId: conn.childBranchId,
                branchData: childBranchData,
                direction,
                connection: conn,
                // Initialize with a default handleId that will be updated
                handleId: direction === 'right' ? 'right' : 'left'
              };
            }).filter(Boolean) as Array<{
              branchId: string;
              branchData: typeof branchMap extends Map<string, infer T> ? T : never;
              direction: string;
              connection: BranchConnection;
              handleId: string; // Make it required since we always set it
            }>;
            
            // Group branches by direction to assign unique handles
            const rightBranches = childBranches.filter(b => b.direction === 'right');
            const leftBranches = childBranches.filter(b => b.direction !== 'right');
            
            // Assign handle IDs to branches
            childBranches.forEach(branch => {
              const isRightDirection = branch.direction === 'right';
              const directionBranches = isRightDirection ? rightBranches : leftBranches;
              const branchIndex = directionBranches.findIndex(b => b.branchId === branch.branchId);
              
              // Assign unique handle ID based on direction and index
              branch.handleId = directionBranches.length > 1 
                ? `${isRightDirection ? 'right' : 'left'}-${branchIndex}`
                : isRightDirection ? 'right' : 'left';
            });
            
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
                branchId,
                isActive,
                childBranches: childBranches.map(branch => ({
                  branchId: branch.branchId,
                  branchColor: branch.branchData.color,
                  branchName: branch.branchData.branch.name || 'Branch',
                  direction: branch.direction as 'left' | 'right' | 'auto',
                  isOnActivePath: activeBranches.has(branch.branchId),
                  handleId: branch.handleId
                })),
                leftBranch: leftBranches.length > 0 ? {
                  branchId: leftBranches[0].branchId,
                  branchColor: branchMap.get(leftBranches[0].branchId)?.color || '',
                  branchName: branchMap.get(leftBranches[0].branchId)?.branch.name || 'Left Branch',
                  isOnActivePath: activeBranches.has(leftBranches[0].branchId)
                } : undefined,
                rightBranch: rightBranches.length > 0 ? {
                  branchId: rightBranches[0].branchId,
                  branchColor: branchMap.get(rightBranches[0].branchId)?.color || '',
                  branchName: branchMap.get(rightBranches[0].branchId)?.branch.name || 'Right Branch',
                  isOnActivePath: activeBranches.has(rightBranches[0].branchId)
                } : undefined
              } as BranchPointNodeData
            });
            
            // Store the actual Y position of this branch point for its child branches to reference
            branchPointYPositions.set(station.branchPoint.id, station.yPosition);
            
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
                  strokeLinecap: 'round',
                  opacity: isActive ? 1 : 0.85,
                }
              });
            }
            
            // Add connections for all child branches
            childBranches.forEach((childBranch, childIndex) => {
              if (!station.branchPoint) return;
              
              // Add a curved connection from branch point to branch root
              flowEdges.push({
                id: `edge-branch-${station.branchPoint.id}-${childBranch.connection.branchRootId}`,
                source: station.branchPoint.id,
                target: childBranch.connection.branchRootId,
                type: 'default', // Use default bezier curve for smoother transitions
                animated: activeBranches.has(childBranch.branchId),
                // Use the handleId assigned to this branch
                sourceHandle: childBranch.handleId,
                // Use 'left' for right branches and 'right' for left branches
                targetHandle: childBranch.direction === 'right' ? 'left' : 'right',
                style: { 
                  stroke: childBranch.branchData.color, 
                  strokeWidth: activeBranches.has(childBranch.branchId) ? 4 : 3,
                  strokeOpacity: activeBranches.has(childBranch.branchId) ? 1 : 0.85,
                  strokeLinecap: 'round',
                  opacity: activeBranches.has(childBranch.branchId) ? 1 : 0.85,
                  strokeDasharray: activeBranches.has(childBranch.branchId) ? undefined : '0',
                }
              });
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
            } as StationNodeData
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
                strokeLinecap: 'round',
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
    
    // Fix for already created branch roots - update their positions based on branch point positions
    flowNodes.forEach(node => {
      if (node.type === 'branchRootNode') {
        // Find the connection for this branch root
        const connection = branchConnections.find(c => c.branchRootId === node.id);
        if (connection) {
          // Get the actual Y position of the branch point
          const branchPointY = branchPointYPositions.get(connection.branchPointId);
          if (branchPointY !== undefined) {
            // Update the branch root Y position to match the branch point
            node.position.y = branchPointY;
          }
        }
      }
    });
    
    return { nodes: flowNodes, edges: flowEdges };
  }, [allNodes, branches, currentBranchId, getBranchColor]);

  // Fix polling effect to use displayedChatNodes instead of displayedNodes
  useEffect(() => {
    if (!pollingInterval || !projectId || projectLoading) return;
    
    const interval = setInterval(() => {
      // Only poll if we're possibly waiting for an AI response
      const lastMessage = displayedChatNodes.length > 0 ? displayedChatNodes[displayedChatNodes.length - 1] : null;
      if (lastMessage && (lastMessage.type === 'user-message' || (lastMessage.optimistic && lastMessage.isLoading))) {
        fetchData();
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [displayedChatNodes, pollingInterval, projectId, projectLoading, fetchData]);

  // The context value
  const contextValue = useMemo<ConversationContextValue>(() => ({
    // Data
    branches,
    allNodes,
    displayedChatNodes,
    
    // State
    projectId,
    currentBranchId,
    loading,
    
    // Simplified streaming state
    isStreaming,
    streamingContent,
    streamingParentId,
    
    // Actions
    fetchData,
    recalculateLayout,
    switchBranch,
    createBranch,
    updateStreamingContent,
    sendMessage,
    
    // Utility
    getBranchColor,
    getBranchName,
    getBranchPath,
    getNodesForReactFlow,
  }), [
    branches,
    allNodes,
    displayedChatNodes,
    projectId,
    currentBranchId,
    loading,
    projectLoading,
    // New simplified streaming dependencies
    isStreaming,
    streamingContent,
    streamingParentId,
    fetchData,
    recalculateLayout,
    switchBranch,
    createBranch,
    updateStreamingContent,
    sendMessage,
    getBranchColor,
    getBranchName,
    getBranchPath,
    getNodesForReactFlow
  ]);

  // Add ready state to prevent rendering until project is ready
  if (!isReady) {
    return (
      <ConversationContext.Provider 
        value={{
          ...contextValue,
          loading: { ...contextValue.loading, data: true, layout: true }
        }}
      >
        {children}
      </ConversationContext.Provider>
    );
  }

  return (
    <ConversationContext.Provider value={contextValue}>
      {children}
    </ConversationContext.Provider>
  );
};

// Hook to use the conversation context
export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}; 