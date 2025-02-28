import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import LayoutServiceFactory from '@/lib/layout/layoutServiceFactory';
import { z } from 'zod';

// Parameter validation schema
const paramSchema = z.object({
  id: z.string().uuid(),
});

// Query params validation schema
const querySchema = z.object({
  layoutType: z.enum(['slot', 'tree']).optional(),
});

/**
 * POST /api/projects/[id]/layout
 * 
 * Recalculates and updates the layout positions for all branches in a project
 * Uses the selected layout service to apply tree-aware layout algorithms with better
 * collision avoidance.
 * 
 * @param req NextRequest with project ID in params
 * @returns Updated layout information
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate project ID parameter
    const { id } = await params;
    
    // Parse query params
    const url = new URL(request.url);
    const layoutType = url.searchParams.get('layoutType') || 'tree';
    const { layoutType: validatedLayoutType } = querySchema.parse({ 
      layoutType: layoutType as 'slot' | 'tree' 
    });
    
    // Check if project exists
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    
    if (projectResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Get appropriate layout service based on query parameter
    const layoutService = LayoutServiceFactory.getLayoutService(validatedLayoutType);
    await layoutService.updateBranchPositions(id);
    
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
 * Calculate and return the layout for a project's branches
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate project ID parameter
    const { id } = paramSchema.parse(params);
    
    // Parse query params
    const url = new URL(request.url);
    const layoutType = url.searchParams.get('layoutType') || 'tree';
    const { layoutType: validatedLayoutType } = querySchema.parse({ 
      layoutType: layoutType as 'slot' | 'tree' 
    });
    
    // Fetch project branches
    const branchesResult = await query(
      'SELECT * FROM branches WHERE project_id = $1',
      [id]
    );
    
    // Fetch project timeline nodes
    const nodesResult = await query(
      'SELECT * FROM timeline_nodes WHERE project_id = $1',
      [id]
    );
    
    // Get appropriate layout service based on query parameter
    const layoutService = LayoutServiceFactory.getLayoutService(validatedLayoutType);
    
    // Calculate layout
    const layoutResult = await layoutService.calculate(
      branchesResult.rows,
      nodesResult.rows
    );
    
    return NextResponse.json(layoutResult);
  } catch (error) {
    console.error('Error calculating project layout:', error);
    return NextResponse.json(
      { error: 'Failed to calculate project layout' },
      { status: 500 }
    );
  }
} 