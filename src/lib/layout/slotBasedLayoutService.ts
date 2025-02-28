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
    
    // Map branches by ID for easier access
    const branchMap = new Map<string, Branch>();
    branches.forEach(branch => {
      branchMap.set(branch.id, branch);
    });
    
    // Allocate slots for root branch
    slotManager.allocateSlot(rootBranch.id, null, 0); // Root is always slot 0
    
    // Extract branch direction preferences from metadata
    const directionalBranches = branches
      .filter(branch => branch.id !== rootBranch.id) // Skip root branch
      .map(branch => {
        // Check for direction preference in metadata
        let preferredDirection: 'left' | 'right' | 'auto' = 'auto';
        if (branch.metadata?.layout?.direction) {
          const directionFromMetadata = branch.metadata.layout.direction;
          if (directionFromMetadata === 'left' || directionFromMetadata === 'right') {
            preferredDirection = directionFromMetadata;
          }
        }
        return {
          id: branch.id,
          parentId: branch.parent_branch_id,
          direction: preferredDirection,
          depth: branch.depth
        };
      });
    
    // Sort branches by depth to ensure parent branches are processed before children
    directionalBranches.sort((a, b) => a.depth - b.depth);
    
    // Process branches with direction preferences first
    for (const branch of directionalBranches) {
      if (!branch.parentId) continue; // Skip if no parent (should never happen)
      
      // Find child index - get all siblings and determine index
      const siblings = branches.filter(b => b.parent_branch_id === branch.parentId);
      const childIndex = siblings.findIndex(s => s.id === branch.id);
      
      // Allocate slot with direction preference
      slotManager.allocateSlot(branch.id, branch.parentId, childIndex, branch.direction);
    }
    
    // Find branch points for all branches
    const branchPointMap = this.findBranchPoints(branches, nodes);
    
    // Calculate branch layouts based on allocated slots
    const branchLayouts: Record<string, BranchLayout> = {};
    
    for (const branch of branches) {
      // Get allocated slot
      const slot = slotManager.getSlotForBranch(branch.id);
      
      // Calculate x position based on parent relationship
      const x = slotManager.getPositionForBranch(branch.id, branchMap);
      
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
      
      // Get direction from slot manager (which now tracks direction)
      const direction = slotManager.getDirectionForBranch(branch.id);
      
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
 * Uses parent-relative positioning for branches.
 */
class BranchSlotManager {
  private branchToSlot = new Map<string, number>();        // Maps branch ID to slot
  private branchRelations = new Map<string, {              // Maps branch ID to parent and relative position
    parentId: string | null,
    relativeSlot: number,
    direction: 'left' | 'right' | 'auto'  // Added direction property
  }>();
  private occupiedGlobalSlots = new Set<number>();         // Tracks which global slots are taken (for compatibility)
  
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
   * Get the preferred direction for a branch
   */
  getDirectionForBranch(branchId: string): 'left' | 'right' | 'auto' {
    const relation = this.branchRelations.get(branchId);
    return relation?.direction || 'auto';
  }
  
  /**
   * Get the position for a branch, calculated relative to its parent
   */
  getPositionForBranch(branchId: string, branchMap: Map<string, Branch>): number {
    const relation = this.branchRelations.get(branchId);
    
    // Root branch or no relation found
    if (!relation || !relation.parentId) {
      return this.centerX; // Root branch is at centerX
    }
    
    // Get parent branch's position
    const parentX = this.getPositionForBranch(relation.parentId, branchMap);
    
    // Calculate position relative to parent
    return parentX + (relation.relativeSlot * this.slotWidth);
  }
  
  /**
   * Calculate x position for a slot (legacy method for compatibility)
   */
  getPositionForSlot(slot: number): number {
    return this.centerX + (slot * this.slotWidth);
  }
  
  /**
   * Shift branches to make room for new insertions
   * This handles the case where a new branch needs to occupy a slot that would
   * displace existing branches.
   */
  private shiftBranchesForInsertion(targetSlot: number, shiftDirection: 'left' | 'right'): void {
    // Collect branches that need to be shifted
    const branchesToShift: string[] = [];
    
    for (const [branchId, slot] of this.branchToSlot.entries()) {
      if (shiftDirection === 'right' && slot >= targetSlot) {
        branchesToShift.push(branchId);
      } else if (shiftDirection === 'left' && slot <= targetSlot) {
        branchesToShift.push(branchId);
      }
    }
    
    // Apply the shifts
    for (const branchId of branchesToShift) {
      const currentSlot = this.branchToSlot.get(branchId);
      if (currentSlot === undefined) continue;
      
      // Calculate new slot
      const newSlot = shiftDirection === 'right' 
        ? currentSlot + 1
        : currentSlot - 1;
      
      // Update slot maps
      this.occupiedGlobalSlots.delete(currentSlot);
      this.branchToSlot.set(branchId, newSlot);
      this.occupiedGlobalSlots.add(newSlot);
      
      // Update relation's relative slot if needed
      const relation = this.branchRelations.get(branchId);
      if (relation && relation.parentId) {
        const parentSlot = this.branchToSlot.get(relation.parentId) || 0;
        this.branchRelations.set(branchId, {
          ...relation,
          relativeSlot: newSlot - parentSlot
        });
      }
    }
  }
  
  /**
   * Allocate a slot for a branch based on its parent and child index
   * Now supports directional preferences for better branch positioning
   */
  allocateSlot(
    branchId: string, 
    parentBranchId: string | null, 
    childIndex: number, 
    preferredDirection: 'left' | 'right' | 'auto' = 'auto'
  ): number {
    // Root branch is always slot 0
    if (!parentBranchId) {
      const slot = 0;
      this.branchToSlot.set(branchId, slot);
      this.occupiedGlobalSlots.add(slot);
      
      // Store relation
      this.branchRelations.set(branchId, {
        parentId: null,
        relativeSlot: 0,
        direction: 'auto'
      });
      
      return slot;
    }
    
    // Get parent's slot
    const parentSlot = this.branchToSlot.get(parentBranchId) || 0;
    
    // Determine if parent is to the left or right of center (slot 0)
    const parentSide = parentSlot < 0 ? 'left' : parentSlot > 0 ? 'right' : 'center';
    
    // Determine initial direction based on child index and preferred direction
    let relativeSlot: number;
    let resolvedDirection: 'left' | 'right' | 'auto';
    
    // If a direction preference is provided, use that
    if (preferredDirection !== 'auto') {
      resolvedDirection = preferredDirection;
      relativeSlot = preferredDirection === 'left' ? -1 : 1;
    } 
    // If no preference, use child index based approach
    else {
      if (childIndex % 2 === 0) {
        // Even index: try right side first
        relativeSlot = 1;
        resolvedDirection = 'right';
      } else {
        // Odd index: try left side first
        relativeSlot = -1;
        resolvedDirection = 'left';
      }
    }
    
    let globalSlot = parentSlot + relativeSlot;
    
    // Special handling for insertion
    // 1. Left-facing branch on a right branch should take parent's slot
    if (resolvedDirection === 'left' && parentSide === 'right') {
      globalSlot = parentSlot;
      relativeSlot = 0;
      
      // Shift all branches to the right of this slot
      this.shiftBranchesForInsertion(globalSlot, 'right');
    }
    // 2. Right-facing branch on a left branch should take parent's slot
    else if (resolvedDirection === 'right' && parentSide === 'left') {
      globalSlot = parentSlot;
      relativeSlot = 0;
      
      // Shift all branches to the left of this slot
      this.shiftBranchesForInsertion(globalSlot, 'left');
    }
    // Handle case where global slot is already occupied
    else if (this.occupiedGlobalSlots.has(globalSlot)) {
      // Try slots in outward direction from parent
      let offset = 1;
      while (true) {
        // Try in the preferred direction first
        if (resolvedDirection === 'right') {
          globalSlot = parentSlot + offset;
          if (!this.occupiedGlobalSlots.has(globalSlot)) {
            relativeSlot = offset;
            break;
          }
        } else {
          globalSlot = parentSlot - offset;
          if (!this.occupiedGlobalSlots.has(globalSlot)) {
            relativeSlot = -offset;
            break;
          }
        }
        
        // If no slot found in preferred direction, try the other
        if (resolvedDirection === 'right') {
          globalSlot = parentSlot - offset;
          if (!this.occupiedGlobalSlots.has(globalSlot)) {
            relativeSlot = -offset;
            resolvedDirection = 'left'; // Update direction
            break;
          }
        } else {
          globalSlot = parentSlot + offset;
          if (!this.occupiedGlobalSlots.has(globalSlot)) {
            relativeSlot = offset;
            resolvedDirection = 'right'; // Update direction
            break;
          }
        }
        
        // Increase offset and try again
        offset++;
      }
    }
    
    // Store global slot for occupied slot tracking
    this.branchToSlot.set(branchId, globalSlot);
    this.occupiedGlobalSlots.add(globalSlot);
    
    // Store parent relation with resolved direction
    this.branchRelations.set(branchId, {
      parentId: parentBranchId,
      relativeSlot,
      direction: resolvedDirection
    });
    
    return globalSlot;
  }
}

export default SlotBasedLayoutService;