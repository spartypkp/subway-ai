import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import SubwayLayoutService from '@/lib/layout/subwayLayoutService';

/**
 * POST /api/projects/[id]/layout
 * 
 * Recalculates and updates the layout positions for all branches in a project
 * Uses the SubwayLayoutService to apply tree-aware layout algorithms
 * 
 * Query parameters:
 * - branch_id: Optional branch ID to recalculate only this branch and its descendants
 * 
 * @param req NextRequest with project ID in params
 * @returns Updated layout information
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    // Get branch_id from query string if provided
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branch_id');
    
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
    
    // If branch_id provided, verify it exists and belongs to this project
    if (branchId) {
      const branchCheck = await query(
        'SELECT id FROM branches WHERE id = $1 AND project_id = $2',
        [branchId, projectId]
      );
      
      if (branchCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Branch not found or does not belong to this project' },
          { status: 404 }
        );
      }
      
      // TODO: Implement selective branch recalculation in SubwayLayoutService
      // For now, we'll just recalculate all branches
      console.log(`Branch ID provided (${branchId}), but selective recalculation not yet implemented`);
    }
    
    // Use layout service to recalculate and update branch layouts
    let updatedBranches = [];
    try {
      const layoutService = new SubwayLayoutService();
      await layoutService.updateBranchPositions(projectId);
      
      // Get updated branches to return in response
      const branchesResult = await query(
        'SELECT id, name, metadata FROM branches WHERE project_id = $1',
        [projectId]
      );
      
      updatedBranches = branchesResult.rows
        .filter(branch => branch.metadata?.layout)
        .map(branch => ({
          id: branch.id,
          name: branch.name,
          hasLayout: !!branch.metadata?.layout
        }));
    } catch (layoutError) {
      console.error('Layout calculation error:', layoutError);
      return NextResponse.json(
        { 
          error: 'Layout calculation failed',
          details: layoutError instanceof Error ? layoutError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    
    // Return success response with info about updated branches
    return NextResponse.json(
      { 
        message: 'Layout updated successfully',
        updatedBranches: updatedBranches,
        targetBranch: branchId || 'all'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating layout:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update layout',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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
    const projectId = params.id;
    
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
    
    // Add cache headers to the response
    // Client should cache layout data for 15 minutes
    // but respect revalidation requests
    return NextResponse.json(
      layoutInfo, 
      { 
        status: 200,
        headers: {
          'Cache-Control': 'max-age=900, stale-while-revalidate=3600'
        }
      }
    );
  } catch (error) {
    console.error('Error fetching layout information:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch layout information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 