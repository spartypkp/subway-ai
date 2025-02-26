// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ProjectDialog } from "@/components/projectDialog";
import { Minimap } from "@/components/minimap";
import { ChatControls } from "@/components/chat/chatControls";
import { MessageList } from "@/components/chat/messageList";
import { Button } from "@/components/ui/button";
import { PlusIcon, Menu, Train } from "lucide-react";
import { Project } from "@/lib/types/database";
import { H1 } from "@/components/ui/typography";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	const selectedProject = projects.find(p => p.id === selectedProjectId);

	useEffect(() => {
		const fetchProjects = async () => {
			setLoading(true);
			try {
				const response = await fetch("/api/projects");
				const data = await response.json();
				setProjects(data);
				
				// If there are projects, select the first one
				if (data.length > 0 && !selectedProjectId) {
					setSelectedProjectId(data[0].id);
				}
			} catch (error) {
				console.error("Failed to fetch projects:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchProjects();
	}, [selectedProjectId]);

	const handleCreateProject = async (title: string, description: string) => {
		try {
			const response = await fetch("/api/projects", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ title, description }),
			});

			if (!response.ok) throw new Error("Failed to create project");

			const newProject = await response.json();
			setProjects([...projects, newProject]);
			setSelectedProjectId(newProject.id);
			setIsCreateDialogOpen(false);
		} catch (error) {
			console.error("Error creating project:", error);
		}
	};

	const handleBranchSelect = (branchId: string) => {
		setCurrentBranchId(branchId);
		setIsSidebarOpen(false);
	};

	return (
		<main className="flex flex-col h-screen max-h-screen bg-background">
			<header className="border-b flex justify-between items-center p-4">
				<div className="flex items-center gap-3">
					<Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
						<SheetTrigger asChild>
							<Button variant="outline" size="icon" className="md:hidden">
								<Menu className="h-4 w-4" />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="w-[280px] sm:w-[380px]">
							<div className="py-4">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-semibold flex items-center gap-2">
										<Train className="h-5 w-5" />
										Subway AI
									</h2>
									<Button 
										size="sm" 
										onClick={() => setIsCreateDialogOpen(true)}
									>
										<PlusIcon className="h-4 w-4 mr-2" />
										New Project
									</Button>
								</div>
								
								<div className="space-y-4">
									<div>
										<h3 className="font-medium mb-2">Your Projects</h3>
										{loading ? (
											<div className="space-y-2">
												<Skeleton className="h-10 w-full" />
												<Skeleton className="h-10 w-full" />
											</div>
										) : (
											<ScrollArea className="h-[300px]">
												<div className="space-y-1">
													{projects.map((project) => (
														<Button
															key={project.id}
															variant={project.id === selectedProjectId ? "secondary" : "ghost"}
															className="w-full justify-start font-normal"
															onClick={() => {
																setSelectedProjectId(project.id);
																setCurrentBranchId(null);
															}}
														>
															{project.title}
														</Button>
													))}
												</div>
											</ScrollArea>
										)}
									</div>
									
									{selectedProjectId && (
										<div className="h-[calc(100vh-420px)]">
											<Minimap
												projectId={selectedProjectId}
												currentBranchId={currentBranchId}
												onSelectBranch={handleBranchSelect}
											/>
										</div>
									)}
								</div>
							</div>
						</SheetContent>
					</Sheet>
					
					<div>
						<H1 className="text-2xl font-bold">
							{selectedProject ? (
								selectedProject.title
							) : loading ? (
								<Skeleton className="h-8 w-[200px]" />
							) : (
								"Subway AI"
							)}
						</H1>
					</div>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => setIsCreateDialogOpen(true)}
					>
						<PlusIcon className="h-4 w-4 mr-2" />
						New Project
					</Button>
				</div>
			</header>
			
			<div className="flex flex-1 overflow-hidden">
				<div className="hidden md:block w-[300px] border-r p-4 overflow-y-auto">
					<div className="flex flex-col h-full">
						<div className="mb-6">
							<h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
								<Train className="h-5 w-5" />
								Subway AI
							</h2>
							
							<h3 className="font-medium mb-2">Your Projects</h3>
							{loading ? (
								<div className="space-y-2">
									<Skeleton className="h-10 w-full" />
									<Skeleton className="h-10 w-full" />
								</div>
							) : (
								<ScrollArea className="h-[200px]">
									<div className="space-y-1">
										{projects.map((project) => (
											<Button
												key={project.id}
												variant={project.id === selectedProjectId ? "secondary" : "ghost"}
												className="w-full justify-start font-normal"
												onClick={() => {
													setSelectedProjectId(project.id);
													setCurrentBranchId(null);
												}}
											>
												{project.title}
											</Button>
										))}
									</div>
								</ScrollArea>
							)}
							
							<Button
								variant="outline"
								className="w-full mt-2"
								onClick={() => setIsCreateDialogOpen(true)}
							>
								<PlusIcon className="h-4 w-4 mr-2" />
								New Project
							</Button>
						</div>
						
						{selectedProjectId && (
							<div className="flex-1">
								<Minimap
									projectId={selectedProjectId}
									currentBranchId={currentBranchId}
									onSelectBranch={handleBranchSelect}
								/>
							</div>
						)}
					</div>
				</div>
				
				<div className="flex-1 flex flex-col">
					{selectedProject ? (
						<>
							<Card className="m-4 bg-muted/50">
								<CardHeader className="pb-2">
									<CardTitle className="text-xl flex items-center gap-2">
										{selectedProject.title}
									</CardTitle>
									{selectedProject.description && (
										<CardDescription>
											{selectedProject.description}
										</CardDescription>
									)}
								</CardHeader>
							</Card>
							<div className="flex-1 overflow-hidden relative">
								<MessageList 
									projectId={selectedProjectId || ''} 
									branchId={currentBranchId}
									onBranchCreated={(newBranchId: string) => setCurrentBranchId(newBranchId)}
								/>
								<div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent pt-8">
									<ChatControls
										projectId={selectedProjectId || ''}
										branchId={currentBranchId}
									/>
								</div>
							</div>
						</>
					) : (
						<div className="flex items-center justify-center h-full">
							<div className="text-center max-w-md mx-auto p-6">
								<Train className="h-12 w-12 mx-auto mb-4 text-primary" />
								<h2 className="text-2xl font-bold mb-2">Welcome to Subway AI</h2>
								<p className="text-muted-foreground mb-6">
									Create a new project to start visualizing your conversations as subway lines.
								</p>
								<Button onClick={() => setIsCreateDialogOpen(true)}>
									<PlusIcon className="h-4 w-4 mr-2" />
									Create your first project
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
			
			<ProjectDialog
				isOpen={isCreateDialogOpen}
				onClose={() => setIsCreateDialogOpen(false)}
				onCreate={handleCreateProject}
			/>
		</main>
	);
}