import { z } from "zod";

export const projectFormSchema = z.object({
	name: z.string().min(1, "Project name is required"),
	description: z.string().optional(),
	instructions: z.string().optional(),
	context: z.object({
		tech_stack: z.object({
			frontend: z.array(z.string()).optional(),
			backend: z.array(z.string()).optional(),
			deployment: z.array(z.string()).optional()
		}).optional(),
		guidelines: z.object({
			code_style: z.string().optional(),
			architecture: z.string().optional()
		}).optional()
	}).optional()
});

export const expertFormSchema = z.object({
	name: z.string().min(1, "Expert name is required"),
	role: z.string().min(1, "Role is required"),
	color: z.string().min(1, "Color is required"),
	instructions: z.object({
		tech_stack: z.object({
			expertise: z.array(z.string()),
			experience_level: z.string().optional(),
			preferred_tools: z.array(z.string()).optional()
		}),
		style_guide: z.object({
			code_formatting: z.string().optional(),
			component_structure: z.string().optional(),
			naming_conventions: z.string().optional()
		}),
		general: z.object({
			response_format: z.string().optional(),
			focus_areas: z.array(z.string()).optional()
		}),
		personality: z.object({
			tone: z.string().optional(),
			communication_style: z.string().optional(),
			expertise_level: z.string().optional()
		})
	})
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
export type ExpertFormValues = z.infer<typeof expertFormSchema>; 