// app/page.tsx
"use client";

import { ExpertPanel } from '@/components/layout/expertPanel';
import { ProjectSelector } from '@/components/layout/projectSelector';
import { Project } from '@/lib/types/database';
import { useState } from 'react';

export default function Home() {
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);

	if (!selectedProject) {
		return (
			<div className="container mx-auto py-8">
				<h1 className="text-3xl font-bold mb-8">Select a Project</h1>
				<ProjectSelector onProjectSelect={setSelectedProject} />
			</div>
		);
	}

	return (
		<div>
			<ExpertPanel projectId={selectedProject.id} />
			<div className="flex-1 h-full">
				<div className="flex items-center justify-center h-[80vh]">
					<div className="max-w-4xl w-full p-8">
						<div className="rounded-xl border bg-card text-card-foreground shadow">
							<div className="p-6 flex flex-col items-center gap-4">
								<h2 className="text-2xl font-semibold">Show AI Chat Map View</h2>
								<p className="text-muted-foreground text-center">
									This is where your AI expert chats will be displayed as a downward tree, similar to the look of a subway map. 
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}