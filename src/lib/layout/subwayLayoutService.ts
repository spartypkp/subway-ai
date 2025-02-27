import dagre from 'dagre';
import { Branch, TimelineNode } from '@/lib/types/database';
import { query } from '@/lib/db';

// Types for node data in the graph
interface NodeData {
  width: number;
  height: number;
  x?: number;
  y?: number;
  branch?: Branch;
  depth?: number;
  color?: string;
  name?: string;
  direction?: 'left' | 'right' | 'auto';
  siblingIndex?: number;
  siblingCount?: number;
}

// Types for layout calculation results
export interface BranchLayout {
  x: number;
  y: number;
  direction: 'left' | 'right' | 'auto';
  siblingIndex: number;
  level: number;
  // Branch width for node sizing
  width: number;
  height: number;
}

export interface LayoutResult {
  branchLayouts: Record<string, BranchLayout>;
  // Additional metadata about the layout
  width: number;
  height: number;
  centerX: number;
}

/**
 * Service for calculating subway-style branch layouts
 * Uses Dagre for the core graph layout algorithm with custom constraints
 * for subway-specific visualization requirements.
 */
export class SubwayLayoutService {
  /**
   * Calculate layout positions for branches in a project
   */
  calculate(branches: Branch[], nodes: TimelineNode[]): LayoutResult {
    // Setup graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB', // Top to bottom layout
      nodesep: 100,  // Vertical separation between nodes
      ranksep: 150,  // Horizontal separation between ranks
      edgesep: 50,   // Minimum separation between edges
      marginx: 50,
      marginy: 50
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes and edges to graph
    this.buildGraphFromBranches(g, branches, nodes);
    
    // Apply subway-specific constraints
    this.applySubwayConstraints(g, branches, nodes);
    
    // Run layout algorithm
    dagre.layout(g);
    
    // Extract positions and metadata
    return this.extractLayoutResults(g, branches);
  }

  /**
   * Build the graph structure from branches and nodes
   */
  private buildGraphFromBranches(
    g: dagre.graphlib.Graph, 
    branches: Branch[], 
    nodes: TimelineNode[]
  ): void {
    // Find the root branch (depth 0)
    const rootBranch = branches.find(b => b.depth === 0);
    if (!rootBranch) {
      console.warn('No root branch found');
      return;
    }

    // Add all branches as nodes in the graph
    branches.forEach(branch => {
      // Calculate node dimensions based on branch complexity
      // (could be refined based on actual content)
      const width = 200;  // Standard width for branch representation
      const height = 100; // Standard height for branch representation
      
      g.setNode(branch.id, {
        width,
        height,
        branch,
        // Store branch metadata for later use
        depth: branch.depth,
        color: branch.color,
        name: branch.name
      } as NodeData);
      
      // Connect to parent branch if exists
      if (branch.parent_branch_id) {
        g.setEdge(branch.parent_branch_id, branch.id);
      }
    });
  }

  /**
   * Apply subway-specific constraints to the graph
   */
  private applySubwayConstraints(
    g: dagre.graphlib.Graph, 
    branches: Branch[], 
    nodes: TimelineNode[]
  ): void {
    // Handle branches from the same parent point
    this.handleBranchesFromSamePoint(g, branches, nodes);
    
    // Apply direction constraints based on metadata
    branches.forEach(branch => {
      if (branch.metadata?.direction && branch.parent_branch_id) {
        const direction = branch.metadata.direction as 'left' | 'right' | 'auto';
        if (direction !== 'auto') {
          this.applyDirectionConstraint(g, branch, direction);
        }
      }
    });
  }

  /**
   * Handle branches that originate from the same branch point
   * Apply constraints to position them appropriately
   */
  private handleBranchesFromSamePoint(
    g: dagre.graphlib.Graph, 
    branches: Branch[], 
    nodes: TimelineNode[]
  ): void {
    // Group branches by parent branch and branch point node
    const branchGroups = new Map<string, Branch[]>();
    
    branches.forEach(branch => {
      if (branch.parent_branch_id && branch.branch_point_node_id) {
        const key = `${branch.parent_branch_id}:${branch.branch_point_node_id}`;
        if (!branchGroups.has(key)) {
          branchGroups.set(key, []);
        }
        branchGroups.get(key)?.push(branch);
      }
    });
    
    // Process each group of branches from the same point
    branchGroups.forEach((siblingBranches, key) => {
      if (siblingBranches.length > 1) {
        // Sort branches by some criteria (e.g., creation time)
        siblingBranches.sort((a, b) => {
          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();
          return aTime - bTime;
        });
        
        // Assign sibling index to metadata
        siblingBranches.forEach((branch, index) => {
          // Update node data with sibling information
          const nodeData = g.node(branch.id) as NodeData;
          g.setNode(branch.id, {
            ...nodeData,
            siblingIndex: index,
            siblingCount: siblingBranches.length
          } as NodeData);
          
          // Apply alternating left/right directions for siblings
          // This helps visualize branches from the same point
          const direction = index % 2 === 0 ? 'left' : 'right';
          this.applyDirectionConstraint(g, branch, direction);
        });
      }
    });
  }

  /**
   * Apply directional constraint to force branch in specific direction
   */
  private applyDirectionConstraint(
    g: dagre.graphlib.Graph, 
    branch: Branch, 
    direction: 'left' | 'right'
  ): void {
    if (!branch.parent_branch_id) return;
    
    const parentNode = g.node(branch.parent_branch_id) as NodeData;
    const currentNode = g.node(branch.id) as NodeData;
    
    if (!parentNode || !currentNode) return;
    
    // Store direction in node data
    g.setNode(branch.id, {
      ...currentNode,
      direction
    } as NodeData);
    
    // Adjust edge to enforce direction
    const edgeObj = {
      weight: 5,
      // Use minlen to control distance from parent
      minlen: 2,
      // Store direction for post-processing
      direction
    };
    
    g.setEdge(branch.parent_branch_id, branch.id, edgeObj);
  }

  /**
   * Extract final layout results from the calculated graph
   */
  private extractLayoutResults(
    g: dagre.graphlib.Graph, 
    branches: Branch[]
  ): LayoutResult {
    const branchLayouts: Record<string, BranchLayout> = {};
    
    // Extract the calculated positions for each branch
    branches.forEach(branch => {
      const nodeData = g.node(branch.id) as NodeData;
      if (!nodeData) return;
      
      branchLayouts[branch.id] = {
        x: nodeData.x as number,
        y: nodeData.y as number,
        direction: nodeData.direction || 'auto',
        siblingIndex: nodeData.siblingIndex || 0,
        level: branch.depth,
        width: nodeData.width,
        height: nodeData.height
      };
    });
    
    // Get overall graph dimensions
    const graphData = g.graph();
    
    return {
      branchLayouts,
      width: graphData.width || 0,
      height: graphData.height || 0,
      centerX: (graphData.width || 0) / 2
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
      const layoutResult = this.calculate(branches, nodes);
      
      // 4. Update branch metadata with calculated positions
      await Promise.all(
        branches.map((branch: Branch) => {
          const layout = layoutResult.branchLayouts[branch.id];
          if (!layout) return Promise.resolve();
          
          // Merge new layout data with existing metadata
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
          
          // Update branch metadata in the database
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
   * Post-process the layout to apply subway-specific visualizations
   * This method can be called after initial Dagre layout to refine positions
   */
  private postProcessLayout(g: dagre.graphlib.Graph): void {
    // Get all edges that have direction constraints
    const edges = g.edges();
    
    for (const edge of edges) {
      const edgeData = g.edge(edge) as {direction?: 'left' | 'right'};
      if (!edgeData.direction) continue;
      
      const sourceNode = g.node(edge.v) as NodeData;
      const targetNode = g.node(edge.w) as NodeData;
      
      // Apply additional adjustments based on direction
      if (edgeData.direction === 'left') {
        // Ensure target is to the left of source
        if ((targetNode.x as number) >= (sourceNode.x as number)) {
          targetNode.x = (sourceNode.x as number) - 300; // Force to left
        }
      } else if (edgeData.direction === 'right') {
        // Ensure target is to the right of source
        if ((targetNode.x as number) <= (sourceNode.x as number)) {
          targetNode.x = (sourceNode.x as number) + 300; // Force to right
        }
      }
      
      // Update node positions
      g.setNode(edge.w, targetNode);
    }
  }
}

export default SubwayLayoutService; 