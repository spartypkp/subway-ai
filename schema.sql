-- Enum type for node types
CREATE TYPE node_type AS ENUM (
    'root',              -- Project starting point (train station)
    'branch-root',       -- Starting point of a branch (where a new line begins)
    'user-message',      -- User messages (main stations)
    'assistant-message', -- AI responses (smaller stations/stops)
    'branch-point'       -- Connection point where branches diverge (transfer stations)
);

-- Enum type for node status
CREATE TYPE node_status AS ENUM (
    'active',
    'archived',
    'hidden',
    'featured'
);

-- Projects table (largely unchanged)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Branch information table (new)
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255),
    parent_branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    branch_point_node_id UUID, -- Will be set with a foreign key after timeline_nodes creation
    color VARCHAR(50),
    depth INTEGER NOT NULL DEFAULT 0, -- Distance from main branch (0 = main branch)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Revamped timeline nodes table
CREATE TABLE timeline_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES timeline_nodes(id) ON DELETE CASCADE,
    type node_type NOT NULL,
    status node_status DEFAULT 'active',
    
    -- Message specific fields
    message_text TEXT, -- Actual message content
    message_role VARCHAR(50), -- Could be derived from type but keeping for flexibility
    
    -- Position in sequence
    position INTEGER NOT NULL,
    
    -- Creation metadata
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Extensibility
    metadata JSONB DEFAULT '{}'
);

-- Add foreign key constraint for branch_point_node_id
ALTER TABLE branches ADD CONSTRAINT fk_branch_point 
    FOREIGN KEY (branch_point_node_id) REFERENCES timeline_nodes(id) ON DELETE SET NULL;

-- Create indexes for common query patterns
CREATE INDEX idx_nodes_branch_position ON timeline_nodes(branch_id, position);
CREATE INDEX idx_nodes_type ON timeline_nodes(type);
CREATE INDEX idx_branches_project ON branches(project_id);
CREATE INDEX idx_branches_parent ON branches(parent_branch_id);

-- Create useful views

-- View for branch hierarchy
CREATE VIEW branch_hierarchy AS
SELECT 
    b.id,
    b.project_id,
    b.name,
    b.parent_branch_id,
    b.branch_point_node_id,
    b.depth,
    b.color,
    b.is_active,
    bp.branch_id AS parent_branch,
    COUNT(c.id) AS child_branch_count
FROM 
    branches b
    LEFT JOIN timeline_nodes bp ON b.branch_point_node_id = bp.id
    LEFT JOIN branches c ON b.id = c.parent_branch_id
GROUP BY 
    b.id, b.project_id, b.name, b.parent_branch_id, 
    b.branch_point_node_id, b.depth, b.color, b.is_active, bp.branch_id;

-- View for conversation threads (messages in sequential order)
CREATE VIEW conversation_threads AS
SELECT 
    n.id,
    n.project_id,
    n.branch_id,
    n.type,
    n.message_text,
    n.message_role,
    n.position,
    n.created_at,
    n.parent_id,
    b.name AS branch_name,
    b.color AS branch_color,
    b.depth AS branch_depth,
    b.parent_branch_id
FROM 
    timeline_nodes n
    JOIN branches b ON n.branch_id = b.id
WHERE 
    n.type IN ('user-message', 'assistant-message', 'branch-point')
ORDER BY 
    n.branch_id, n.position;

-- View for branch points (where conversations fork)
CREATE VIEW branch_points AS
SELECT 
    bp.id AS branch_point_id,
    bp.project_id,
    bp.branch_id AS source_branch_id,
    bp.parent_id AS parent_message_id,
    bp.position,
    b.id AS target_branch_id,
    b.name AS target_branch_name,
    b.color AS target_branch_color,
    b.depth AS target_branch_depth,
    br.id AS branch_root_id
FROM 
    timeline_nodes bp
    JOIN branches b ON bp.id = b.branch_point_node_id
    LEFT JOIN timeline_nodes br ON (br.branch_id = b.id AND br.type = 'branch-root')
WHERE 
    bp.type = 'branch-point';