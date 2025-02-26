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
 * - root: When 'true', fetch the root node and its direct children
 * - all: When 'true', fetch all nodes for the project
 * - complete_tree: When 'true', fetch the complete conversation tree including all branches
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const branchId = searchParams.get('branch_id');
  const root = searchParams.get('root') === 'true';
  const all = searchParams.get('all') === 'true';
  const completeTree = searchParams.get('complete_tree') === 'true';
  
  // Legacy parameter - deprecated
  const expertId = searchParams.get('expert_id');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  try {
    let result;

    // Fetch complete conversation tree for the project
    if (completeTree) {
      console.log('Fetching complete conversation tree for project:', projectId);
      
      // First get the root node
      const rootResult = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1 AND type = 'root'
         LIMIT 1`,
        [projectId]
      );
      
      if (rootResult.rows.length === 0) {
        return NextResponse.json([], { status: 200 });
      }
      
      const rootNode = rootResult.rows[0];
      
      // Use a recursive CTE to get all nodes connected to the root
      const treeResult = await query(
        `WITH RECURSIVE conversation_tree AS (
           -- Base case: start with the root node
           SELECT * FROM timeline_nodes 
           WHERE id = $1
           
           UNION ALL
           
           -- Recursive case: get all children of nodes already in the tree
           SELECT n.* 
           FROM timeline_nodes n
           JOIN conversation_tree p ON n.parent_id = p.id
         )
         SELECT * FROM conversation_tree
         ORDER BY created_at ASC`,
        [rootNode.id]
      );
      
      console.log(`Found ${treeResult.rows.length} nodes in the complete conversation tree`);
      
      // Process content field for each node
      const processedNodes = treeResult.rows.map(parseNodeContent);
      
      return NextResponse.json(processedNodes);
    }

    // Fetch all nodes for the project
    if (all) {
      result = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1
         ORDER BY created_at ASC`,
        [projectId]
      );
      
      // Process content field for each node
      const processedNodes = result.rows.map(parseNodeContent);
      
      return NextResponse.json(processedNodes);
    }

    // Fetch root node only
    if (root) {
      result = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1 AND type = 'root'
         LIMIT 1`,
        [projectId]
      );

      if (result.rows.length > 0) {
        const rootNode = parseNodeContent(result.rows[0]);
        
        // Find first level of messages (direct children of root)
        const childrenResult = await query(
          `SELECT * FROM timeline_nodes 
           WHERE project_id = $1 AND parent_id = $2
           ORDER BY created_at ASC`,
          [projectId, rootNode.id]
        );
        
        const processedChildren = childrenResult.rows.map(parseNodeContent);
        
        return NextResponse.json([rootNode, ...processedChildren]);
      }
      
      return NextResponse.json([]);
    }

    // Fetch branch starting from a specific node
    if (branchId) {
      // First, get the branch node itself
      const branchNodeResult = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1 AND id = $2`,
        [projectId, branchId]
      );
      
      if (branchNodeResult.rows.length === 0) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
      }
      
      // Get all messages in the branch (finding all nodes connected to this branch)
      // This is a recursive query to find all descendants
      const branchMessages = await query(
        `WITH RECURSIVE branch_messages AS (
           SELECT * FROM timeline_nodes WHERE id = $1
           UNION
           SELECT n.* FROM timeline_nodes n
           INNER JOIN branch_messages b ON n.parent_id = b.id
         )
         SELECT * FROM branch_messages
         ORDER BY created_at ASC`,
        [branchId]
      );
      
      const processedBranchNodes = branchMessages.rows.map(parseNodeContent);
      
      return NextResponse.json(processedBranchNodes);
    }

    // Legacy support for expert-based querying - DEPRECATED
    if (expertId) {
      console.warn('Expert-based querying is deprecated and will be removed in future versions');
      result = await query(
        `SELECT * FROM timeline_nodes 
         WHERE project_id = $1
         ORDER BY created_at ASC`,
        [projectId]
      );
      
      const processedNodes = result.rows.map(parseNodeContent);
      
      return NextResponse.json(processedNodes);
    }

    // Default: return all nodes for the project
    result = await query(
      `SELECT * FROM timeline_nodes 
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    );
    
    const processedNodes = result.rows.map(parseNodeContent);
    
    return NextResponse.json(processedNodes);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
} 