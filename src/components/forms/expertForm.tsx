"use client";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExpertFormValues, expertFormSchema } from "@/lib/schemas/forms";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

interface ExpertFormProps {
	defaultValues?: Partial<ExpertFormValues>;
	onSubmit: (data: ExpertFormValues) => void;
}

export function ExpertForm({ defaultValues, onSubmit }: ExpertFormProps) {
	const form = useForm<ExpertFormValues>({
		resolver: zodResolver(expertFormSchema),
		defaultValues: defaultValues || {
			name: "",
			role: "",
			color: "#22c55e",
			instructions: {
				tech_stack: {
					expertise: [],
					experience_level: "",
					preferred_tools: []
				},
				style_guide: {
					code_formatting: "",
					component_structure: "",
					naming_conventions: ""
				},
				general: {
					response_format: "",
					focus_areas: []
				},
				personality: {
					tone: "",
					communication_style: "",
					expertise_level: ""
				}
			}
		}
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Expert Name</FormLabel>
							<FormControl>
								<Input placeholder="Frontend Expert" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="role"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Role</FormLabel>
							<FormControl>
								<Input placeholder="UI/UX Specialist" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="color"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Color</FormLabel>
							<FormControl>
								<Input type="color" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="instructions.tech_stack.expertise"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Technical Expertise</FormLabel>
							<FormControl>
								<Input
									placeholder="React, TypeScript, etc."
									value={field.value.join(", ")}
									onChange={e => field.onChange(e.target.value.split(", "))}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="instructions.general.response_format"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Response Format</FormLabel>
							<FormControl>
								<Textarea
									placeholder="How should the expert format their responses?"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit">Save Expert</Button>
			</form>
		</Form>
	);
} 