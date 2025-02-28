import { Branch, TimelineNode } from '@/lib/types/database';
import { query } from '@/lib/db';

// Layout result interfaces (same as ELK for compatibility)
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
 * SlotBasedLayoutService
 * 
 * A layout service that uses a simplified slot-based methodology to position branches.
 * This approach guarantees no overlap by assigning each branch to a specific horizontal slot.
 * 
 * Key concepts:
 * - Slot 0 is reserved for the main branch
 * - Negative slots (-1, -2, etc.) are to the left of main
 * - Positive slots (1, 2, etc.) are to the right of main
 * - Each slot has a fixed width to prevent overlap
 * - Sub-branches are allocated slots close to their parent
 */
export class SlotBasedLayoutService {
  private readonly SLOT_WIDTH = 200; // Width of each slot in pixels
  private readonly VERTICAL_SPACING = 150; // Vertical spacing between branch levels
  
  /**
   * Calculate layout positions for branches in a project
   */
  async calculate(branches: Branch[], nodes: TimelineNode[]): Promise<LayoutResult> {
    // Group nodes by branch for easier access
    const branchNodes = this.groupNodesByBranch(nodes);
    
    // Determine the total viewport width based on branch count
    const viewportWidth = Math.max(1200, (branches.length + 1) * this.SLOT_WIDTH);
    const centerX = viewportWidth / 2;
    
    // Initialize slot manager
    const slotManager = new BranchSlotManager(centerX, this.SLOT_WIDTH);
    
    // Build branch hierarchy for proper traversal
    const branchHierarchy = this.buildBranchHierarchy(branches);
    
    // Find the root branch (depth 0)
    const rootBranch = branches.find(b => b.depth === 0);
    if (!rootBranch) {
      console.warn('No root branch found');
      return {
        branchLayouts: {},
        width: viewportWidth,
        height: 600,
        centerX
      };
    }
    
    // Allocate slots for all branches starting from root
    slotManager.allocateSlot(rootBranch.id, null, 0); // Root is always slot 0
    this.allocateSlotsRecursively(rootBranch.id, branchHierarchy, slotManager);
    
    // Find branch points for all branches
    const branchPointMap = this.findBranchPoints(branches, nodes);
    
    // Calculate branch layouts based on allocated slots
    const branchLayouts: Record<string, BranchLayout> = {};
    
    for (const branch of branches) {
      // Get allocated slot and convert to x position
      const slot = slotManager.getSlotForBranch(branch.id);
      const x = slotManager.getPositionForSlot(slot);
      
      // Determine y position based on branch point location instead of just depth
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
          console.warn(`Branch point not found for branch ${branch.id}, using fallback positioning`);
        }
      }
      
      // Determine branch direction based on slot
      const direction: 'left' | 'right' | 'auto' = 
        slot < 0 ? 'left' : 
        slot > 0 ? 'right' : 'auto';
      
      // Find branch's siblings for sibling index
      const siblings = branches.filter(b => 
        b.parent_branch_id === branch.parent_branch_id && 
        b.id !== branch.id
      );
      const siblingIndex = Math.max(0, siblings.findIndex(s => s.id === branch.id));
      
      // Count nodes in branch for height calculation
      const nodesInBranch = branchNodes.get(branch.id) || [];
      const nodeCount = nodesInBranch.length;
      
      // Create layout data
      branchLayouts[branch.id] = {
        x,
        y,
        direction,
        siblingIndex,
        level: branch.depth,
        width: 140, // Standard branch width
        height: Math.max(100, nodeCount * 50) // Height based on node count
      };
    }
    
    // Calculate total height based on deepest branch and its nodes
    const maxY = Math.max(...Object.values(branchLayouts).map(layout => layout.y + layout.height));
    const height = maxY + 100; // Add some padding
    
    return {
      branchLayouts,
      width: viewportWidth,
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
   * Recursively allocate slots for all branches in a hierarchy
   */
  private allocateSlotsRecursively(
    branchId: string,
    hierarchy: Map<string, string[]>,
    slotManager: BranchSlotManager
  ): void {
    const childBranches = hierarchy.get(branchId) || [];
    
    // Sort children to ensure consistent allocation
    childBranches.sort();
    
    // Allocate slots for each child
    childBranches.forEach((childId, index) => {
      slotManager.allocateSlot(childId, branchId, index);
      
      // Recursively allocate for this child's children
      this.allocateSlotsRecursively(childId, hierarchy, slotManager);
    });
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

/**
 * BranchSlotManager
 * 
 * Manages slot allocation for branches and converts slots to x positions.
 */
class BranchSlotManager {
  private branchToSlot = new Map<string, number>(); // Maps branch ID to slot
  private occupiedSlots = new Set<number>();        // Tracks which slots are taken
  
  constructor(
    private centerX: number,
    private slotWidth: number
  ) {}
  
  /**
   * Get the slot assigned to a branch
   */
  getSlotForBranch(branchId: string): number {
    return this.branchToSlot.get(branchId) || 0;
  }
  
  /**
   * Convert a slot number to an x position
   */
  getPositionForSlot(slot: number): number {
    return this.centerX + (slot * this.slotWidth);
  }
  
  /**
   * Allocate a slot for a branch based on its parent and child index
   */
  allocateSlot(branchId: string, parentBranchId: string | null, childIndex: number): number {
    // Root branch is always slot 0
    if (!parentBranchId) {
      const slot = 0;
      this.branchToSlot.set(branchId, slot);
      this.occupiedSlots.add(slot);
      return slot;
    }
    
    // Get parent's slot
    const parentSlot = this.branchToSlot.get(parentBranchId) || 0;
    
    // Determine preferred slot based on child index and parent slot
    let preferredSlot: number;
    
    // Alternate between right and left of parent based on child index
    if (childIndex % 2 === 0) {
      // Even index: try right side first
      preferredSlot = parentSlot > 0 
        ? parentSlot + 1  // If parent is right, go further right
        : parentSlot + 1; // If parent is left or center, go right
    } else {
      // Odd index: try left side first
      preferredSlot = parentSlot < 0 
        ? parentSlot - 1  // If parent is left, go further left
        : parentSlot - 1; // If parent is right or center, go left
    }
    
    // Find the next available slot in the preferred direction
    let slot = preferredSlot;
    
    // If slot is occupied, find the next available one
    if (this.occupiedSlots.has(slot)) {
      // Try slots in outward direction from parent
      let offset = 1;
      while (true) {
        if (childIndex % 2 === 0) {
          // Try right first, then left
          slot = parentSlot + offset;
          if (!this.occupiedSlots.has(slot)) break;
          
          slot = parentSlot - offset;
          if (!this.occupiedSlots.has(slot)) break;
        } else {
          // Try left first, then right
          slot = parentSlot - offset;
          if (!this.occupiedSlots.has(slot)) break;
          
          slot = parentSlot + offset;
          if (!this.occupiedSlots.has(slot)) break;
        }
        
        // Increase offset and try again
        offset++;
      }
    }
    
    // Allocate the slot
    this.branchToSlot.set(branchId, slot);
    this.occupiedSlots.add(slot);
    
    return slot;
  }
}

export default SlotBasedLayoutService;