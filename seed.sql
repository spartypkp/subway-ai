-- Subway AI Test Data Seeding Script
-- This script creates a test project with multiple conversation branches

-- Clear existing test data (if needed)
DELETE FROM timeline_nodes WHERE project_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM projects WHERE id = '11111111-1111-1111-1111-111111111111';

-- Create test project
INSERT INTO projects (
  id, 
  name, 
  description, 
  created_at, 
  updated_at, 
  settings, 
  context, 
  metadata
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Project',
  'A project for testing the subway visualization',
  NOW(),
  NOW(),
  '{"theme": "blue"}',
  '{"scope": "testing"}',
  '{}'
);

-- Branch 1: Main conversation branch (branch_id: main-branch)
-- Root node
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  NULL,
  'root',
  NULL,
  '{"reason": "Main conversation"}',
  'system',
  NOW() - INTERVAL '1 hour',
  0,
  '{}'
);

-- Main branch messages
-- Message 1 (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000000',
  'message',
  NULL,
  '{"text": "Hello! I need help with a data structure problem.", "role": "user"}',
  'user',
  NOW() - INTERVAL '59 minutes',
  1,
  '{}'
);

-- Message 2 (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000001',
  'message',
  NULL,
  '{"text": "I''d be happy to help with your data structure problem. Could you provide more details?", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '58 minutes',
  2,
  '{}'
);

-- Message 3 (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000002',
  'message',
  NULL,
  '{"text": "I need to store a tree of messages efficiently. What approach would you recommend?", "role": "user"}',
  'user',
  NOW() - INTERVAL '57 minutes',
  3,
  '{}'
);

-- Message 4 (Assistant) - FORK POINT 1
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000003',
  'message',
  NULL,
  '{"text": "For tree structures, you could use an adjacency list or nested set model. The adjacency list is simpler - each node stores its parent ID.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '56 minutes',
  4,
  '{}'
);

-- Message 5 (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000005',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000004',
  'message',
  NULL,
  '{"text": "That makes sense. How would I query for all descendants of a node?", "role": "user"}',
  'user',
  NOW() - INTERVAL '55 minutes',
  5,
  '{}'
);

-- Message 6 (Assistant) - FORK POINT 2
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000006',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000005',
  'message',
  NULL,
  '{"text": "In SQL, you can use a recursive CTE query to find all descendants. In NoSQL, you might store a path attribute on each node.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '54 minutes',
  6,
  '{}'
);

-- Message 7 (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000007',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000006',
  'message',
  NULL,
  '{"text": "Great! How about performance considerations for large trees?", "role": "user"}',
  'user',
  NOW() - INTERVAL '53 minutes',
  7,
  '{}'
);

-- Message 8 (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000008',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000007',
  'message',
  NULL,
  '{"text": "For large trees, consider indexing, caching frequently accessed subtrees, or using a materialized path pattern for quick ancestry lookups.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '52 minutes',
  8,
  '{}'
);

-- Message 9 (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000009',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000008',
  'message',
  NULL,
  '{"text": "Thanks for the insights. I think I have a good starting point now.", "role": "user"}',
  'user',
  NOW() - INTERVAL '51 minutes',
  9,
  '{}'
);

-- Message 10 (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '20000000-0000-0000-0000-000000000010',
  '11111111-1111-1111-1111-111111111111',
  'main-branch',
  '20000000-0000-0000-0000-000000000009',
  'message',
  NULL,
  '{"text": "You''re welcome! Feel free to ask if you need more specific guidance on implementation.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '50 minutes',
  10,
  '{}'
);

-- Branch 2: NoSQL approach branch (forking from message 4)
-- Fork node
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '30000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'nosql-branch',
  '20000000-0000-0000-0000-000000000004',
  'fork',
  NULL,
  '{"reason": "Exploring NoSQL approach"}',
  'user',
  NOW() - INTERVAL '49 minutes',
  0,
  '{}'
);

-- Message 1 in NoSQL branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'nosql-branch',
  '30000000-0000-0000-0000-000000000000',
  'message',
  NULL,
  '{"text": "Let''s focus on NoSQL instead. How would document-based storage work for a tree?", "role": "user"}',
  'user',
  NOW() - INTERVAL '48 minutes',
  1,
  '{}'
);

-- Message 2 in NoSQL branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '30000000-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'nosql-branch',
  '30000000-0000-0000-0000-000000000001',
  'message',
  NULL,
  '{"text": "In document databases like MongoDB, you could use either embedded documents for small trees or references for larger trees.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '47 minutes',
  2,
  '{}'
);

-- Message 3 in NoSQL branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '30000000-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'nosql-branch',
  '30000000-0000-0000-0000-000000000002',
  'message',
  NULL,
  '{"text": "What are the tradeoffs between embedded documents and references?", "role": "user"}',
  'user',
  NOW() - INTERVAL '46 minutes',
  3,
  '{}'
);

-- Message 4 in NoSQL branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '30000000-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'nosql-branch',
  '30000000-0000-0000-0000-000000000003',
  'message',
  NULL,
  '{"text": "Embedded documents are faster to query but can''t exceed document size limits. References are more flexible for large trees but require multiple queries.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '45 minutes',
  4,
  '{}'
);

-- Message 5 in NoSQL branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '30000000-0000-0000-0000-000000000005',
  '11111111-1111-1111-1111-111111111111',
  'nosql-branch',
  '30000000-0000-0000-0000-000000000004',
  'message',
  NULL,
  '{"text": "Could we use a hybrid approach that embeds immediate children but uses references for deeper levels?", "role": "user"}',
  'user',
  NOW() - INTERVAL '44 minutes',
  5,
  '{}'
);

-- Message 6 in NoSQL branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '30000000-0000-0000-0000-000000000006',
  '11111111-1111-1111-1111-111111111111',
  'nosql-branch',
  '30000000-0000-0000-0000-000000000005',
  'message',
  NULL,
  '{"text": "Yes! A hybrid approach can work well. You could embed the first few levels and use references for deeper levels or very large subtrees.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '43 minutes',
  6,
  '{}'
);

-- Branch 3: Graph database approach (forking from message 6 in main branch)
-- Fork node
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '20000000-0000-0000-0000-000000000006',
  'fork',
  NULL,
  '{"reason": "Exploring graph database approach"}',
  'user',
  NOW() - INTERVAL '39 minutes',
  0,
  '{}'
);

-- Message 1 in Graph branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000000',
  'message',
  NULL,
  '{"text": "What about using a graph database instead? Would that be more natural?", "role": "user"}',
  'user',
  NOW() - INTERVAL '38 minutes',
  1,
  '{}'
);

-- Message 2 in Graph branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000001',
  'message',
  NULL,
  '{"text": "Absolutely! Graph databases like Neo4j are excellent for tree structures since they natively support parent-child relationships.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '37 minutes',
  2,
  '{}'
);

-- Message 3 in Graph branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000002',
  'message',
  NULL,
  '{"text": "That sounds promising. How would queries look for finding all descendants?", "role": "user"}',
  'user',
  NOW() - INTERVAL '36 minutes',
  3,
  '{}'
);

-- Message 4 in Graph branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000003',
  'message',
  NULL,
  '{"text": "In Cypher (Neo4j''s query language), you''d use something like: MATCH (parent {id: ''node1''})-[:CHILD*]->(descendant) RETURN descendant", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '35 minutes',
  4,
  '{}'
);

-- Message 5 in Graph branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000005',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000004',
  'message',
  NULL,
  '{"text": "That looks really elegant! Are there any downsides to using graph databases?", "role": "user"}',
  'user',
  NOW() - INTERVAL '34 minutes',
  5,
  '{}'
);

-- Message 6 in Graph branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000006',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000005',
  'message',
  NULL,
  '{"text": "The main downsides are learning curve, potential scaling challenges with very large graphs, and less ecosystem support compared to traditional databases.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '33 minutes',
  6,
  '{}'
);

-- Message 7 in Graph branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000007',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000006',
  'message',
  NULL,
  '{"text": "I think the benefits outweigh the downsides for our tree use case. Anything else I should consider?", "role": "user"}',
  'user',
  NOW() - INTERVAL '32 minutes',
  7,
  '{}'
);

-- Message 8 in Graph branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '40000000-0000-0000-0000-000000000008',
  '11111111-1111-1111-1111-111111111111',
  'graph-branch',
  '40000000-0000-0000-0000-000000000007',
  'message',
  NULL,
  '{"text": "Consider how you''ll handle backups, recovery, and integration with your existing stack. Also, some graph DBs offer ACID compliance if that''s important for your use case.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '31 minutes',
  8,
  '{}'
);

-- Branch 4: Performance optimization branch (also forking from message 6 in main branch)
-- Fork node
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '50000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'performance-branch',
  '20000000-0000-0000-0000-000000000006',
  'fork',
  NULL,
  '{"reason": "Focusing on performance optimization"}',
  'user',
  NOW() - INTERVAL '29 minutes',
  0,
  '{}'
);

-- Message 1 in Performance branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '50000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'performance-branch',
  '50000000-0000-0000-0000-000000000000',
  'message',
  NULL,
  '{"text": "I''m concerned about performance with large trees. What optimization techniques exist?", "role": "user"}',
  'user',
  NOW() - INTERVAL '28 minutes',
  1,
  '{}'
);

-- Message 2 in Performance branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '50000000-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'performance-branch',
  '50000000-0000-0000-0000-000000000001',
  'message',
  NULL,
  '{"text": "Great question! For large trees, consider: materialized paths, nested sets, closure tables, and denormalization of ancestor data.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '27 minutes',
  2,
  '{}'
);

-- Message 3 in Performance branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '50000000-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'performance-branch',
  '50000000-0000-0000-0000-000000000002',
  'message',
  NULL,
  '{"text": "Can you explain materialized paths? That sounds promising.", "role": "user"}',
  'user',
  NOW() - INTERVAL '26 minutes',
  3,
  '{}'
);

-- Message 4 in Performance branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '50000000-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'performance-branch',
  '50000000-0000-0000-0000-000000000003',
  'message',
  NULL,
  '{"text": "Materialized paths store the entire ancestry path in each node, like /1/4/7/ for a node with ancestors 1 and 4. Queries become simple pattern matches: WHERE path LIKE ''/1/4/%''", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '25 minutes',
  4,
  '{}'
);

-- Message 5 in Performance branch (User)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '50000000-0000-0000-0000-000000000005',
  '11111111-1111-1111-1111-111111111111',
  'performance-branch',
  '50000000-0000-0000-0000-000000000004',
  'message',
  NULL,
  '{"text": "That''s clever! And what about closure tables?", "role": "user"}',
  'user',
  NOW() - INTERVAL '24 minutes',
  5,
  '{}'
);

-- Message 6 in Performance branch (Assistant)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  '50000000-0000-0000-0000-000000000006',
  '11111111-1111-1111-1111-111111111111',
  'performance-branch',
  '50000000-0000-0000-0000-000000000005',
  'message',
  NULL,
  '{"text": "Closure tables store all ancestor-descendant relationships in a separate table. This enables fast querying for any relationship, but requires more storage and maintenance during inserts/updates.", "role": "assistant"}',
  'assistant',
  NOW() - INTERVAL '23 minutes',
  6,
  '{}'
);

-- Add more test messages as needed...

-- Commit the data
COMMIT; 