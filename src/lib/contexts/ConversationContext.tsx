"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Branch, TimelineNode, NodeType } from '@/lib/types/database';
import { BranchLayout } from '@/lib/layout/subwayLayoutService';
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
  childBranchColor: string;
  isOnActivePath: boolean;
  childBranchName: string;
  childBranchDirection: 'left' | 'right' | 'auto';
  childCount: number;
  siblingIndex: number;
}

interface StationNodeData extends BaseNodeData {
  userContent: string;
  assistantContent: string;
  timestamp: string;
  calculatedWidth: number;
  stationNumber: number;
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

  layoutData: Record<string, BranchLayout> | null;
  
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
  fetchLayoutData: () => Promise<void>;
  recalculateLayout: () => Promise<void>;
  switchBranch: (branchId: string | null) => void;
  createBranch: (params: {
    branchPointNodeId: string;
    name?: string;
    createdBy?: string;
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
  const [layoutData, setLayoutData] = useState<Record<string, BranchLayout> | null>(null);
  
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
      console.log('🔍 console.log: - projectId:', projectId, typeof projectId);
      console.log('🔍 console.log: - currentBranchId:', currentBranchId, typeof currentBranchId);
      console.log('🔍 console.log: - projectLoading:', projectLoading);
      console.log('🔍 console.log: - mainBranchId:', mainBranchId);
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
    setLayoutData(null);
    
    // Reset to main branch when project changes
    setCurrentBranchId(null);
    
    // Set loading state
    setLoading({
      data: true,
      layout: true,
    });
    
    // Fetch data for the new project if we have a valid project ID AND project loading is complete
    if (projectId && !projectLoading) {
      console.log('🔍 console.log: Project is ready, fetching data');
      fetchData();
      fetchLayoutData();
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

  // Fetch layout data for branches
  const fetchLayoutData = async (): Promise<void> => {
    if (!projectId) return;
    
    setLoading(prev => ({ ...prev, layout: true }));
    try {
      const response = await fetch(`/api/projects/${projectId}/layout`);
      if (!response.ok) {
        throw new Error(`Failed to fetch layout data: ${response.status}`);
      }
      const data = await response.json();
      setLayoutData(data);
    } catch (error) {
      console.error('Failed to fetch layout data:', error);
    } finally {
      setLoading(prev => ({ ...prev, layout: false }));
    }
  };

  // Recalculate layout for all branches
  const recalculateLayout = async (): Promise<void> => {
    if (!projectId) return;
    
    setLoading(prev => ({ ...prev, layout: true }));
    try {
      const response = await fetch(`/api/projects/${projectId}/layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceRecalculate: true }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to recalculate layout: ${response.status}`);
      }
      
      // Fetch the updated layout data
      await fetchLayoutData();
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
    
    console.log(`Fetching data for project: ${projectId}, branch: ${currentBranchId || 'main'}`);
    console.log(`Current streaming state: messageId=${streamingParentId}, contentLength=${streamingContent?.length || 0}`);
    
    setLoading(prev => ({ ...prev, data: true }));
    
    try {
      // Fetch data in parallel for better performance
      const [branchesData, nodesData] = await Promise.all([
        fetchBranches(),
        fetchNodes(),
      ]);
      
      // Enhanced logging
      console.log('Fetched data:', {
        branchesCount: branchesData.length,
        nodesCount: nodesData.length,
        hasRootNode: nodesData.some(node => node.type === 'root'),
        messageCounts: {
          userMessages: nodesData.filter(n => n.type === 'user-message').length,
          assistantMessages: nodesData.filter(n => n.type === 'assistant-message').length,
          roots: nodesData.filter(n => n.type === 'root').length,
          branchRoots: nodesData.filter(n => n.type === 'branch-root').length,
          branchPoints: nodesData.filter(n => n.type === 'branch-point').length
        }
      });
      
      // Get unique branch IDs in the data
      const branchIds = [...new Set(nodesData.map(node => node.branch_id))];
      console.log('Unique branch IDs in fetched nodes:', branchIds);
      
      // Log the available branches
      console.log('Available branches:', branchesData.map(b => ({ id: b.id, name: b.name })));
      
      // Log the root node if found
      const rootNode = nodesData.find(node => node.type === 'root');
      if (rootNode) {
        console.log('Root node in fetched data:', {
          id: rootNode.id,
          branch_id: rootNode.branch_id,
          type: rootNode.type
        });
      } else {
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
    console.log('Switching to branch:', branchId || 'main');
    
    // Prevent switching to the same branch
    if (branchId === currentBranchId) {
      console.log('Already on branch:', branchId || 'main');
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
  }): Promise<string> => {
    if (!projectId) throw new Error('No project selected');
    
    const { branchPointNodeId, name, createdBy = 'user' } = params;
    
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
          created_by: createdBy
        })
      });
      
      if (!response.ok) throw new Error('Failed to create branch');
      
      const result = await response.json();
      
      // Refresh data after creating branch
      await fetchData();
      
      // Also refresh layout since we have a new branch
      await fetchLayoutData();
      
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
      console.log('Streaming has ended, fetching data immediately');
      
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
      console.log('Finding parent node for new message');
      
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
      console.log(`Saving user message to database with parent_id: ${parentId}, branch_id: ${targetBranchId}`);
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
      console.log('Raw user message response:', userMessageResponseText);
      
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
      console.log(`User message saved with ID: ${userMessageId}`);
      
      // 2. Refetch data to update UI with user message
      await fetchData();
      
      // 3. Set streaming flag
      setIsStreaming(true);
      setStreamingContent('');
      setStreamingParentId(userMessageId);
      console.log(`Started streaming for parent message: ${userMessageId}`);
      
      // 4. Make API call for assistant response with streaming
      console.log(`Requesting assistant response for user message: ${userMessageId}`);
      
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
      
      console.log(`Full request payload: ${JSON.stringify(requestPayload)}`);
      
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
          console.log(`Streaming complete. Final content length: ${responseText.length}`);
          updateStreamingContent(null); // This will clear streaming state and fetch data
        }
      } else {
        // Handle non-streaming response
        if (!assistantResponse.ok) {
          const errorText = await assistantResponse.text();
          throw new Error(`Server error: ${assistantResponse.status} ${errorText}`);
        }
        
        // Just refresh data
        console.log('Non-streaming response completed, refreshing data');
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
  
  // Get branch color based on branch ID
  const getBranchColor = useCallback((branchId: string): string => {
    // First check if we have this branch in our branches list
    const branch = branches.find(b => b.id === branchId);
    if (branch && branch.color) {
      return branch.color;
    }
    
    // Fallback colors if branch not found or has no color
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
    
    // Simple hash of branchId to pick a color
    const hash = branchId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return colors[hash % colors.length];
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

    console.log('Calculating displayedChatNodes');
    
    // Get the branch path - nodes that should be displayed for the current branch
    const branchPathNodes = getBranchPath(currentBranchId);
    console.log(`getBranchPath returned ${branchPathNodes.length} nodes for branch ${currentBranchId || 'main'}`);
    
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
      console.log(`Added streaming node. Total nodes: ${result.length}`);
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
      
      // If we have layout data for this branch, use it
      if (layoutData && layoutData[branch.id]) {
        const layout = layoutData[branch.id];
        
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
        if (layoutData && layoutData[branch.id]) {
          direction = layoutData[branch.id].direction;
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
                branchId,
                isActive,
                isOnActivePath: isActive && activeBranches.has(childBranchConnection.childBranchId),
                childBranchName: childBranchData.branch.name || 'Branch',
                childBranchDirection: branchDirection,
                childCount: childBranchData.branch.metadata?.siblingCount || 1,
                siblingIndex: childBranchData.branch.metadata?.siblingIndex || 0
              } as BranchPointNodeData
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
                  strokeLinecap: 'round',
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
                strokeLinecap: 'round',
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
    
    return { nodes: flowNodes, edges: flowEdges };
  }, [allNodes, branches, currentBranchId, layoutData, getBranchColor]);

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
    layoutData,
    
    // State
    projectId,
    currentBranchId,
    loading: {
      ...loading,
      // Add projectLoading to our loading state to indicate we're waiting for project data
      data: loading.data || projectLoading 
    },
    
    // New simplified streaming state
    isStreaming,
    streamingContent,
    streamingParentId,
    
    // Actions
    fetchData,
    fetchLayoutData,
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
    layoutData,
    projectId,
    currentBranchId,
    loading,
    projectLoading,
    // New simplified streaming dependencies
    isStreaming,
    streamingContent,
    streamingParentId,
    fetchData,
    fetchLayoutData,
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