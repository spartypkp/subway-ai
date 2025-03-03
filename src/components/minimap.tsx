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
import { GitBranch, MessageSquare, Train, RefreshCw, Bug, MoreHorizontal, PenLine, Trash2, Info, GitMerge, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversation,  } from '@/lib/contexts/ConversationContext';
import { ElkDebug } from './elk-debug';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";


// Define props interface
interface MinimapProps {
  onSelectNode?: (nodeId: string) => void;
}



// Custom node for branch points (where branches diverge)
function BranchPointNode({ data }: NodeProps) {
  // Use the detailed data from childBranches array
  const { childBranches = [], color, isActive, isOnActivePath } = data;
  
  // Count child branches
  const childCount = childBranches.length;
  const hasMultipleChildren = childCount > 1;
  
  return (
    <div 
      className={cn(
        "p-1 rounded-full shadow-md flex items-center justify-center bg-white transition-all duration-300",
        isActive ? "ring-2 ring-offset-1 shadow-lg" : "hover:shadow-md",
        isOnActivePath ? "scale-110" : "",
        hasMultipleChildren ? "ring-1 ring-offset-1" : ""
      )}
      style={{ 
        borderColor: color,
        border: `2px solid ${color}`,
        width: '32px',
        height: '32px',
        background: isActive ? '#f8fafc' : 'white',
        boxShadow: isOnActivePath ? `0 0 8px rgba(${hexToRgb(color)}, 0.5)` : undefined,
      }}
      title={`Branch point with ${childCount} ${childCount === 1 ? 'branch' : 'branches'}`}
    >
      <GitBranch size={16} style={{ color: color }} />
      
      {/* Show a small indicator for multiple branches */}
      {hasMultipleChildren && (
        <div className="absolute -bottom-1 -right-1 bg-gray-100 rounded-full w-4 h-4 border border-gray-300 flex items-center justify-center">
          <span className="text-[8px] font-bold text-gray-700">{childCount}</span>
        </div>
      )}
      
      {/* Main branch continuation handles */}
      <Handle 
        id="target-main"
        type="target" 
        position={Position.Top} 
        style={{ 
          background: color, 
          width: '8px', 
          height: '8px',
          top: '-4px',
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
          background: color, 
          width: '8px', 
          height: '8px',
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }}
      />
      
      {/* Dynamically render handles for each child branch */}
      {childBranches.map((branch: {
        branchId: string;
        branchColor: string;
        branchName: string;
        direction: 'left' | 'right' | 'auto';
        isOnActivePath: boolean;
        handleId?: string;
      }, index: number) => {
        const direction = branch.direction === 'auto' 
          ? (index % 2 === 0 ? 'right' : 'left') 
          : branch.direction;
        
        const position = direction === 'right' ? Position.Right : Position.Left;
        
        return (
      <Handle 
            key={branch.handleId || `branch-${index}`}
            id={branch.handleId || direction}
        type="source" 
            position={position}
        style={{ 
              background: branch.branchColor, 
          width: '8px', 
          height: '8px',
          borderWidth: '2px',
          borderColor: 'white',
              [direction === 'right' ? 'right' : 'left']: '-4px',
              // For multiple handles on the same side, offset them slightly
              top: hasMultipleChildren 
                ? `${40 + (index * 15)}%` 
                : '50%',
          transform: 'translateY(-50%)',
              zIndex: 1,
              opacity: branch.isOnActivePath ? 1 : 0.75
            }} 
          />
        );
      })}
    </div>
  );
}

// Branch management menu component
function BranchManagementMenu({ 
  branchId, 
  branchName, 
  color, 
  onClose 
}: { 
  branchId: string, 
  branchName: string, 
  color: string,
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'rename' | 'notes' | 'merge' | null>(null);
  const [newName, setNewName] = useState(branchName);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Get conversation context for branch operations
  const { 
    fetchData,
    recalculateLayout,
    switchBranch,
    currentBranchId
  } = useConversation();

  // Get the project id
  const projectId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
  
  const handleRename = async () => {
    if (!newName.trim() || newName === branchName) {
      onClose();
      return;
    }
    
    setIsLoading(true);
    try {
      // Call API to update branch name
      const response = await fetch(`/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newName,
          projectId 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to rename branch');
      }
      
      // Refresh data
      await fetchData();
      await recalculateLayout();
      
      toast({
        title: 'Branch renamed',
        description: `Branch has been renamed to "${newName}"`,
      });
    } catch (error) {
      console.error('Error renaming branch:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename branch. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      onClose();
    }
  };
  
  const handleDelete = async () => {
    // Check if this is the current branch, if so prevent deletion
    if (branchId === currentBranchId) {
      toast({
        title: 'Cannot Delete',
        description: 'You cannot delete the branch you are currently viewing.',
        variant: 'destructive',
      });
      onClose();
      return;
    }
    
    setIsLoading(true);
    try {
      // Call API to delete branch
      const response = await fetch(`/api/branches/${branchId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete branch');
      }
      
      // Refresh data
      await fetchData();
      await recalculateLayout();
      
      toast({
        title: 'Branch deleted',
        description: `Branch "${branchName}" has been deleted`,
      });
    } catch (error) {
      console.error('Error deleting branch:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete branch. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      onClose();
    }
  };
  
  const handleUpdateNotes = async () => {
    if (!notes.trim()) {
      onClose();
      return;
    }
    
    setIsLoading(true);
    try {
      // Call API to update branch notes
      const response = await fetch(`/api/branches/${branchId}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          notes,
          projectId 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update branch notes');
      }
      
      // Refresh data
      await fetchData();
      
      toast({
        title: 'Notes saved',
        description: 'Branch context notes have been saved',
      });
    } catch (error) {
      console.error('Error updating branch notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      onClose();
    }
  };
  
  const handleMerge = async () => {
    setIsLoading(true);
    try {
      // Call API to merge branch
      const response = await fetch(`/api/branches/${branchId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          projectId,
          targetBranchId: 'main' // Merging with main branch
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to merge branch');
      }
      
      // Get the response data - may contain the merged conversation
      const data = await response.json();
      
      // Refresh data
      await fetchData();
      await recalculateLayout();
      
      // Switch to main branch if available
      if (data.mainBranchId) {
        switchBranch(data.mainBranchId);
      }
      
      toast({
        title: 'Branches merged',
        description: 'AI has merged this branch with the main conversation',
      });
    } catch (error) {
      console.error('Error merging branch:', error);
      toast({
        title: 'Error',
        description: 'Failed to merge branches. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      onClose();
    }
  };
  
  return (
    <div className="branch-management-menu p-3 bg-white min-w-[240px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: color }} />
          <h3 className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{branchName || 'Branch'}</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 rounded-full" 
          onClick={onClose}
          disabled={isLoading}
          title="Close"
        >
          <X size={14} />
        </Button>
      </div>
      
      {activeTab === null && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-start justify-start gap-1 h-auto py-4 px-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            onClick={() => setActiveTab('rename')}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <PenLine size={14} className="text-blue-500" />
              <div className="text-xs font-medium text-gray-900">Rename</div>
            </div>
            <div className="text-[10px] text-gray-500">Change branch name</div>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-start justify-start gap-1 h-auto py-4 px-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            onClick={() => setActiveTab('notes')}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <Info size={14} className="text-emerald-500" />
              <div className="text-xs font-medium text-gray-900">Add Notes</div>
            </div>
            <div className="text-[10px] text-gray-500">Context & details</div>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-start justify-start gap-1 h-auto py-4 px-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            onClick={() => setActiveTab('merge')}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <GitMerge size={14} className="text-purple-500" />
              <div className="text-xs font-medium text-gray-900">Merge</div>
            </div>
            <div className="text-[10px] text-gray-500">Combine with main</div>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-start justify-start gap-1 h-auto py-4 px-3 border border-rose-100 hover:border-rose-200 hover:bg-rose-50 text-rose-600"
            onClick={handleDelete}
            disabled={isLoading || branchId === currentBranchId}
          >
            <div className="flex items-center gap-2">
              <Trash2 size={14} className="text-rose-500" />
              <div className="text-xs font-medium">Delete</div>
            </div>
            <div className="text-[10px] text-rose-500/80">Remove branch</div>
          </Button>
        </div>
      )}
      
      {/* Rename interface */}
      {activeTab === 'rename' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="branch-name" className="text-xs font-medium text-gray-700">Branch Name</Label>
            <Input 
              id="branch-name"
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="h-9 text-sm rounded-md border-gray-300 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              placeholder="Enter branch name"
              disabled={isLoading}
              maxLength={30}
              autoFocus
            />
            <div className="text-[10px] text-gray-500 flex justify-between">
              <span>Give your branch a descriptive name</span>
              <span className={cn("", newName.length > 20 ? "text-amber-600" : "text-gray-500")}>
                {newName.length}/30
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setActiveTab(null)} 
              disabled={isLoading}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              variant="default"
              onClick={handleRename} 
              disabled={isLoading || !newName.trim() || newName === branchName}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {isLoading ? (
                <>
                  <span className="mr-1">Saving</span>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                </>
              ) : 'Save'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Notes interface */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="branch-notes" className="text-xs font-medium text-gray-700">Branch Notes</Label>
            <Textarea 
              id="branch-notes"
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Add context or details about this branch..."
              className="min-h-[120px] text-sm rounded-md border-gray-300 resize-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              disabled={isLoading}
              maxLength={500}
              autoFocus
            />
            <div className="text-[10px] text-gray-500 flex justify-between">
              <span>Document the purpose of this branch</span>
              <span className={cn("", notes.length > 400 ? "text-amber-600" : "text-gray-500")}>
                {notes.length}/500
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setActiveTab(null)} 
              disabled={isLoading}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              variant="default"
              onClick={handleUpdateNotes} 
              disabled={isLoading || !notes.trim()}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {isLoading ? (
                <>
                  <span className="mr-1">Saving</span>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                </>
              ) : 'Save Notes'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Merge interface */}
      {activeTab === 'merge' && (
        <div className="space-y-4">
          <div className="bg-purple-50 rounded-md p-3 border border-purple-100">
            <div className="text-sm text-gray-800 font-medium mb-2 flex items-center gap-2">
              <GitMerge size={14} className="text-purple-600" />
              Merge with Main Branch
            </div>
            <div className="text-xs text-gray-600">
              <p>AI will intelligently combine this branch with the main branch, preserving important context and insights.</p>
            </div>
          </div>
          
          <div className="text-xs space-y-2 text-gray-600">
            <div className="flex items-start gap-2 mb-1">
              <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-purple-600">1</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Analyze conversations</span>
                <p>Compare and analyze both conversation paths</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2 mb-1">
              <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-purple-600">2</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Integrate key insights</span>
                <p>Combine important information from both branches</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-purple-600">3</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Create merged history</span>
                <p>Create a coherent narrative from both paths</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setActiveTab(null)} 
              disabled={isLoading}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              variant="default"
              onClick={handleMerge} 
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading ? (
                <>
                  <span className="mr-1">Merging</span>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                </>
              ) : 'Merge Branch'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom node for branch roots (starting points of new branches)
function BranchRootNode({ data }: NodeProps) {
  // Determine which way the branch is going
  const isRightBranch = data.branchDirection === 'right';
  const [showMenu, setShowMenu] = useState(false);
  const [hovered, setHovered] = useState(false);
  
  // Close menu when clicked outside
  useEffect(() => {
    if (!showMenu) return;
    
    const handleOutsideClick = () => setShowMenu(false);
    // Small delay to avoid immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showMenu]);
  
  return (
    <>
    <div 
      className={cn(
          "p-1 rounded-full shadow-md flex items-center justify-center bg-white transition-all duration-300 relative cursor-pointer",
          data.isActive ? "ring-2 ring-offset-1 shadow-lg scale-110" : "",
          hovered ? "shadow-md scale-105" : "",
      )}
      style={{ 
        borderColor: data.color,
        border: `3px solid ${data.color}`, // Thicker border
          width: '30px', // Slightly larger
          height: '30px',
        background: data.isActive ? '#f8fafc' : 'white', // Subtle background change when active
          boxShadow: data.isActive || hovered ? `0 0 8px rgba(${hexToRgb(data.color)}, 0.5)` : undefined,
          zIndex: showMenu ? 1000 : 1,
        }}
        title={`Manage branch: ${data.branchName || 'Branch'}`}
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div 
          className="w-3 h-3 rounded-full transition-all" 
          style={{ 
            background: data.color,
            transform: hovered ? 'scale(1.2)' : 'scale(1)'
          }} 
        />
      
      {/* Direction indicator */}
      <div 
        className="absolute top-full mt-3 text-[9px] font-bold opacity-70" 
        style={{ color: data.color }}
      >
        {isRightBranch ? '→' : '←'}
      </div>
      
        {/* Only render the left handle if this is a right branch (connects from the left) */}
        {isRightBranch && (
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
        )}
        
        {/* Only render the right handle if this is a left branch (connects from the right) */}
        {!isRightBranch && (
          <Handle 
            id="right"
            type="target" 
            position={Position.Right} 
            style={{ 
              background: data.color, 
              width: '8px', 
              height: '8px',
              right: '-4px', // Position exactly at the right center
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1
            }} 
          />
        )}
        
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
      
      {/* Branch management menu - positioned above the node */}
      {showMenu && (
        <div 
          className="absolute z-50 bg-white rounded-md shadow-lg border border-gray-200"
          style={{ 
            bottom: '120%', // Position above the node
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: '280px',
            maxWidth: '320px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
          }}
        >
          <div className="absolute w-4 h-4 bg-white transform rotate-45 left-1/2 -ml-2 -bottom-2 border-r border-b border-gray-200"></div>
          <BranchManagementMenu 
            branchId={data.branchId} 
            branchName={data.branchName || 'Branch'} 
            color={data.color}
            onClose={() => setShowMenu(false)}
          />
        </div>
      )}
    </>
  );
}

// Custom node for stations (message pairs)
function StationNode({ data, selected }: NodeProps) {
  const isActive = data.isActive;
  
  // Determine node size based on content length
  const hasUserContent = !!data.userContent;
  const hasAssistantContent = !!data.assistantContent;
  
  // Get summary text (either from summary property or extract first sentence from user message)
  const getSummaryText = () => {
    // First check if summary exists
    if (data.summary) {
      return data.summary;
    }
    
    // Otherwise use first sentence from user message
    if (data.userContent) {
      // Find first sentence (ending with period, question mark, or exclamation point)
      const match = data.userContent.match(/^.*?[.!?](?:\s|$)/);
      if (match) {
        return match[0].trim();
      }
      // If no sentence ending found, just return a portion of the message
      return data.userContent.length > 60 
        ? data.userContent.substring(0, 60) + '...' 
        : data.userContent;
    }
    
    return 'No content';
  };
  
  const summaryText = getSummaryText();
  
  // Format timestamps if available
  const formattedTime = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';
  
  // Get the station number for badge display
  const stationNumber = data.stationNumber || '';
  
  return (
    <div 
      className={cn(
        "px-4 py-3 rounded-lg border-2 flex flex-col bg-white shadow-md transition-all duration-300",
        isActive ? "shadow-lg scale-110 ring-2 ring-offset-1" : "hover:shadow-lg hover:scale-105",
        selected ? "ring-2 ring-offset-2 ring-primary" : "",
        !hasUserContent && !hasAssistantContent ? "opacity-70" : "",
        "cursor-pointer select-none"
      )}
      style={{ 
        borderColor: data.color,
        width: `${data.calculatedWidth || 140}px`,
        height: '80px', // Fixed taller height for all stations
        boxShadow: isActive ? `0 0 8px rgba(${hexToRgb(data.color)}, 0.5)` : undefined,
        transition: 'all 0.2s ease-in-out',
        overflow: 'hidden'
      }}
      onClick={() => {
        // Add subtle feedback on click
        const el = document.activeElement as HTMLElement;
        if (el) el.blur();
      }}
    >
      {/* Header with station icon and timestamp */}
      <div className="flex items-center justify-between w-full mb-2">
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
        
        {/* Right: Station time */}
        {formattedTime && (
          <div className="text-[10px] text-muted-foreground flex-shrink-0">
            {formattedTime}
          </div>
        )}
      </div>
      
      {/* Summary content */}
      <div className="flex-1 overflow-hidden text-left">
        <div 
          className={cn(
            "text-xs line-clamp-3 leading-tight",
            isActive ? "font-medium" : ""
          )}
        >
          {summaryText}
            </div>
          </div>
      
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
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  
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
    
    // Don't switch branch for branch root nodes (those are handled in the node component)
    if (node.type === 'branchRootNode') {
      return;
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
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        
        
        {/* Debug Panel Toggle */}
        <button
          className={cn(
            "bg-white p-2 rounded-md shadow-sm border border-gray-200 text-xs text-muted-foreground hover:bg-gray-50 transition-colors",
            showDebugPanel ? "bg-blue-50 text-blue-600 border-blue-200" : ""
          )}
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          title="Toggle debug panel"
        >
          <Bug size={16} />
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
      
      {/* ELK Debug Panel */}
      {showDebugPanel && (
        <div className="absolute left-4 bottom-4 z-10">
          <ElkDebug />
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