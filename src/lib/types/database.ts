// UUID type for type safety
export type UUID = string;

// Base type for timestamps
interface Timestamps {
	created_at: Date;
	updated_at: Date;
}

// Project context types
export interface ProjectContext {
	tech_stack?: {
		frontend?: string[];
		backend?: string[];
		deployment?: string[];
		[key: string]: string[] | undefined;
	};
	guidelines?: {
		code_style?: string;
		architecture?: string;
		[key: string]: string | undefined;
	};
	[key: string]: any;
}

// Project settings types
export interface ProjectSettings {
	theme?: string;
	view_preferences?: {
		[key: string]: any;
	};
	[key: string]: any;
}

// Expert instruction types
export interface ExpertInstructions {
	tech_stack: {
		expertise: string[];
		experience_level?: string;
		preferred_tools?: string[];
		[key: string]: any;
	};
	style_guide: {
		code_formatting?: string;
		component_structure?: string;
		naming_conventions?: string;
		[key: string]: any;
	};
	general: {
		response_format?: string;
		focus_areas?: string[];
		[key: string]: any;
	};
	personality: {
		tone?: string;
		communication_style?: string;
		expertise_level?: string;
		[key: string]: any;
	};
	[key: string]: any;
}

// Expert settings types
export interface ExpertSettings {
	ui_preferences?: {
		color_scheme?: string;
		[key: string]: any;
	};
	[key: string]: any;
}

// Main Project type
export interface Project {
	id: string;
	name: string;
	description: string | null;
	created_at: string;
	updated_at: string;
	created_by: string;
	settings: Record<string, any> | null;
	context: Record<string, any> | null;
	metadata: Record<string, any> | null;
}

// Main Expert type
export interface Expert {
	id: string;
	project_id: string;
	name: string;
	role: string;
	color: string;
	position: number;
	active: boolean;
	created_at: string;
	updated_at: string;
	instructions: Record<string, any> | null;
	settings: Record<string, any> | null;
	metadata: Record<string, any> | null;
}

// Branch type
export interface Branch {
	id: string;
	project_id: string;
	name: string | null;
	parent_branch_id: string | null;
	branch_point_node_id: string | null;
	color: string | null;
	depth: number;
	is_active: boolean;
	created_at: string;
	created_by: string;
	metadata: Record<string, any> | null;
	// Additional fields from joins
	parent_branch_name?: string;
	parent_branch_color?: string;
	message_count?: number;
	child_branch_count?: number;
	root_node_id?: string;
}

// Helper type for creating new projects
export type CreateProject = Omit<Project, 'id' | 'created_at' | 'updated_at'>;

// Helper type for creating new experts
export type CreateExpert = Omit<Expert, 'id' | 'created_at' | 'updated_at'>;

// Helper type for updating projects
export type UpdateProject = Partial<CreateProject>;

// Helper type for updating experts
export type UpdateExpert = Partial<CreateExpert>;

// Updated node types to match the new schema
export type NodeType = 'root' | 'branch-root' | 'user-message' | 'assistant-message' | 'branch-point';
export type NodeStatus = 'active' | 'archived' | 'hidden' | 'featured';

// OptimisticProps interface for the properties shared by optimistic messages
export interface OptimisticProps {
	optimistic?: boolean;
	isLoading?: boolean;
	isStreamChunk?: boolean;
	isFirstChunk?: boolean;
	isComplete?: boolean;
	error?: boolean;
}

// Base TimelineNode interface
export interface TimelineNode {
	id: string;
	project_id: string;
	branch_id: string;
	parent_id: string | null;
	type: NodeType;
	status?: string;
	position: number;
	created_by: string;
	created_at: string;
	updated_at?: string;
	message_text?: string;
	message_role?: string;
	branch_name?: string;
	branch_color?: string;
	branch_depth?: number;
	parent_branch_id?: string;
	parent_branch_name?: string;
	parent_branch_color?: string;
	metadata?: Record<string, any>;
	optimistic?: boolean;
	isLoading?: boolean;
}

// Root node (start of project)
export interface RootNode extends TimelineNode {
	type: 'root';
}

// Branch root node (start of a branch)
export interface BranchRootNode extends TimelineNode {
	type: 'branch-root';
}

// User message node
export interface UserMessageNode extends TimelineNode {
	type: 'user-message';
	message_text: string;
	message_role: 'user';
}

// Assistant message node
export interface AssistantMessageNode extends TimelineNode {
	type: 'assistant-message';
	message_text: string;
	message_role: 'assistant';
}

// Branch point node (where branches diverge)
export interface BranchPointNode extends TimelineNode {
	type: 'branch-point';
	child_branches?: Branch[];
}

export type TimelineNodeUnion = RootNode | BranchRootNode | UserMessageNode | AssistantMessageNode | BranchPointNode;

// Branch interface
export interface Branch {
	id: string;
	project_id: string;
	name: string | null;
	color: string | null;
	depth: number;
	is_active: boolean;
	parent_branch_id: string | null;
	branch_point_node_id: string | null;
	created_by: string;
	created_at: string;
	message_count?: number;
	parent_branch_name?: string;
	parent_branch_color?: string;
	branch_point_id?: string;
	branch_parent_message_id?: string;
	child_branch_count?: number;
} 