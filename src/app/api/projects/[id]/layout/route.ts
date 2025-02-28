import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import SubwayLayoutService from '@/lib/layout/subwayLayoutService';

/**
 * POST /api/projects/[id]/layout
 * 
 * Recalculates and updates the layout positions for all branches in a project
 * Uses the SubwayLayoutService to apply tree-aware layout algorithms
 * 
 * @param req NextRequest with project ID in params
 * @returns Updated layout information
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const {id: projectId} = await params;
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    // Check if project exists
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Use layout service to recalculate and update branch layouts
    const layoutService = new SubwayLayoutService();
    await layoutService.updateBranchPositions(projectId);
    
    // Return success response
    return NextResponse.json(
      { message: 'Layout updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating layout:', error);
    return NextResponse.json(
      { error: 'Failed to update layout' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/layout
 * 
 * Gets the current layout information for a project's branches
 * Returns only the layout-related metadata
 * 
 * @param req NextRequest with project ID in params
 * @returns Layout information for all branches
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const {id: projectId} = await params;
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    // Fetch all branches for the project
    const branchesResult = await query(
      'SELECT id, name, color, depth, metadata FROM branches WHERE project_id = $1',
      [projectId]
    );
    
    // Extract layout information from each branch's metadata
    const layoutInfo = branchesResult.rows.map(branch => ({
      id: branch.id,
      name: branch.name,
      color: branch.color,
      depth: branch.depth,
      layout: branch.metadata?.layout || null
    }));
    
    return NextResponse.json(layoutInfo, { status: 200 });
  } catch (error) {
    console.error('Error fetching layout information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layout information' },
      { status: 500 }
    );
  }
} 