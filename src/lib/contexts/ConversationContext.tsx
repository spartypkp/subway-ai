import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Branch, TimelineNode } from '@/lib/types/database';
import { BranchLayout } from '@/lib/layout/subwayLayoutService';
import { query } from '@/lib/db';

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
  switchBranch: (branchId: string) => void;
  createBranch: (params: {
    branchPointNodeId: string;
    name?: string;
    createdBy?: string;
  }) => Promise<string>;
  handleOptimisticUpdate: (newMessages: TimelineNode[]) => void;
  updateStreamingContent: (content: string | null) => void;
  
  // Utility functions
  getBranchColor: (branchId: string) => string;
  getBranchName: (branchId: string) => string;
  getBranchPath: (targetBranchId: string | null) => TimelineNode[];
  getNodesForReactFlow: () => { nodes: any[]; edges: any[] };
}

// Create the context with a default undefined value
const ConversationContext = createContext<ConversationContextValue | undefined>(undefined);

// Props for the provider component
interface ConversationProviderProps {
  projectId: string;
  initialBranchId?: string | null;
  children: ReactNode;
  pollingInterval?: number;
}

export const ConversationProvider: React.FC<ConversationProviderProps> = ({
  projectId,
  initialBranchId = null,
  children,
  pollingInterval = 5000,
}) => {
  // Add debugging logs
  useEffect(() => {
    console.log('🔍 DEBUG: ConversationProvider initialized with:');
    console.log('🔍 DEBUG: - projectId:', projectId, typeof projectId);
    console.log('🔍 DEBUG: - initialBranchId:', initialBranchId, typeof initialBranchId);
  }, [projectId, initialBranchId]);

  // Data state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allNodes, setAllNodes] = useState<TimelineNode[]>([]);
  const [layoutData, setLayoutData] = useState<Record<string, BranchLayout> | null>(null);
  
  // UI state
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(initialBranchId);
  const [optimisticMessages, setOptimisticMessages] = useState<TimelineNode[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    data: true,
    layout: false,
  });

  // Fetch all branches for the project
  const fetchBranches = async (): Promise<Branch[]> => {
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
  const switchBranch = useCallback((branchId: string) => {
    console.log('Switching to branch:', branchId);
    
    // Prevent switching to the same branch
    if (branchId === currentBranchId) {
      console.log('Already on branch:', branchId);
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
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...newMsg,
            // Preserve the ID to ensure we update the right message
            id: updated[existingIndex].id
          };
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
    
    if (content !== null && streamingMessageId) {
      setOptimisticMessages(prev => 
        prev.map(msg => 
          msg.id === streamingMessageId
            ? { ...msg, message_text: content, isLoading: false }
            : msg
        )
      );
    } else if (content === null) {
      // Reset streamingMessageId when streaming ends
      setStreamingMessageId(null);
    }
  }, [streamingMessageId]);

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
    // This is a placeholder - we'll implement the transformation logic
    // that's currently in the Minimap component
    return {
      nodes: [],
      edges: []
    };
  }, [allNodes, branches, layoutData]);

  // Initial data load
  useEffect(() => {
    fetchData();
    fetchLayoutData();
  }, [projectId]);

  // Set up polling
  useEffect(() => {
    if (!pollingInterval) return;
    
    const interval = setInterval(() => {
      // Only poll if we're possibly waiting for an AI response
      const lastMessage = displayedNodes[displayedNodes.length - 1];
      if (lastMessage && (lastMessage.type === 'user-message' || (lastMessage.optimistic && lastMessage.isLoading))) {
        fetchData();
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [displayedNodes, pollingInterval]);

  // The context value
  const contextValue: ConversationContextValue = {
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
    
    // Utility
    getBranchColor,
    getBranchName,
    getBranchPath,
    getNodesForReactFlow,
  };

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