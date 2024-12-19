"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectFormValues, projectFormSchema } from "@/lib/schemas/forms";
import { Project } from "@/lib/types/database";
import { zodResolver } from "@hookform/resolvers/zod";
import { PenSquare } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
interface ProjectFormProps {
	projectId: string;
	project: Project;
	setProject: (project: Project) => void;
}

export function ProjectForm({ projectId, project, setProject }: ProjectFormProps) {
	const form = useForm<ProjectFormValues>({
		resolver: zodResolver(projectFormSchema),
		defaultValues: project || {
			name: "",
			description: "",
			context: null,
			settings: null,
			metadata: null
		}
	});
	const handleProjectUpdate = async (data: ProjectFormValues) => {
		console.log(`Handling project update with data:`, JSON.stringify(data, null, 2));
		try {
			const response = await fetch(`/api/projects/${projectId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (!response.ok) throw new Error('Failed to update project');

			const updatedProject = await response.json();
			setProject(updatedProject);
		} catch (error) {
			console.error('Failed to update project:', error);
			// TODO: Add error handling UI
		}
		setOpen(false);
	};
	const [open, setOpen] = useState(false);


	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button variant="ghost" size="icon" className="hover:scale-105 transition-transform">
								<PenSquare className="h-4 w-4" />
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Edit Project</DialogTitle>
							</DialogHeader>
							<Form {...form}>
								<form onSubmit={form.handleSubmit(handleProjectUpdate)} className="space-y-4">
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
														value={field.value || ''}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<Button type="submit">Save Changes</Button>
								</form>
							</Form>

						</DialogContent>
					</Dialog>
				</TooltipTrigger>
				<TooltipContent>Edit Project Details</TooltipContent>
			</Tooltip>
		</TooltipProvider>

	);
} 