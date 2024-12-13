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
export interface Project extends Timestamps {
	id: UUID;
	name: string;
	description: string | null;
	settings: ProjectSettings;
	context: ProjectContext;
	metadata: Record<string, any>;
}

// Main Expert type
export interface Expert extends Timestamps {
	id: UUID;
	project_id: UUID;
	name: string;
	role: string;
	color: string;
	position: number;
	active: boolean;
	instructions: ExpertInstructions;
	settings: ExpertSettings;
	metadata: Record<string, any>;
}

// Helper type for creating new projects
export type CreateProject = Omit<Project, 'id' | 'created_at' | 'updated_at'>;

// Helper type for creating new experts
export type CreateExpert = Omit<Expert, 'id' | 'created_at' | 'updated_at'>;

// Helper type for updating projects
export type UpdateProject = Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>;

// Helper type for updating experts
export type UpdateExpert = Partial<Omit<Expert, 'id' | 'created_at' | 'updated_at'>>; 