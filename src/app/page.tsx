// app/page.tsx
"use client";

import { ExpertPanel } from '@/components/layout/expertPanel';
import { NodeNetwork } from '@/components/nodeNetwork';
import { ProjectSelector } from '@/components/layout/projectSelector';
import { Expert, Project } from '@/lib/types/database';
import { useState } from 'react';

export default function Home() {
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);
	const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);

	if (!selectedProject) {
		return (
			<div className="container mx-auto py-8">
				<h1 className="text-3xl font-bold mb-8">Select a Project</h1>
				<ProjectSelector onProjectSelect={setSelectedProject} />
			</div>
		);
	}

	const handleExpertSelect = (expert: Expert | null) => {
		console.log('Expert selected:', expert);
		setSelectedExpert(expert);
	};

	return (
		<div className="flex flex-col h-screen">
			<ExpertPanel 
				projectId={selectedProject.id} 
				onExpertSelect={handleExpertSelect}
			/>
			<div className="flex-1">
				{selectedExpert ? (
					<NodeNetwork 
						expertId={selectedExpert?.id} 
						projectId={selectedProject.id} 
						expertColor={selectedExpert?.color}
					/>
				) : (
					<div className="flex items-center justify-center h-full">
						<p className="text-muted-foreground">
							Select an expert to view their conversation network
						</p>
					</div>
				)}
			</div>
		</div>
	);
}