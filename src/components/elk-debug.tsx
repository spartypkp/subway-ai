'use client';

import { useState, useEffect } from 'react';
import { useConversation } from '@/lib/contexts/ConversationContext';
import { Button } from '@/components/ui/button';
import { visualizeBranchTree } from '@/lib/layout/treeVisualizer';

export function ElkDebug() {
  const { 
    projectId,
    recalculateLayout,
    branches,
    allNodes,
    loading
  } = useConversation();
  
  // Add local loading state to avoid UI flicker issues
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDetailedTree, setShowDetailedTree] = useState(false);

  useEffect(() => {
    // Log the loading state from context for debugging
    console.log("Layout loading state:", loading.layout);
    
    // When branches change, extract layout data from branch metadata
    if (branches && branches.length > 0) {
      // Extract layout information from branch metadata
      const layoutData = branches.map(branch => ({
        id: branch.id,
        name: branch.name || 'Unnamed',
        depth: branch.depth,
        layout: branch.metadata?.layout || null
      }));
      
      setDebugInfo({
        branchCount: branches.length,
        layoutData,
        timestamp: new Date().toISOString(),
        treeVisualization: visualizeBranchTree(branches, allNodes || [], showDetailedTree)
      });
    }
  }, [branches, allNodes, loading.layout, showDetailedTree]);

  const handleRecalculate = async () => {
    try {
      setIsRecalculating(true);
      await recalculateLayout();
    } finally {
      // Ensure we clear the local loading state
      setTimeout(() => setIsRecalculating(false), 500);
    }
  };

  if (!projectId) return null;

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-medium mb-2">ELK Layout Debug</h3>
      
      <div className="flex gap-2 mb-4">
        <Button 
          onClick={handleRecalculate}
          disabled={isRecalculating}
          size="sm"
        >
          {isRecalculating ? 'Recalculating...' : 'Recalculate Layout'}
        </Button>
        
        <Button
          onClick={() => setShowDetailedTree(!showDetailedTree)}
          variant="outline"
          size="sm"
        >
          {showDetailedTree ? 'Show Summary' : 'Show Detailed Tree'}
        </Button>
      </div>
      
      <div className="text-xs">
        <p className="mb-2">Project ID: {projectId}</p>
        <p className="mb-2">Branch Count: {branches?.length || 0}</p>
        <p className="mb-2">Node Count: {allNodes?.length || 0}</p>
        
        {debugInfo && (
          <div className="mt-4">
            <p className="font-medium">Last Layout Calculation:</p>
            <p className="text-muted-foreground">{debugInfo.timestamp}</p>
            
            <div className="mt-4">
              <p className="font-medium">Branch Tree:</p>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-[10px] overflow-auto max-h-[300px] whitespace-pre font-mono">
                {debugInfo.treeVisualization}
              </pre>
            </div>
            
            <div className="mt-2">
              <p className="font-medium">Branch Positions:</p>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-[10px] overflow-auto max-h-[200px] font-mono">
                {JSON.stringify(debugInfo.layoutData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 