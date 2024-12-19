"use client";

import { ExpertForm } from "@/components/forms/expertForm";
import { ProjectForm } from "@/components/forms/projectForm";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Expert, Project } from "@/lib/types/database";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, PenSquare, Plus } from "lucide-react";
import { useEffect, useState } from "react";

interface ExpertPanelProps {
	projectId: string;
}

export function ExpertPanel({ projectId }: ExpertPanelProps) {
	const [project, setProject] = useState<Project | null>(null);
	const [experts, setExperts] = useState<Expert[]>([]);
	const [currentExpertIndex, setCurrentExpertIndex] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchProjectAndExperts();
	}, [projectId]);

	const fetchProjectAndExperts = async () => {
		try {
			// Fetch project details
			const projectResponse = await fetch(`/api/projects/${projectId}`);
			const projectData = await projectResponse.json();
			setProject(projectData);

			// Fetch experts
			const expertsResponse = await fetch(`/api/experts?project_id=${projectId}`);
			const expertsData = await expertsResponse.json();
			setExperts(expertsData);
		} catch (error) {
			console.error('Failed to fetch data:', error);
		} finally {
			setLoading(false);
		}
	};

	const currentExpert = experts[currentExpertIndex];

	const canNavigateLeft = currentExpertIndex > 0;
	const canNavigateRight = currentExpertIndex < experts.length - 1;

	const handleExpertNavigation = (direction: 'left' | 'right') => {
		if (direction === 'left' && canNavigateLeft) {
			setCurrentExpertIndex(prev => prev - 1);
		} else if (direction === 'right' && canNavigateRight) {
			setCurrentExpertIndex(prev => prev + 1);
		} else if (!canNavigateLeft && direction === 'left') {
			handleCreateExpert();
		} else if (!canNavigateRight && direction === 'right') {
			handleCreateExpert();
		}
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
					position: experts.length,
					instructions: {
						tech_stack: { expertise: [] },
						style_guide: {},
						general: {},
						personality: {}
					}
				})
			});

			if (!response.ok) throw new Error('Failed to create expert');

			const newExpert = await response.json();
			setExperts([...experts, newExpert]);
			setCurrentExpertIndex(experts.length);
		} catch (error) {
			console.error('Failed to create expert:', error);
			// TODO: Add error handling UI
		}
	};

	if (loading || !project) {
		return <div>Loading...</div>;
	}

	return (
		<div className="w-full flex flex-col">
			{/* Project Navigation Section */}
			<div className="p-4 bg-background border-b relative overflow-hidden">
				<div className="absolute inset-0 opacity-5 background-pattern" />
				<div className="flex items-center justify-between relative">
					<div className="space-y-1">
						<h2 className="text-2xl font-semibold">{project.name}</h2>
						<p className="text-sm text-muted-foreground">
							{experts.length} Experts · Last modified {new Date(project.updated_at).toLocaleDateString()}
						</p>
					</div>

					<ProjectForm
						projectId={projectId}
						project={project}
						setProject={setProject}
					/>
				</div>
			</div>

			<Separator />

			{/* Expert Panel Section */}
			<div className="p-4 flex items-center justify-center bg-background/50 backdrop-blur-sm">
				<div className="flex items-center gap-2">
					<TooltipProvider delayDuration={200}>
						{/* Left Navigation */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="h-14 w-14 rounded-full transition-all hover:scale-105 hover:border-[#22c55e] hover:text-[#22c55e]"
									onClick={() => handleExpertNavigation('left')}
								>
									{canNavigateLeft ? (
										<ChevronLeft className="h-8 w-8" />
									) : (
										<Plus className="h-8 w-8" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-sm">
								{canNavigateLeft
									? "Switch to Previous Expert"
									: "Create New Expert"}
							</TooltipContent>
						</Tooltip>

						{/* Expert "Subway Sign" */}
						<AnimatePresence mode="wait">
							<motion.div
								key={currentExpert.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								className="relative"
							>
								<div
									className="px-10 py-5 rounded-2xl flex items-center justify-between group transition-all hover:scale-[1.02] w-[600px]"
									style={{
										backgroundColor: `color-mix(in srgb, ${currentExpert.color} 10%, transparent)`,
										border: `2px solid ${currentExpert.color}`,
										boxShadow: `
											0 0 30px ${currentExpert.color}15,
											inset 0 0 20px ${currentExpert.color}05
										`
									}}
								>
									<div className="flex items-center gap-5">
										<div
											className="h-6 w-6 rounded-full"
											style={{
												backgroundColor: currentExpert.color,
												boxShadow: `0 0 10px ${currentExpert.color}`
											}}
										/>
										<div className="flex flex-col">
											<span className="text-3xl font-semibold tracking-tight">
												{currentExpert.name}
											</span>
											<span className="text-sm font-medium text-muted-foreground">
												{currentExpert.role}
											</span>
										</div>
									</div>

									<Tooltip>
										<TooltipTrigger asChild>
											<Dialog>
												<DialogTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="ml-4 h-12 w-12 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
														style={{
															borderColor: currentExpert.color,
															color: currentExpert.color
														}}
													>
														<PenSquare className="h-6 w-6" />
													</Button>
												</DialogTrigger>
												<DialogContent>
													<DialogHeader>
														<DialogTitle>Edit Expert</DialogTitle>
													</DialogHeader>
													<ExpertForm
														projectId={projectId}
														currentExpert={currentExpert}
														experts={experts}
														setExperts={setExperts}
													/>
												</DialogContent>
											</Dialog>
										</TooltipTrigger>
										<TooltipContent>Configure Expert Settings</TooltipContent>
									</Tooltip>
								</div>

								{/* Optional: Add a subtle reflection effect */}
								<div
									className="absolute -bottom-6 left-0 right-0 h-6 blur-sm opacity-30"
									style={{
										background: `linear-gradient(to bottom, ${currentExpert.color}, transparent)`
									}}
								/>
							</motion.div>
						</AnimatePresence>

						{/* Right Navigation */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									className="h-14 w-14 rounded-full transition-all hover:scale-105 hover:border-[#22c55e] hover:text-[#22c55e]"
									onClick={() => handleExpertNavigation('right')}
								>
									{canNavigateRight ? (
										<ChevronRight className="h-8 w-8" />
									) : (
										<Plus className="h-8 w-8" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-sm">
								{canNavigateRight
									? "Switch to Next Expert"
									: "Create New Expert"}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>
		</div>
	);
}
