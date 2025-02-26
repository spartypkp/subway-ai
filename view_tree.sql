-- Subway AI - View Conversation Tree Structure
-- This script visualizes the tree structure of messages in a hierarchical format

-- Set the project ID to view
\set project_id '11111111-1111-1111-1111-111111111111'

-- Function to create indentation based on depth
CREATE OR REPLACE FUNCTION repeat_text(text text, n integer) RETURNS text AS
$$
SELECT string_agg(text, '') FROM generate_series(1, n);
$$
LANGUAGE SQL IMMUTABLE;

-- Recursive query to traverse the tree
WITH RECURSIVE message_tree AS (
  -- Start with root nodes
  SELECT 
    n.id,
    n.branch_id,
    n.parent_id,
    n.type,
    n.content,
    n.created_at,
    0 AS depth,
    n.id::text AS path,
    CASE 
      WHEN n.type = 'message' THEN 
        CASE 
          WHEN (n.content::jsonb->>'role') = 'user' THEN 'U'
          ELSE 'A'
        END
      WHEN n.type = 'fork' THEN 'F'
      ELSE 'R'
    END AS node_type
  FROM 
    timeline_nodes n
  WHERE 
    n.project_id = :'project_id' AND
    n.parent_id IS NULL
  
  UNION ALL
  
  -- Add child nodes
  SELECT 
    n.id,
    n.branch_id,
    n.parent_id,
    n.type,
    n.content,
    n.created_at,
    mt.depth + 1,
    mt.path || '>' || n.id::text,
    CASE 
      WHEN n.type = 'message' THEN 
        CASE 
          WHEN (n.content::jsonb->>'role') = 'user' THEN 'U'
          ELSE 'A'
        END
      WHEN n.type = 'fork' THEN 'F'
      ELSE 'R'
    END AS node_type
  FROM 
    timeline_nodes n
    JOIN message_tree mt ON n.parent_id = mt.id
  WHERE 
    n.project_id = :'project_id'
)

-- Output the tree in a readable format
SELECT 
  repeat_text('    ', depth) || 
  CASE node_type
    WHEN 'U' THEN '👤 User: ' 
    WHEN 'A' THEN '🤖 AI: ' 
    WHEN 'F' THEN '🔀 FORK: '
    WHEN 'R' THEN '🔝 ROOT: '
  END ||
  CASE
    WHEN type = 'message' THEN 
      CASE 
        WHEN length(content::jsonb->>'text') > 50 
        THEN substring((content::jsonb->>'text'), 1, 50) || '...'
        ELSE content::jsonb->>'text'
      END
    WHEN type = 'fork' THEN content::jsonb->>'reason'
    WHEN type = 'root' THEN content::jsonb->>'reason'
  END ||
  ' [Branch: ' || branch_id || ', ID: ' || substring(id::text, 1, 8) || '...]' AS tree_view,
  created_at,
  path
FROM 
  message_tree
ORDER BY 
  path, created_at;

-- Show branch information
SELECT 
  branch_id,
  COUNT(*) AS node_count,
  MIN(created_at) AS started_at,
  MAX(created_at) AS last_activity
FROM 
  timeline_nodes
WHERE 
  project_id = :'project_id'
GROUP BY 
  branch_id
ORDER BY 
  MIN(created_at);

-- Drop the temporary function
DROP FUNCTION IF EXISTS repeat_text(text, integer); 