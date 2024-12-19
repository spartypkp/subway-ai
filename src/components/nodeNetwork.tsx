"use client";

import { TimelineNode } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface NodeNetworkProps {
  expertId: string;
  projectId: string;
  expertColor: string;
}

interface NodePosition {
  x: number;
  y: number;
  node: TimelineNode;
  isMainBranch: boolean;
}

export function NodeNetwork({ expertId, projectId, expertColor }: NodeNetworkProps) {
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);

  // Fetch nodes for this expert
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const response = await fetch(`/api/nodes?expert_id=${expertId}&project_id=${projectId}`);
        const data = await response.json();
        setNodes(data);
        calculateNodePositions(data);
      } catch (error) {
        console.error('Failed to fetch nodes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, [expertId, projectId]);

  const calculateNodePositions = (nodes: TimelineNode[]) => {
    const positions: NodePosition[] = [];
    const verticalSpacing = 150;  // Increased spacing for larger stations
    const branchOffset = 200;     // Increased offset for wider branches
    const rootNode = nodes.find(n => n.node_type === 'root');
    
    if (!rootNode) return;

    // Helper to determine if a node is on the main branch
    const isMainBranch = (node: TimelineNode): boolean => {
      if (!node.parent_id) return true;
      const parent = nodes.find(n => n.id === node.parent_id);
      return parent ? isMainBranch(parent) : false;
    };

    // Start with root node (hidden but used for positioning)
    const centerX = window.innerWidth / 2;
    positions.push({
      x: centerX,
      y: 0,
      node: rootNode,
      isMainBranch: true
    });

    // Track branch levels for positioning
    const branchLevels: { [key: string]: number } = {};

    const positionNode = (node: TimelineNode, level: number, parentX: number, isBranch: boolean) => {
      const children = nodes.filter(n => n.parent_id === node.id);
      const isMain = isMainBranch(node);

      // Calculate x position
      let x = parentX;
      if (!isMain) {
        branchLevels[level] = (branchLevels[level] || 0) + 1;
        x = parentX + (branchOffset * (branchLevels[level] % 2 === 0 ? 1 : -1));
      }

      // Add node position
      if (node.id !== rootNode.id) {  // Don't show root node
        positions.push({
          x,
          y: level * verticalSpacing,
          node,
          isMainBranch: isMain
        });
      }

      // Position children
      children.forEach(child => {
        positionNode(child, level + 1, x, !isMain || isBranch);
      });
    };

    // Start positioning from root
    positionNode(rootNode, 1, centerX, false);
    setNodePositions(positions);
  };

  if (loading) {
    return <div>Loading network...</div>;
  }

  return (
    <div className="w-full h-[80vh] relative overflow-hidden bg-background/50 p-8">
      <svg className="w-full h-full">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Draw edges first */}
        {nodePositions.map(pos => {
          if (!pos.node.parent_id) return null;
          const parent = nodePositions.find(p => p.node.id === pos.node.parent_id);
          if (!parent) return null;

          const midY = (parent.y + pos.y) / 2;
          const path = pos.isMainBranch
            ? `M ${parent.x} ${parent.y} L ${pos.x} ${pos.y}`
            : `M ${parent.x} ${parent.y} 
               C ${parent.x} ${midY}, 
                 ${pos.x} ${midY}, 
                 ${pos.x} ${pos.y}`;

          return (
            <g key={`${parent.node.id}-${pos.node.id}`}>
              {/* Shadow line */}
              <path
                d={path}
                stroke={expertColor}
                strokeWidth={12}
                strokeOpacity={0.15}
                fill="none"
              />
              {/* Main line */}
              <path
                d={path}
                stroke={expertColor}
                strokeWidth={6}
                fill="none"
                className={cn(
                  "transition-opacity duration-300",
                  pos.isMainBranch ? "opacity-100" : "opacity-70"
                )}
                filter="url(#glow)"
              />
            </g>
          );
        })}

        {/* Draw nodes */}
        {nodePositions.map(pos => {
          if (pos.node.node_type === 'root') return null;
          
          const messagePreview = (pos.node.content as any).text?.slice(0, 25) || 'Message';
          
          return (
            <g
              key={pos.node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="group cursor-pointer"
            >
              {/* Station background */}
              <rect
                x={-80}
                y={-25}
                width={160}
                height={50}
                rx={25}
                fill="white"
                className="shadow-lg transition-all duration-300 group-hover:shadow-xl"
                stroke={expertColor}
                strokeWidth={3}
                strokeOpacity={0.3}
                filter="url(#glow)"
              />
              
              {/* Message preview with better text handling */}
              <foreignObject
                x={-70}
                y={-15}
                width={140}
                height={30}
                className="overflow-hidden"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <p 
                    className="text-sm text-center truncate px-2 font-medium"
                    style={{ color: expertColor }}
                  >
                    {messagePreview}
                  </p>
                </div>
              </foreignObject>

              {/* Hover effect overlay */}
              <rect
                x={-80}
                y={-25}
                width={160}
                height={50}
                rx={25}
                className="opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                fill={expertColor}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
} 