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
import { ProjectFormValues, projectFormSchema } from "@/lib/schemas/forms";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

interface ProjectFormProps {
	defaultValues?: Partial<ProjectFormValues>;
	onSubmit: (data: ProjectFormValues) => void;
}

export function ProjectForm({ defaultValues, onSubmit }: ProjectFormProps) {
	const form = useForm<ProjectFormValues>({
		resolver: zodResolver(projectFormSchema),
		defaultValues: defaultValues || {
			name: "",
			description: "",
			instructions: "",
			context: {
				tech_stack: {},
				guidelines: {}
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
							<FormLabel>Project Name</FormLabel>
							<FormControl>
								<Input placeholder="My Project" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Describe your project..."
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="instructions"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Project Instructions</FormLabel>
							<FormControl>
								<Textarea
									placeholder="General instructions for all experts..."
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit">Save Changes</Button>
			</form>
		</Form>
	);
} 