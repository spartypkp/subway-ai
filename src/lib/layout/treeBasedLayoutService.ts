import { Branch, TimelineNode } from '@/lib/types/database';
import { query } from '@/lib/db';

// Layout result interfaces (same as in SlotBasedLayoutService for compatibility)
export interface BranchLayout {
  x: number;
  y: number;
  direction: 'left' | 'right' | 'auto';
  siblingIndex: number;
  level: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  branchLayouts: Record<string, BranchLayout>;
  width: number;
  height: number;
  centerX: number;
}

/**
 * TreeNode
 * 
 * Internal tree representation for branch layout calculations
 */
interface TreeNode {
  id: string;               // Branch ID
  children: TreeNode[];     // Child branches
  x: number;                // Horizontal position
  y: number;                // Vertical position
  width: number;            // Node width
  prelim: number;           // Preliminary x position during layout
  modifier: number;         // Modifier for children's positions
  siblingIndex: number;     // Index among siblings
  level: number;            // Tree depth level
  isLeftChild: boolean;     // Whether this is positioned to the left of parent
}

/**
 * TreeBasedLayoutService
 * 
 * A layout service that uses a hierarchical tree representation to position branches.
 * This approach ensures branches are positioned relative to their parents with
 * appropriate spacing and balance.
 * 
 * Key advantages:
 * - Branches are properly positioned relative to their parents
 * - Layout algorithm balances the tree naturally
 * - No global slot conflicts
 * - Better space utilization
 */
export class TreeBasedLayoutService {
  private readonly NODE_WIDTH = 140;        // Standard branch width
  private readonly VERTICAL_SPACING = 150;  // Vertical spacing between branch levels
  private readonly HORIZONTAL_SPACING = 200; // Horizontal spacing between branches
  
  /**
   * Calculate layout positions for branches in a project
   */
  async calculate(branches: Branch[], nodes: TimelineNode[]): Promise<LayoutResult> {
    // Group nodes by branch for easier access
    const branchNodes = this.groupNodesByBranch(nodes);
    
    // Find the root branch (depth 0)
    const rootBranch = branches.find(b => b.depth === 0);
    if (!rootBranch) {
      console.warn('No root branch found');
      return {
        branchLayouts: {},
        width: 1200,
        height: 600,
        centerX: 600
      };
    }
    
    // Build branch hierarchy for proper traversal
    const branchHierarchy = this.buildBranchHierarchy(branches);
    
    // Create tree representation of branches
    const tree = this.buildTree(rootBranch.id, branchHierarchy, branches);
    
    // Perform tree layout algorithm
    this.layoutTree(tree);
    
    // Find branch points for all branches
    const branchPointMap = this.findBranchPoints(branches, nodes);
    
    // Calculate branch layouts based on tree layout
    const branchLayouts: Record<string, BranchLayout> = {};
    
    this.traverseTree(tree, (node) => {
      const branch = branches.find(b => b.id === node.id);
      if (!branch) return;
      
      // Determine y position based on branch point or level
      let y: number;
      
      if (branch.depth === 0) {
        // Root branch starts at the top
        y = 20;
      } else {
        // For sub-branches, find the y-position of their branch point
        const branchPointInfo = branchPointMap.get(branch.id);
        
        if (branchPointInfo) {
          // Position the branch at the same y-level as its branch point
          y = branchPointInfo.position * this.VERTICAL_SPACING;
        } else {
          // Fallback to depth-based calculation if branch point not found
          y = 20 + (branch.depth * this.VERTICAL_SPACING);
        }
      }
      
      // Determine branch direction based on position relative to parent
      const direction: 'left' | 'right' | 'auto' = 
        node.isLeftChild ? 'left' : 
        (branch.depth === 0) ? 'auto' : 'right';
      
      // Count nodes in branch for height calculation
      const nodesInBranch = branchNodes.get(branch.id) || [];
      const nodeCount = nodesInBranch.length;
      
      // Create layout data
      branchLayouts[branch.id] = {
        x: node.x,
        y,
        direction,
        siblingIndex: node.siblingIndex,
        level: node.level,
        width: this.NODE_WIDTH,
        height: Math.max(100, nodeCount * 50) // Height based on node count
      };
    });
    
    // Calculate viewport dimensions
    const positions = Object.values(branchLayouts).map(layout => layout.x);
    const minX = Math.min(...positions);
    const maxX = Math.max(...positions);
    const width = Math.max(1200, maxX - minX + 2 * this.HORIZONTAL_SPACING);
    
    // Calculate center position
    const centerX = (minX + maxX) / 2;
    
    // Calculate total height based on deepest branch and its nodes
    const maxY = Math.max(...Object.values(branchLayouts).map(layout => layout.y + layout.height));
    const height = maxY + 100; // Add some padding
    
    return {
      branchLayouts,
      width,
      height,
      centerX
    };
  }
  
  /**
   * Update branch metadata with calculated positions
   */
  async updateBranchPositions(projectId: string): Promise<void> {
    try {
      // 1. Fetch all branches for the project
      const branchesResult = await query(
        'SELECT * FROM branches WHERE project_id = $1',
        [projectId]
      );
      const branches = branchesResult.rows;
      
      // 2. Fetch all nodes for the project
      const nodesResult = await query(
        'SELECT * FROM timeline_nodes WHERE project_id = $1',
        [projectId]
      );
      const nodes = nodesResult.rows;
      
      // 3. Calculate layout
      const layoutResult = await this.calculate(branches, nodes);
      
      // 4. Update branch metadata with calculated positions
      await Promise.all(
        branches.map((branch: Branch) => {
          const layout = layoutResult.branchLayouts[branch.id];
          if (!layout) return Promise.resolve();
          
          const metadata = branch.metadata || {};
          const updatedMetadata = {
            ...metadata,
            layout: {
              x: layout.x,
              y: layout.y,
              direction: layout.direction,
              siblingIndex: layout.siblingIndex,
              level: layout.level
            }
          };
          
          return query(
            'UPDATE branches SET metadata = $1 WHERE id = $2',
            [JSON.stringify(updatedMetadata), branch.id]
          );
        })
      );
    } catch (error) {
      console.error('Error updating branch positions:', error);
      throw error;
    }
  }
  
  /**
   * Build a tree node from a branch ID
   */
  private buildTree(
    branchId: string, 
    hierarchy: Map<string, string[]>,
    branches: Branch[]
  ): TreeNode {
    // Get child branches
    const childIds = hierarchy.get(branchId) || [];
    
    // Create tree node
    const node: TreeNode = {
      id: branchId,
      children: [],
      x: 0,
      y: 0,
      width: this.NODE_WIDTH,
      prelim: 0,
      modifier: 0,
      siblingIndex: 0,
      level: branches.find(b => b.id === branchId)?.depth || 0,
      isLeftChild: false
    };
    
    // Process children
    childIds.forEach((childId, index) => {
      const childNode = this.buildTree(childId, hierarchy, branches);
      childNode.siblingIndex = index;
      
      // Mark even-indexed children as "right" and odd-indexed as "left"
      childNode.isLeftChild = index % 2 !== 0;
      
      node.children.push(childNode);
    });
    
    return node;
  }
  
  /**
   * Layout a tree using a modified Reingold-Tilford algorithm
   */
  private layoutTree(root: TreeNode): void {
    // First pass: calculate preliminary x coordinates
    this.firstWalk(root, 0);
    
    // Second pass: adjust positions
    this.secondWalk(root, 0, 0);
    
    // Center the root at origin
    const rootShift = 600 - root.x; // Center at 600px by default
    
    // Apply shift to all nodes
    this.traverseTree(root, (node) => {
      node.x += rootShift;
    });
  }
  
  /**
   * First tree walk - calculate preliminary positions
   */
  private firstWalk(node: TreeNode, level: number): void {
    node.level = level;
    
    if (node.children.length === 0) {
      // Leaf node
      node.prelim = 0;
    } else {
      // Process children
      node.children.forEach(child => {
        this.firstWalk(child, level + 1);
      });
      
      // Calculate preliminary position based on children
      let leftPosition = 0;
      let rightPosition = 0;
      
      // Position children on left side (odd indices)
      const leftChildren = node.children.filter(child => child.isLeftChild);
      if (leftChildren.length > 0) {
        // Sort left children by preliminary position
        leftChildren.sort((a, b) => a.prelim - b.prelim);
        
        // Calculate positions from right to left
        let currentPosition = 0;
        for (let i = leftChildren.length - 1; i >= 0; i--) {
          const child = leftChildren[i];
          child.modifier = currentPosition;
          currentPosition -= (this.HORIZONTAL_SPACING + child.width);
        }
        
        leftPosition = currentPosition + this.HORIZONTAL_SPACING;
      }
      
      // Position children on right side (even indices)
      const rightChildren = node.children.filter(child => !child.isLeftChild);
      if (rightChildren.length > 0) {
        // Sort right children by preliminary position
        rightChildren.sort((a, b) => a.prelim - b.prelim);
        
        // Calculate positions from left to right
        let currentPosition = 0;
        for (let i = 0; i < rightChildren.length; i++) {
          const child = rightChildren[i];
          child.modifier = currentPosition;
          currentPosition += (this.HORIZONTAL_SPACING + child.width);
        }
        
        rightPosition = currentPosition - this.HORIZONTAL_SPACING;
      }
      
      // Center the node between children
      node.prelim = (leftPosition + rightPosition) / 2;
    }
  }
  
  /**
   * Second tree walk - adjust positions
   */
  private secondWalk(node: TreeNode, level: number, x: number): void {
    // Calculate final x position
    node.x = x;
    
    // Process children
    node.children.forEach(child => {
      let childX: number;
      
      if (child.isLeftChild) {
        // Left child - position to the left of parent
        childX = node.x - this.HORIZONTAL_SPACING - (child.modifier || 0);
      } else {
        // Right child - position to the right of parent
        childX = node.x + this.HORIZONTAL_SPACING + (child.modifier || 0);
      }
      
      this.secondWalk(child, level + 1, childX);
    });
  }
  
  /**
   * Traverse the tree and apply a function to each node
   */
  private traverseTree(node: TreeNode, fn: (node: TreeNode) => void): void {
    fn(node);
    node.children.forEach(child => this.traverseTree(child, fn));
  }
  
  /**
   * Group timeline nodes by their branch_id for easier processing
   */
  private groupNodesByBranch(nodes: TimelineNode[]): Map<string, TimelineNode[]> {
    const branchNodes = new Map<string, TimelineNode[]>();
    
    nodes.forEach(node => {
      if (!node.branch_id) return;
      
      if (!branchNodes.has(node.branch_id)) {
        branchNodes.set(node.branch_id, []);
      }
      
      branchNodes.get(node.branch_id)?.push(node);
    });
    
    // Sort nodes within each branch by position
    branchNodes.forEach((nodes, branchId) => {
      nodes.sort((a, b) => a.position - b.position);
    });
    
    return branchNodes;
  }
  
  /**
   * Build a branch hierarchy map for tree traversal
   */
  private buildBranchHierarchy(branches: Branch[]): Map<string, string[]> {
    const hierarchy = new Map<string, string[]>();
    
    // Initialize all branches with empty children arrays
    branches.forEach(branch => {
      hierarchy.set(branch.id, []);
    });
    
    // Add children to their parent branches
    branches.forEach(branch => {
      if (branch.parent_branch_id) {
        const children = hierarchy.get(branch.parent_branch_id) || [];
        children.push(branch.id);
        hierarchy.set(branch.parent_branch_id, children);
      }
    });
    
    return hierarchy;
  }
  
  /**
   * Find branch points for all branches and their positions
   */
  private findBranchPoints(branches: Branch[], nodes: TimelineNode[]): Map<string, { nodeId: string, position: number }> {
    const branchPointMap = new Map<string, { nodeId: string, position: number }>();
    
    // Process branches that have a parent and branch point
    branches.forEach(branch => {
      if (branch.parent_branch_id && branch.branch_point_node_id) {
        // Find the branch point node
        const branchPointNode = nodes.find(n => n.id === branch.branch_point_node_id);
        
        if (branchPointNode) {
          branchPointMap.set(branch.id, {
            nodeId: branchPointNode.id,
            position: branchPointNode.position
          });
        }
      }
    });
    
    return branchPointMap;
  }
}

export default TreeBasedLayoutService; 