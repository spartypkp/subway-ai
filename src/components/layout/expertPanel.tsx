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
import { ExpertFormValues, ProjectFormValues } from "@/lib/schemas/forms";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, PenSquare, Plus } from "lucide-react";
import { useState } from "react";

interface Expert {
	id: string;
	name: string;
	color: string;
	role: string;
	isActive?: boolean;
	instructions: {
		tech_stack: {
			expertise: string[];
			experience_level?: string;
			preferred_tools?: string[];
		};
		style_guide: {
			code_formatting?: string;
			component_structure?: string;
			naming_conventions?: string;
		};
		general: {
			response_format?: string;
			focus_areas?: string[];
		};
		personality: {
			tone?: string;
			communication_style?: string;
			expertise_level?: string;
		};
	};
}

interface Project {
	name: string;
	description: string;
	instructions: string;
	lastModified: Date;
	expertCount: number;
}

export function ExpertPanel() {
	const [project, setProject] = useState<Project>({
		name: "My Project",
		description: "Project description",
		instructions: "Project instructions",
		lastModified: new Date(),
		expertCount: 3
	});

	const [experts, setExperts] = useState<Expert[]>([
		{
			id: "1",
			name: "Frontend Expert",
			color: "#22c55e",
			role: "UI/UX Specialist",
			instructions: {
				tech_stack: {
					expertise: ["JavaScript", "React"],
					experience_level: "Senior",
					preferred_tools: ["VS Code", "Figma"]
				},
				style_guide: {
					code_formatting: "ES6",
					component_structure: "Component-based",
					naming_conventions: "CamelCase"
				},
				general: {
					response_format: "JSON",
					focus_areas: ["UI/UX", "Performance"]
				},
				personality: {
					tone: "Positive",
					communication_style: "Direct",
					expertise_level: "Expert"
				}
			},
			isActive: true
		},
		{
			id: "2",
			name: "Backend Expert",
			color: "#3b82f6",
			role: "System Architect",
			instructions: {
				tech_stack: {
					expertise: ["Java", "Spring Boot"],
					experience_level: "Senior",
					preferred_tools: ["IntelliJ IDEA", "Postman"]
				},
				style_guide: {
					code_formatting: "Java 11",
					component_structure: "Microservices",
					naming_conventions: "PascalCase"
				},
				general: {
					response_format: "JSON",
					focus_areas: ["Performance", "Security"]
				},
				personality: {
					tone: "Neutral",
					communication_style: "Professional",
					expertise_level: "Expert"
				}
			},
			isActive: true
		}
	]);

	const [currentExpertIndex, setCurrentExpertIndex] = useState(0);
	const currentExpert = experts[currentExpertIndex];

	const canNavigateLeft = currentExpertIndex > 0;
	const canNavigateRight = currentExpertIndex < experts.length - 1;

	const handleExpertNavigation = (direction: 'left' | 'right') => {
		if (direction === 'left' && canNavigateLeft) {
			setCurrentExpertIndex(prev => prev - 1);
		} else if (direction === 'right' && canNavigateRight) {
			setCurrentExpertIndex(prev => prev + 1);
		}
	};

	const handleProjectUpdate = async (data: ProjectFormValues) => {
		// TODO: Add API call to update project
		setProject(prev => ({
			...prev,
			...data,
			lastModified: new Date()
		}));
	};

	const handleExpertUpdate = async (data: ExpertFormValues) => {
		// TODO: Add API call to update expert
		const updatedExperts = experts.map(expert =>
			expert.id === currentExpert.id
				? { ...expert, ...data }
				: expert
		);
		setExperts(updatedExperts);
	};

	return (
		<div className="w-full flex flex-col">
			{/* Project Navigation Section */}
			<div className="p-4 bg-background border-b relative overflow-hidden">
				<div className="absolute inset-0 opacity-5 background-pattern" />
				<div className="flex items-center justify-between relative">
					<div className="space-y-1">
						<h2 className="text-2xl font-semibold">{project.name}</h2>
						<p className="text-sm text-muted-foreground">
							{project.expertCount} Experts · Last modified {project.lastModified.toLocaleDateString()}
						</p>
					</div>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Dialog>
									<DialogTrigger asChild>
										<Button variant="ghost" size="icon" className="hover:scale-105 transition-transform">
											<PenSquare className="h-4 w-4" />
										</Button>
									</DialogTrigger>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>Edit Project</DialogTitle>
										</DialogHeader>
										<ProjectForm
											defaultValues={project}
											onSubmit={handleProjectUpdate}
										/>
									</DialogContent>
								</Dialog>
							</TooltipTrigger>
							<TooltipContent>Edit Project Details</TooltipContent>
						</Tooltip>
					</TooltipProvider>
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
														defaultValues={currentExpert}
														onSubmit={handleExpertUpdate}
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
