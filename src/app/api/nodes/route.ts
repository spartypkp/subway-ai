import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Helper function to parse content field from database
 * Handles both string JSON and already-parsed JSON objects
 */
function parseNodeContent(node: any) {
  if (!node) return node;
  
  try {
    //console.log(`Processing node ${node.id} (type: ${node.type})`);
    //console.log(`Content before processing:`, node.content);
    //console.log(`Content type: ${typeof node.content}`);
    
    // If content is a string, parse it to JSON
    if (node.content && typeof node.content === 'string') {
      try {
        // Attempt to parse the string as JSON
        const parsedContent = JSON.parse(node.content);
        //console.log(`Successfully parsed string content to:`, parsedContent);
        
        // Check if the parsed content has the expected structure
        if (typeof parsedContent === 'object' && parsedContent !== null) {
          if (node.type === 'message' && !('role' in parsedContent)) {
            //console.warn(`Message node ${node.id} missing 'role' in content, adding default`);
            parsedContent.role = 'assistant';
          }
          
          if (node.type === 'message' && !('text' in parsedContent)) {
            //console.warn(`Message node ${node.id} missing 'text' in content, adding empty text`);
            parsedContent.text = '';
          }
          
          node.content = parsedContent;
        } else {
          // If parsing succeeded but didn't yield an object, wrap it in proper structure
          //console.warn(`Parsed content is not an object, wrapping in proper structure`);
          if (node.type === 'message') {
            node.content = {
              text: String(parsedContent),
              role: 'assistant'
            };
          }
        }
      } catch (e) {
        // If parsing fails, leave as is - it might be plain text
        //console.warn(`Failed to parse node ${node.id} content as JSON:`, e);
        
        // For message nodes, ensure proper structure by wrapping plain text
        if (node.type === 'message') {
          node.content = {
            text: node.content,
            role: 'assistant'
          };
          //console.log(`Wrapped plain text in proper message structure`);
        }
      }
    } else if (node.content && typeof node.content === 'object') {
      // Content is already an object, ensure it has the right structure for messages
      if (node.type === 'message') {
        if (!('role' in node.content)) {
          //console.warn(`Message node ${node.id} missing 'role' in content object, adding default`);
          node.content.role = 'assistant';
        }
        
        if (!('text' in node.content)) {
          //console.warn(`Message node ${node.id} missing 'text' in content object, adding empty text`);
          node.content.text = '';
        }
      }
    }
    
    //console.log(`Content after processing:`, node.content);
    return node;
  } catch (error) {
    //console.error('Error processing node content:', error);
    return node;
  }
}

/**
 * API endpoint for retrieving timeline nodes
 * 
 * Supports the following query parameters:
 * - project_id (required): The project to fetch nodes for
 * - branch_id: Fetch nodes for a specific branch
 * - complete_tree: When 'true', fetch the complete conversation tree including all branches
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const completeTree = searchParams.get('complete_tree') === 'true';
  const branchId = searchParams.get('branch_id');
  
  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // First fetch branches for the project
    const branchesResult = await query(`
      SELECT b.*, 
             p.branch_id AS parent_branch,
             (SELECT COUNT(c.id) FROM branches c WHERE c.parent_branch_id = b.id) AS child_branch_count
      FROM branches b
      LEFT JOIN timeline_nodes p ON b.branch_point_node_id = p.id
      WHERE b.project_id = $1
      ORDER BY b.depth ASC
    `, [projectId]);
    
    const branches = branchesResult.rows;
    
    // Then fetch nodes with branch information
    let nodesQuery = `
      SELECT n.*,
             b.color AS branch_color,
             b.depth AS branch_depth,
             b.parent_branch_id,
             b.name AS branch_name
      FROM timeline_nodes n
      JOIN branches b ON n.branch_id = b.id
      WHERE n.project_id = $1
    `;
    
    const queryParams = [projectId];
    
    // Add branch filtering if requested and not getting the complete tree
    if (branchId && !completeTree) {
      nodesQuery += ` AND n.branch_id = $2`;
      queryParams.push(branchId);
    }
    
    nodesQuery += ` ORDER BY n.branch_id, n.position`;
    
    const nodesResult = await query(nodesQuery, queryParams);
    const nodes = nodesResult.rows.map(node => {
      // Convert message_text to the expected content format for backward compatibility
      if (node.type === 'user-message' || node.type === 'assistant-message') {
        const role = node.type === 'user-message' ? 'user' : 'assistant';
        node.content = {
          role,
          text: node.message_text || ''
        };
      }
      return node;
    });

    return NextResponse.json({
      branches,
      nodes
    });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
  }
}