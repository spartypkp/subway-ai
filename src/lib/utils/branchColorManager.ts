/**
 * Branch Color Manager
 * 
 * Manages color allocation for branches with improved logic to ensure
 * diverse and visually distinct branch colors.
 */

// Color palette specifically designed for branch visualization
const BRANCH_COLORS = [
  '#3b82f6', // blue-500 (reserved for main branch)
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
];

// Reserved color for main branch
const MAIN_BRANCH_COLOR = BRANCH_COLORS[0];

export class BranchColorManager {
  private branchColors: Map<string, string> = new Map();
  private parentToChildColors: Map<string, Set<string>> = new Map();
  
  /**
   * Initialize with existing branches and their colors
   */
  constructor(branches: { id: string; parent_branch_id: string | null; color?: string; depth?: number }[]) {
    // Initialize color tracking
    this.branchColors = new Map();
    this.parentToChildColors = new Map();
    
    // Process existing branches to track their colors
    branches.forEach(branch => {
      // Skip branches without color
      if (!branch.color) return;
      
      // Store the branch color
      this.branchColors.set(branch.id, branch.color);
      
      // Track colors used by siblings (branches with the same parent)
      if (branch.parent_branch_id) {
        if (!this.parentToChildColors.has(branch.parent_branch_id)) {
          this.parentToChildColors.set(branch.parent_branch_id, new Set());
        }
        
        this.parentToChildColors.get(branch.parent_branch_id)?.add(branch.color);
      }
    });
    
    // Debug logging
    console.log("BranchColorManager initialized with:", {
      branchCount: branches.length,
      storedColors: this.branchColors.size,
      colorsByParent: Array.from(this.parentToChildColors.entries()).map(([parentId, colors]) => ({
        parentId,
        colorCount: colors.size,
        colors: Array.from(colors)
      }))
    });
  }
  
  /**
   * Get color for a branch, assigning a new color if needed
   */
  getColorForBranch(
    branchId: string, 
    parentBranchId: string | null, 
    depth: number = 0
  ): string {
    console.log(`Getting color for branch: ${branchId}, parent: ${parentBranchId}, depth: ${depth}`);
    
    // Return stored color if available
    if (this.branchColors.has(branchId)) {
      const color = this.branchColors.get(branchId)!;
      console.log(`Using existing color for branch ${branchId}: ${color}`);
      return color;
    }
    
    // Main branch (depth 0) always gets blue
    if (depth === 0) {
      this.branchColors.set(branchId, MAIN_BRANCH_COLOR);
      console.log(`Assigned main branch color to ${branchId}: ${MAIN_BRANCH_COLOR}`);
      return MAIN_BRANCH_COLOR;
    }
    
    // For child branches, pick a color different from siblings
    let availableColors = [...BRANCH_COLORS];
    
    // Remove the main branch color from options (unless we're desperate)
    availableColors = availableColors.filter(c => c !== MAIN_BRANCH_COLOR);
    
    // If we have a parent, avoid colors already used by siblings
    if (parentBranchId) {
      const siblingColors = this.parentToChildColors.get(parentBranchId) || new Set();
      console.log(`Sibling colors for parent ${parentBranchId}:`, Array.from(siblingColors));
      
      // Filter out colors already used by siblings
      const unusedColors = availableColors.filter(color => !siblingColors.has(color));
      
      // If we have unused colors, use those; otherwise fall back to the full list
      if (unusedColors.length > 0) {
        availableColors = unusedColors;
      }
    }
    
    // Pick a color (ideally different from parent if possible)
    let selectedColor: string;
    
    if (parentBranchId && this.branchColors.has(parentBranchId)) {
      const parentColor = this.branchColors.get(parentBranchId)!;
      
      // Try to find a color different from the parent
      const colorsDifferentFromParent = availableColors.filter(color => color !== parentColor);
      
      if (colorsDifferentFromParent.length > 0) {
        // Pick a color based on branchId hash for consistency
        const hashValue = this.hashString(branchId);
        selectedColor = colorsDifferentFromParent[hashValue % colorsDifferentFromParent.length];
      } else {
        // If no other colors available, just pick any from the available list
        const hashValue = this.hashString(branchId);
        selectedColor = availableColors[hashValue % availableColors.length];
      }
    } else {
      // No parent color to consider, just pick from available
      const hashValue = this.hashString(branchId);
      selectedColor = availableColors[hashValue % availableColors.length];
    }
    
    // Save the selected color
    this.branchColors.set(branchId, selectedColor);
    
    // Track this color under the parent
    if (parentBranchId) {
      if (!this.parentToChildColors.has(parentBranchId)) {
        this.parentToChildColors.set(parentBranchId, new Set());
      }
      this.parentToChildColors.get(parentBranchId)?.add(selectedColor);
    }
    
    console.log(`Assigned color for branch ${branchId}: ${selectedColor}`);
    return selectedColor;
  }
  
  /**
   * Simple string hash function for consistent color selection
   */
  private hashString(str: string): number {
    return str.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0) & 0xFFFFFFFF;
  }
} 