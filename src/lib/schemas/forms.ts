import { z } from "zod";

export const projectFormSchema = z.object({
	name: z.string().min(1, "Project name is required"),
	description: z.string().nullable(),
	context: z.record(z.any()).nullable(),
	settings: z.record(z.any()).nullable(),
	metadata: z.record(z.any()).nullable()
});

export const expertFormSchema = z.object({
	name: z.string().min(1, "Expert name is required"),
	role: z.string().min(1, "Role is required"),
	color: z.string().min(1, "Color is required"),
	position: z.number(),
	active: z.boolean(),
	instructions: z.record(z.any()).nullable(),
	settings: z.record(z.any()).nullable(),
	metadata: z.record(z.any()).nullable()
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
export type ExpertFormValues = z.infer<typeof expertFormSchema>; 