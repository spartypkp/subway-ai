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

// Helper type for creating new projects
export type CreateProject = Omit<Project, 'id' | 'created_at' | 'updated_at'>;

// Helper type for creating new experts
export type CreateExpert = Omit<Expert, 'id' | 'created_at' | 'updated_at'>;

// Helper type for updating projects
export type UpdateProject = Partial<CreateProject>;

// Helper type for updating experts
export type UpdateExpert = Partial<CreateExpert>; 