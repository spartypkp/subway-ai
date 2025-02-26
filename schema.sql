-- Subway AI - Database Schema
-- This script creates the basic schema for the Subway AI application

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Timeline nodes table (represents messages, roots, and forks)
CREATE TABLE IF NOT EXISTS timeline_nodes (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch_id VARCHAR(255) NOT NULL,  -- ID for the branch this node belongs to
  parent_id UUID REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 'root', 'message', 'fork'
  status VARCHAR(50),  -- 'archived', 'hidden', 'featured'
  content JSONB NOT NULL,  -- Structured content based on node type
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  position INTEGER NOT NULL,  -- Order position in the conversation
  metadata JSONB DEFAULT '{}'
);

-- Indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_timeline_nodes_project_id ON timeline_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_nodes_branch_id ON timeline_nodes(branch_id);
CREATE INDEX IF NOT EXISTS idx_timeline_nodes_parent_id ON timeline_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_timeline_nodes_created_at ON timeline_nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_timeline_nodes_type ON timeline_nodes(type);

-- Create GIN indices for JSON content search
CREATE INDEX IF NOT EXISTS idx_timeline_nodes_content ON timeline_nodes USING GIN (content jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_projects_settings ON projects USING GIN (settings jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_projects_context ON projects USING GIN (context jsonb_path_ops);

COMMIT; 