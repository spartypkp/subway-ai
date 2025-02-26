-- Drop tables if they exist
DROP TABLE IF EXISTS timeline_nodes;
DROP TABLE IF EXISTS experts;
DROP TABLE IF EXISTS projects;

-- Create projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  settings JSONB,
  context JSONB,
  metadata JSONB
);



-- Create timeline_nodes table
CREATE TABLE timeline_nodes (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL, -- Branch ID for grouping messages
  expert_id VARCHAR(255), -- DEPRECATED - kept only for backward compatibility
  parent_id UUID REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'root', 'message', 'fork'
  status VARCHAR(50), -- 'archived', 'hidden', 'featured'
  content JSONB NOT NULL,
  created_by VARCHAR(255) NOT NULL, -- User or system that created the node
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  position INTEGER NOT NULL, -- Position in the branch for ordering
  metadata JSONB
);

-- Create indexes
CREATE INDEX idx_timeline_nodes_project_id ON timeline_nodes(project_id);
CREATE INDEX idx_timeline_nodes_branch_id ON timeline_nodes(branch_id);
CREATE INDEX idx_timeline_nodes_parent_id ON timeline_nodes(parent_id);
CREATE INDEX idx_experts_project_id ON experts(project_id); -- DEPRECATED - kept for backward compatibility

-- Create branch point view
CREATE OR REPLACE VIEW branch_points AS
SELECT
  p.id AS parent_id,
  p.project_id,
  p.type AS parent_type,
  p.content AS parent_content,
  COUNT(c.id) AS branch_count
FROM
  timeline_nodes p
LEFT JOIN
  timeline_nodes c ON p.id = c.parent_id
GROUP BY
  p.id, p.project_id, p.type, p.content
HAVING
  COUNT(c.id) > 1; 