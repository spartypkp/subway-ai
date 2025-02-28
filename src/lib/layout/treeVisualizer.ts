import { Branch, TimelineNode } from '@/lib/types/database';

/**
 * TreeVisualizer
 * 
 * A utility for generating text-based visualizations of branch/node structures.
 * This helps debug issues by showing the actual database structure independently
 * from layout calculations or rendering.
 */
export class TreeVisualizer {
  /**
   * Generate a text-based tree representation of branches and nodes
   */
  static generateBranchTree(branches: Branch[], nodes: TimelineNode[]): string {
    // Group nodes by branch
    const nodesByBranch = this.groupNodesByBranch(nodes);
    
    // Find the root branch (depth 0)
    const rootBranch = branches.find(b => b.depth === 0);
    if (!rootBranch) return "No root branch found";
    
    // Build the tree starting from the root branch
    return this.buildBranchTree(rootBranch, branches, nodesByBranch, "", true);
  }
  
  /**
   * Recursively build a branch tree as text
   */
  private static buildBranchTree(
    branch: Branch,
    allBranches: Branch[],
    nodesByBranch: Map<string, TimelineNode[]>,
    prefix: string,
    isLast: boolean
  ): string {
    // Start with the branch info
    const branchInfo = `[Branch: ${branch.name || 'Unnamed'} (${branch.id.substring(0, 8)}), depth: ${branch.depth}, direction: ${branch.metadata?.layout?.direction || 'none'}]`;
    
    // Add the branch's position if available
    const position = branch.metadata?.layout 
      ? ` @ (${branch.metadata.layout.x}, ${branch.metadata.layout.y})`
      : '';
    
    // Create the branch line with the proper prefix
    const branchLine = `${prefix}${isLast ? '└── ' : '├── '}${branchInfo}${position}`;
    
    // Get nodes for this branch and sort by position
    const branchNodes = nodesByBranch.get(branch.id) || [];
    branchNodes.sort((a, b) => a.position - b.position);
    
    // Find child branches that fork from this branch
    const childBranches = allBranches
      .filter(b => b.parent_branch_id === branch.id)
      .sort((a, b) => {
        // Try to order by branch point position or fallback to creation time
        const nodeA = branchNodes.find(n => n.id === a.branch_point_node_id);
        const nodeB = branchNodes.find(n => n.id === b.branch_point_node_id);
        
        if (nodeA && nodeB) return nodeA.position - nodeB.position;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    
    // New prefix for children of this branch
    const childPrefix = `${prefix}${isLast ? '    ' : '│   '}`;
    
    // Build the nodes part of the tree
    let nodesText = '';
    for (let i = 0; i < branchNodes.length; i++) {
      const node = branchNodes[i];
      const isLastNode = i === branchNodes.length - 1 && childBranches.length === 0;
      
      // Check if this node is a branch point
      const isBranchPoint = childBranches.some(b => b.branch_point_node_id === node.id);
      
      // Create the node line
      const nodeRole = node.message_role ? `[${node.message_role}] ` : '';
      const nodeContent = node.message_text
        ? `"${node.message_text.substring(0, 30)}${node.message_text.length > 30 ? '...' : ''}"`
        : '(No content)';
      
      const nodeInfo = `${nodeRole}${nodeContent} (pos: ${node.position})`;
      
      // Add branch point indicator if applicable
      const branchPointIndicator = isBranchPoint ? ' 🔀' : '';
      
      nodesText += `${childPrefix}${isLastNode ? '└── ' : '├── '}Node: ${nodeInfo}${branchPointIndicator}\n`;
      
      // If this is a branch point, add child branches immediately after
      if (isBranchPoint) {
        const branchesFromThisPoint = childBranches.filter(b => b.branch_point_node_id === node.id);
        
        for (let j = 0; j < branchesFromThisPoint.length; j++) {
          const childBranch = branchesFromThisPoint[j];
          const isLastBranchFromPoint = j === branchesFromThisPoint.length - 1;
          
          // Remove this branch from the main list so we don't process it again
          const index = childBranches.findIndex(b => b.id === childBranch.id);
          if (index !== -1) childBranches.splice(index, 1);
          
          // Add branch to the tree with indentation
          nodesText += `${childPrefix}${isLastNode ? '    ' : '│   '}${isLastBranchFromPoint ? '└── ' : '├── '}↪ `;
          nodesText += this.buildBranchTree(
            childBranch, 
            allBranches, 
            nodesByBranch,
            `${childPrefix}${isLastNode ? '    ' : '│   '}${isLastBranchFromPoint ? '    ' : '│   '}`,
            true
          );
        }
      }
    }
    
    // Process any remaining child branches (those without branch points)
    for (let i = 0; i < childBranches.length; i++) {
      const childBranch = childBranches[i];
      const isLastChild = i === childBranches.length - 1;
      
      nodesText += `${childPrefix}${isLastChild ? '└── ' : '├── '}↪ `;
      nodesText += this.buildBranchTree(
        childBranch, 
        allBranches, 
        nodesByBranch,
        `${childPrefix}${isLastChild ? '    ' : '│   '}`,
        true
      );
    }
    
    return `${branchLine}\n${nodesText}`;
  }
  
  /**
   * Group timeline nodes by branch for easier processing
   */
  private static groupNodesByBranch(nodes: TimelineNode[]): Map<string, TimelineNode[]> {
    const nodesByBranch = new Map<string, TimelineNode[]>();
    
    for (const node of nodes) {
      if (!nodesByBranch.has(node.branch_id)) {
        nodesByBranch.set(node.branch_id, []);
      }
      nodesByBranch.get(node.branch_id)?.push(node);
    }
    
    return nodesByBranch;
  }
  
  /**
   * Generate a more compact summary showing just branches and their positions
   */
  static generateBranchPositionSummary(branches: Branch[]): string {
    // Sort branches by depth and then by ID for consistent output
    const sortedBranches = [...branches].sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.id.localeCompare(b.id);
    });
    
    let summary = 'Branch Position Summary:\n';
    summary += '=======================\n\n';
    
    // Group branches by depth
    const branchesByDepth = new Map<number, Branch[]>();
    for (const branch of sortedBranches) {
      if (!branchesByDepth.has(branch.depth)) {
        branchesByDepth.set(branch.depth, []);
      }
      branchesByDepth.get(branch.depth)?.push(branch);
    }
    
    // Build output by depth
    for (const [depth, depthBranches] of [...branchesByDepth.entries()].sort((a, b) => a[0] - b[0])) {
      summary += `Depth ${depth}:\n`;
      
      for (const branch of depthBranches) {
        const layout = branch.metadata?.layout;
        const position = layout ? `(${layout.x}, ${layout.y})` : '(no position)';
        const direction = layout?.direction ? layout.direction : 'none';
        
        summary += `  - ${branch.name || 'Unnamed'} (${branch.id.substring(0, 8)}): ${position}, dir: ${direction}\n`;
        
        // Show parent relationship
        if (branch.parent_branch_id) {
          const parent = sortedBranches.find(b => b.id === branch.parent_branch_id);
          const parentName = parent ? (parent.name || 'Unnamed') : 'Unknown';
          summary += `    └── Child of: ${parentName} (${branch.parent_branch_id.substring(0, 8)})\n`;
        }
      }
      
      summary += '\n';
    }
    
    return summary;
  }
}

/**
 * Helper function to visualize the tree structure and help debug layout issues
 */
export function visualizeBranchTree(
  branches: Branch[], 
  nodes: TimelineNode[],
  showDetailedTree: boolean = true
): string {
  if (showDetailedTree) {
    return TreeVisualizer.generateBranchTree(branches, nodes);
  } else {
    return TreeVisualizer.generateBranchPositionSummary(branches);
  }
}