"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ExpertCard } from "@/components/expert/expertCard";
import { Expert, Project } from "@/lib/types/database";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

interface ExpertPanelProps {
	projectId: string;
	onExpertSelect: (expert: Expert | null) => void;
}

export function ExpertPanel({ projectId, onExpertSelect }: ExpertPanelProps) {
	const [project, setProject] = useState<Project | null>(null);
	const [experts, setExperts] = useState<Expert[]>([]);
	const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchProjectAndExperts();
	}, [projectId]);

	const fetchProjectAndExperts = async () => {
		try {
			const [projectRes, expertsRes] = await Promise.all([
				fetch(`/api/projects/${projectId}`),
				fetch(`/api/experts?project_id=${projectId}`)
			]);
			
			const [projectData, expertsData] = await Promise.all([
				projectRes.json(),
				expertsRes.json()
			]);

			setProject(projectData);
			setExperts(expertsData);
		} catch (error) {
			console.error('Failed to fetch data:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleExpertSelect = (expert: Expert) => {
		setSelectedExpert(expert);
		onExpertSelect(expert);
	};

	const handleExpertUpdate = (updatedExpert: Expert) => {
		setExperts(experts.map(e => 
			e.id === updatedExpert.id ? updatedExpert : e
		));
	};

	const handleCreateExpert = async () => {
		try {
			const response = await fetch('/api/experts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					project_id: projectId,
					name: "New Expert",
					role: "Specialist",
					color: "#22c55e",
					position: experts.length
				})
			});

			if (!response.ok) throw new Error('Failed to create expert');

			const newExpert = await response.json();
			setExperts([...experts, newExpert]);
		} catch (error) {
			console.error('Failed to create expert:', error);
		}
	};

	const handleExpertDelete = async (expertToDelete: Expert) => {
		try {
			const response = await fetch(`/api/experts/${expertToDelete.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete expert');

			setExperts(experts.filter(e => e.id !== expertToDelete.id));
			if (selectedExpert?.id === expertToDelete.id) {
				setSelectedExpert(null);
				onExpertSelect(null); // or handle this case appropriately
			}
		} catch (error) {
			console.error('Failed to delete expert:', error);
		}
	};

	if (loading || !project) {
		return <div>Loading...</div>;
	}

	return (
		<div className="p-6 border-b bg-background">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h2 className="text-2xl font-semibold">{project.name}</h2>
					<p className="text-sm text-muted-foreground">
						{experts.length} Experts · Last modified {new Date(project.updated_at).toLocaleDateString()}
					</p>
				</div>
				<Button onClick={handleCreateExpert} className="gap-2">
					<Plus className="h-4 w-4" />
					Add Expert
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{experts.map(expert => (
					<ExpertCard
						key={expert.id}
						expert={expert}
						isSelected={expert.id === selectedExpert?.id}
						onSelect={handleExpertSelect}
						onUpdate={handleExpertUpdate}
						onDelete={handleExpertDelete}
					/>
				))}
			</div>
		</div>
	);
}
