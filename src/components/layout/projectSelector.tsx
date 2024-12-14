"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Project } from "@/lib/types/database";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export function ProjectSelector({ onProjectSelect }: { onProjectSelect: (project: Project) => void; }) {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchProjects();
	}, []);

	const fetchProjects = async () => {
		try {
			const response = await fetch('/api/projects');
			const data = await response.json();
			setProjects(data);
		} catch (error) {
			console.error('Failed to fetch projects:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateProject = async () => {
		try {
			const response = await fetch('/api/projects/initialize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: "New Project" })
			});
			const newProject = await response.json();
			setProjects([...projects, newProject]);
			onProjectSelect(newProject);
		} catch (error) {
			console.error('Failed to create project:', error);
		}
	};

	if (loading) {
		return <div>Loading projects...</div>;
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
			{projects.map((project) => (
				<button
					key={project.id}
					onClick={() => onProjectSelect(project)}
					className="p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all"
				>
					<h3 className="text-lg font-semibold">{project.name}</h3>
					<p className="text-sm text-muted-foreground">{project.description}</p>
				</button>
			))}

			<Dialog>
				<DialogTrigger asChild>
					<Button variant="outline" className="h-full min-h-[200px] flex flex-col gap-2">
						<Plus className="h-8 w-8" />
						<span>Create New Project</span>
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Project</DialogTitle>
					</DialogHeader>
					<Button onClick={handleCreateProject}>Create Project</Button>
				</DialogContent>
			</Dialog>
		</div>
	);
} 