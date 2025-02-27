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
  displayedNodes: TimelineNode[];
  layoutData: Record<string, BranchLayout> | null;
  
  // State
  projectId: string;
  currentBranchId: string | null;
  loading: {
    data: boolean;
    layout: boolean;
  };
  optimisticMessages: TimelineNode[];
  streamingMessageId: string | null;
  streamingContent: string | null;
  
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
  handleOptimisticUpdate: (newMessages: TimelineNode[]) => void;
  updateStreamingContent: (content: string | null) => void;
  sendMessage: (text: string) => Promise<void>;
  updateMessageState: (params: {
    action: 'create' | 'update' | 'stream' | 'error';
    userMessage?: string;
    parentId?: string;
    streamContent?: string;
    messageId?: string;
    errorMessage?: string;
  }) => any;
  
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
  const { selectedProjectId, mainBranchId } = useProject();
  
  // Ensure we have a valid project ID
  const projectId = selectedProjectId || '';

  // Data state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allNodes, setAllNodes] = useState<TimelineNode[]>([]);
  const [layoutData, setLayoutData] = useState<Record<string, BranchLayout> | null>(null);
  
  // UI state
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<TimelineNode[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    data: true,
    layout: false,
  });

  // Add debugging logs
  useEffect(() => {
    console.log('🔍 DEBUG: ConversationProvider initialized with:');
    console.log('🔍 DEBUG: - projectId:', projectId, typeof projectId);
    console.log('🔍 DEBUG: - currentBranchId:', currentBranchId, typeof currentBranchId);
  }, [projectId, currentBranchId]);

  // Reset state when project changes
  useEffect(() => {
    // Clear state when project changes
    setBranches([]);
    setAllNodes([]);
    setLayoutData(null);
    setOptimisticMessages([]);
    setStreamingMessageId(null);
    setStreamingContent(null);
    
    // Reset to main branch when project changes
    setCurrentBranchId(null);
    
    // Set loading state
    setLoading({
      data: true,
      layout: true,
    });
    
    // Fetch data for the new project if we have a valid project ID
    if (projectId) {
      fetchData();
      fetchLayoutData();
    }
  }, [projectId]);

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
    if (!projectId) return;
    
    console.log('🔍 DEBUG: Fetching data for project:', projectId, 'branch:', currentBranchId || 'main');
    setLoading(prev => ({ ...prev, data: true }));
    
    try {
      // Fetch data in parallel for better performance
      const [branchesData, nodesData] = await Promise.all([
        fetchBranches(),
        fetchNodes(),
      ]);
      
      // Log the data we received
      console.log('🔍 DEBUG: Fetched data:', {
        branchesCount: branchesData.length,
        nodesCount: nodesData.length,
        hasRootNode: nodesData.some(node => node.type === 'root')
      });
      
      // Log the root node if found
      const rootNode = nodesData.find(node => node.type === 'root');
      if (rootNode) {
        console.log('🔍 DEBUG: Root node in fetched data:', {
          id: rootNode.id,
          branch_id: rootNode.branch_id,
          type: rootNode.type
        });
      }
      
      // Cleanup optimistic messages that now have real versions
      if (optimisticMessages.length > 0) {
        setTimeout(() => {
          const updatedOptimisticMessages = optimisticMessages.filter(optMsg => {
            // For user messages, check if a real message with same content exists
            if (optMsg.type === 'user-message') {
              return !nodesData.some((realMsg: TimelineNode) => 
                realMsg.type === 'user-message' && 
                (realMsg.message_text === optMsg.message_text || realMsg.id === optMsg.id)
              );
            }
            
            // For AI messages, keep if still streaming
            if (optMsg.type === 'assistant-message') {
              if (optMsg.isLoading) return true;
              if (optMsg.id === streamingMessageId && streamingContent !== null) return true;
              
              return !nodesData.some((realMsg: TimelineNode) => 
                realMsg.type === 'assistant-message' &&
                (realMsg.parent_id === optMsg.parent_id || realMsg.id === optMsg.id)
              );
            }
            
            return true;
          });
          
          setOptimisticMessages(updatedOptimisticMessages);
        }, 100);
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

  // Handle optimistic updates for new messages
  const handleOptimisticUpdate = useCallback((newMessages: TimelineNode[]) => {
    console.log('Adding optimistic messages:', newMessages);
    
    // Get the streaming message ID if any
    const aiMessage = newMessages.find(m => m.type === 'assistant-message' && m.optimistic);
    if (aiMessage) {
      setStreamingMessageId(aiMessage.id);
    }
    
    // Update optimistic messages
    setOptimisticMessages(prev => {
      // Create a new array to hold updated messages
      const updated = [...prev];
      
      // Process each new message
      for (const newMsg of newMessages) {
        // Check if this message already exists in our array
        const existingIndex = updated.findIndex(msg => msg.id === newMsg.id);
        
        if (existingIndex >= 0) {
          // Update existing message
          updated[existingIndex] = newMsg;
        } else {
          // Add new message
          updated.push(newMsg);
        }
      }
      
      return updated;
    });
  }, []);

  // Update streaming content
  const updateStreamingContent = useCallback((content: string | null) => {
    setStreamingContent(content);
  }, []);

  // Create a unified message update function that handles both optimistic UI and streaming updates
  const updateMessageState = useCallback((params: {
    action: 'create' | 'update' | 'stream' | 'error';
    userMessage?: string;
    parentId?: string;
    streamContent?: string;
    messageId?: string;
    errorMessage?: string;
  }) => {
    const { action, userMessage, parentId, streamContent, messageId, errorMessage } = params;
    
    switch (action) {
      case 'create': {
        // Create new optimistic messages (user + empty AI response)
        if (!userMessage || !parentId) return;
        
        const timestamp = new Date().toISOString();
        const effectiveBranchId = currentBranchId || '';
        const optimisticUserId = uuidv4();
        const optimisticAiId = uuidv4();
        
        // User message
        const optimisticUserMessage: TimelineNode = {
          id: optimisticUserId,
          project_id: projectId,
          branch_id: effectiveBranchId,
          parent_id: parentId,
          type: 'user-message' as NodeType,
          message_text: userMessage,
          message_role: 'user',
          position: 0,
          created_by: 'user',
          created_at: timestamp,
          optimistic: true
        };
        
        // AI message (empty at first)
        const optimisticAiMessage: TimelineNode = {
          id: optimisticAiId,
          project_id: projectId,
          branch_id: effectiveBranchId,
          parent_id: optimisticUserId,
          type: 'assistant-message' as NodeType,
          message_text: '',
          message_role: 'assistant',
          position: 0,
          created_by: 'assistant',
          created_at: timestamp,
          optimistic: true,
          isLoading: true
        };
        
        // Add both messages to the UI
        handleOptimisticUpdate([optimisticUserMessage, optimisticAiMessage]);
        
        // Set streaming message ID and initialize content
        setStreamingMessageId(optimisticAiId);
        setStreamingContent('');
        
        return {
          optimisticUserId,
          optimisticAiId,
          optimisticUserMessage,
          optimisticAiMessage
        };
      }
      
      case 'stream': {
        // Update streaming message content
        if (streamContent === undefined) return;
        
        // Update the streaming content state
        setStreamingContent(streamContent);
        
        // Find the currently streaming message
        if (streamingMessageId) {
          // Update the optimistic message with new content
          setOptimisticMessages(prev => {
            return prev.map(msg => {
              if (msg.id === streamingMessageId) {
                return {
                  ...msg,
                  message_text: streamContent,
                  isLoading: false
                };
              }
              return msg;
            });
          });
        }
        break;
      }
      
      case 'update': {
        // Update a specific message
        if (!messageId) return;
        
        setOptimisticMessages(prev => {
          return prev.map(msg => {
            if (msg.id === messageId) {
              return {
                ...msg,
                ...(streamContent && { message_text: streamContent }),
                isLoading: false
              };
            }
            return msg;
          });
        });
        break;
      }
      
      case 'error': {
        // Show error message in the optimistic AI message
        const errorText = errorMessage || "I'm sorry, I encountered an error processing your request. Please try again.";
        
        setOptimisticMessages(prev => {
          return prev.map(msg => {
            // Find the AI message that's loading
            if (msg.type === 'assistant-message' && (msg.isLoading || msg.id === streamingMessageId)) {
              return {
                ...msg,
                message_text: errorText,
                isLoading: false
              };
            }
            return msg;
          });
        });
        
        // Clear streaming state
        setStreamingMessageId(null);
        setStreamingContent(null);
        break;
      }
    }
  }, [currentBranchId, handleOptimisticUpdate, projectId, streamingMessageId]);

  // Now update the sendMessage method to use the new unified update function
  const sendMessage = async (text: string): Promise<void> => {
    if (!projectId) throw new Error('No project selected');
    if (!text.trim()) return;
    
    try {
      // Get the last message to use as parent
      const lastNode = getLastMessageNode();
      if (!lastNode) throw new Error('No parent node found');
      
      // Create optimistic updates using the unified method
      const optimisticData = updateMessageState({
        action: 'create',
        userMessage: text,
        parentId: lastNode.id
      });
      
      if (!optimisticData) return;
      
      // Submit the message with streaming enabled
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          branch_id: currentBranchId || '',
          parent_id: lastNode.id,
          text: text.trim(),
          created_by: 'user',
          stream: true
        })
      });
      
      // Handle streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        await processStreamingResponse(
          response,
          (streamedText) => {
            // Use unified method for streaming updates
            updateMessageState({
              action: 'stream',
              streamContent: streamedText
            });
          },
          () => {
            // When streaming is complete, clear streaming state and refresh data
            setStreamingMessageId(null);
            setStreamingContent(null);
            fetchData();
          }
        );
      } else {
        // Handle non-streaming response
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} ${errorText}`);
        }
        
        // Just refresh data
        fetchData();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error message using the unified method
      updateMessageState({
        action: 'error',
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  };
  
  // Get the last message node to use as parent for new messages
  const getLastMessageNode = (): TimelineNode | null => {
    if (!allNodes || allNodes.length === 0) return null;
    
    // Find messages in the current branch
    const branchMessages = currentBranchId 
      ? allNodes.filter(node => node.branch_id === currentBranchId)
      : allNodes;
    
    // First try to find the last user or assistant message
    const sortedMessages = [...branchMessages]
      .filter(node => node.type === 'user-message' || node.type === 'assistant-message')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    if (sortedMessages.length > 0) return sortedMessages[0];
    
    // If no messages in current branch, find the branch root or project root
    const rootNode = currentBranchId
      ? branchMessages.find(node => node.type === 'branch-root')
      : allNodes.find(node => node.type === 'root');
    
    return rootNode || null;
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
    if (!allNodes.length) return [];

    // If no specific branch is selected, show messages from the main branch
    if (!targetBranchId) {
      // Find the root node
      const rootNode = allNodes.find(m => m.type === 'root');
      if (!rootNode) return [];
      
      const mainBranchId = rootNode.branch_id;
      return allNodes
        .filter(m => m.branch_id === mainBranchId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    
    // If a specific branch is selected, build the full path from root to the current branch
    const result: TimelineNode[] = [];
    
    // First, find all nodes in the target branch
    const branchMessages = allNodes
      .filter(m => m.branch_id === targetBranchId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    if (!branchMessages.length) return [];
    
    // Find the branch in our branches list
    const currentBranch = branches.find(b => b.id === targetBranchId);
    if (!currentBranch) return branchMessages;
    
    // If this branch has a parent branch, we need to include messages from the parent branch
    if (currentBranch.parent_branch_id) {
      // Find the branch point node
      const branchPointNode = allNodes.find(m => m.id === currentBranch.branch_point_node_id);
      
      if (branchPointNode) {
        // Recursively build the parent branch path up to the branch point
        const parentPath = getBranchPath(currentBranch.parent_branch_id);
        
        // Only include parent messages up to the branch point
        const branchPointIndex = parentPath.findIndex(m => m.id === branchPointNode.id);
        if (branchPointIndex !== -1) {
          result.push(...parentPath.slice(0, branchPointIndex + 1));
        }
      }
    }
    
    // Add the branch messages to the result, excluding the branch-root node
    const nonBranchRootMessages = branchMessages.filter(m => m.type !== 'branch-root');
    
    // Sort messages to ensure correct order after branch switch
    const sortedMessages = nonBranchRootMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    result.push(...sortedMessages);
    
    return result;
  }, [allNodes, branches]);

  // Get combined messages (real + optimistic)
  const displayedNodes = useMemo(() => {
    // Combine real and optimistic messages
    let combined = [...allNodes];
    
    if (optimisticMessages.length > 0) {
      // Process optimistic messages one by one to avoid duplicates
      for (const optMsg of optimisticMessages) {
        // Check if this optimistic message is already represented in allMessages
        const existsInAll = allNodes.some(m => 
          // Either exact ID match
          m.id === optMsg.id ||
          // Or same content and type in the same branch
          (m.message_text === optMsg.message_text && 
           m.type === optMsg.type && 
           m.branch_id === optMsg.branch_id) ||
          // Or AI message with the same parent (to catch when content differs but it's the same logical message)
          (optMsg.type === 'assistant-message' && m.type === 'assistant-message' && 
           optMsg.parent_id === m.parent_id)
        );
        
        // Only add if it doesn't exist in regular messages
        if (!existsInAll) {
          combined.push(optMsg);
        }
      }
    }
    
    // Apply message path building with combined messages
    return getBranchPath(currentBranchId);
  }, [allNodes, optimisticMessages, currentBranchId, getBranchPath]);

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
                branchId: branchId,
                isActive: isActive,
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

  // Set up polling
  useEffect(() => {
    if (!pollingInterval || !projectId) return;
    
    const interval = setInterval(() => {
      // Only poll if we're possibly waiting for an AI response
      const lastMessage = displayedNodes[displayedNodes.length - 1];
      if (lastMessage && (lastMessage.type === 'user-message' || (lastMessage.optimistic && lastMessage.isLoading))) {
        fetchData();
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [displayedNodes, pollingInterval, projectId]);

  // The context value
  const contextValue = useMemo<ConversationContextValue>(() => ({
    // Data
    branches,
    allNodes,
    displayedNodes,
    layoutData,
    
    // State
    projectId,
    currentBranchId,
    loading,
    optimisticMessages,
    streamingMessageId,
    streamingContent,
    
    // Actions
    fetchData,
    fetchLayoutData,
    recalculateLayout,
    switchBranch,
    createBranch,
    handleOptimisticUpdate,
    updateStreamingContent,
    sendMessage,
    updateMessageState,
    
    // Utility
    getBranchColor,
    getBranchName,
    getBranchPath,
    getNodesForReactFlow,
  }), [
    branches,
    allNodes,
    displayedNodes,
    layoutData,
    projectId,
    currentBranchId,
    loading,
    optimisticMessages,
    streamingMessageId,
    streamingContent,
    fetchData,
    fetchLayoutData,
    recalculateLayout,
    switchBranch,
    createBranch,
    handleOptimisticUpdate,
    updateStreamingContent,
    sendMessage,
    updateMessageState,
    getBranchColor,
    getBranchName,
    getBranchPath,
    getNodesForReactFlow
  ]);

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