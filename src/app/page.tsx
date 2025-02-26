// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ProjectDialog } from "@/components/projectDialog";
import { Minimap } from "@/components/minimap";
import { ChatControls } from "@/components/chat/chatControls";
import { MessageList } from "@/components/chat/messageList";
import { Button } from "@/components/ui/button";
import { PlusIcon, Menu, Train, MessageSquare, GitBranch, Map } from "lucide-react";
import { Project } from "@/lib/types/database";
import { H1 } from "@/components/ui/typography";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TimelineNode } from "@/lib/types/database";

export default function Home() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
	const [mainBranchId, setMainBranchId] = useState<string | null>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	const selectedProject = projects.find(p => p.id === selectedProjectId);

	// Debugging: Track component mounting
	useEffect(() => {
		console.log('🔍 DEBUG: Main page component mounted');
		return () => console.log('🔍 DEBUG: Main page component unmounted');
	}, []);
	
	useEffect(() => {
		const fetchProjects = async () => {
			console.log('🔍 DEBUG: Fetching projects...');
			setLoading(true);
			try {
				const response = await fetch("/api/projects");
				const data = await response.json();
				console.log('🔍 DEBUG: Projects fetched:', data.length, 'projects');
				data.forEach((project: Project, index: number) => {
					console.log(`🔍 DEBUG: Project ${index + 1}:`, project.id, project.title);
				});
				
				setProjects(data);
				
				// If there are projects, select the first one
				if (data.length > 0 && !selectedProjectId) {
					console.log('🔍 DEBUG: Auto-selecting first project:', data[0].id, data[0].name);
					setSelectedProjectId(data[0].id);
				}
			} catch (error) {
				console.error("🔍 DEBUG: Failed to fetch projects:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchProjects();
	}, [selectedProjectId]);

	// Log whenever selectedProjectId changes
	useEffect(() => {
		console.log('🔍 DEBUG: Selected project changed to:', selectedProjectId);
	}, [selectedProjectId]);
	
	// Log whenever currentBranchId changes
	useEffect(() => {
		console.log('🔍 DEBUG: Current branch changed to:', currentBranchId);
	}, [currentBranchId]);

	// Fetch main branch ID when project is selected
	useEffect(() => {
		const fetchMainBranch = async () => {
			if (!selectedProjectId) return;
			
			console.log('🔍 DEBUG: Fetching main branch for project:', selectedProjectId);
			try {
				const response = await fetch(`/api/nodes?project_id=${selectedProjectId}&root=true`);
				const data = await response.json();
				console.log('🔍 DEBUG: Root node response:', data);
				
				// Find the root node
				const rootNode = data.find((node: TimelineNode) => node.type === 'root');
				if (rootNode) {
					console.log('🔍 DEBUG: Found root node:', rootNode.id, 'with branch:', rootNode.branch_id);
					setMainBranchId(rootNode.branch_id);
				} else {
					console.warn('🔍 DEBUG: No root node found in response');
				}
			} catch (error) {
				console.error("🔍 DEBUG: Failed to fetch root node:", error);
			}
		};
		
		fetchMainBranch();
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
		console.log('🔍 DEBUG: Branch selected from minimap:', branchId);
		setCurrentBranchId(branchId);
		setIsSidebarOpen(false);
	};

	return (
		<main className="flex flex-col h-screen max-h-screen bg-background">
			<header className="border-b flex justify-between items-center p-4 shrink-0">
				<div className="flex items-center gap-3">
					<Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
						<SheetTrigger asChild>
							<Button variant="outline" size="icon" className="md:hidden">
								<Menu className="h-4 w-4" />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="flex flex-col w-[280px] sm:w-[380px] p-0">
							<div className="p-4 border-b flex justify-between items-center">
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
							
							<div className="p-4 flex-1 overflow-hidden">
								{selectedProjectId ? (
									<>
										<div className="mb-4">
											<h3 className="font-medium mb-2 flex items-center gap-2">
												<Map className="h-4 w-4" />
												Projects
											</h3>
											{loading ? (
												<div className="space-y-2">
													<Skeleton className="h-10 w-full" />
													<Skeleton className="h-10 w-full" />
												</div>
											) : (
												<ScrollArea className="h-[25vh] pr-4">
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
										
										<div className="border-t pt-4">
											<h3 className="font-medium mb-2 flex items-center gap-2">
												<Train className="h-4 w-4" />
												Subway Map
											</h3>
											<div className="h-[40vh]">
												<Minimap
													projectId={selectedProjectId}
													currentBranchId={currentBranchId}
													onSelectBranch={handleBranchSelect}
												/>
											</div>
										</div>
									</>
								) : (
									<div className="flex items-center justify-center h-full text-center p-4">
										<div>
											<Train className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-80" />
											<p className="text-muted-foreground text-sm">
												Select a project to view branches
											</p>
											<Button 
												variant="outline" 
												className="mt-4"
												onClick={() => setIsCreateDialogOpen(true)}
											>
												<PlusIcon className="h-4 w-4 mr-2" />
												New Project
											</Button>
										</div>
									</div>
								)}
							</div>
						</SheetContent>
					</Sheet>
					
					<div>
						<H1 className="text-xl font-bold md:text-2xl">
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
				{/* Desktop Sidebar */}
				<div className="hidden md:flex md:w-[300px] border-r flex-col overflow-hidden p-4">
					{/* <div className="flex items-center justify-between mb-4">
						<h3 className="font-medium flex items-center gap-2">
							<Map className="h-4 w-4" />
							Projects
						</h3>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsCreateDialogOpen(true)}
						>
							<PlusIcon className="h-4 w-4 mr-1" />
							New
						</Button>
					</div>
					
					{loading ? (
						<div className="space-y-2">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : (
						<ScrollArea className="h-[20vh]">
							<div className="space-y-1 pr-2">
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
					)} */}
					
					<div className="mt-6 border-t pt-4 flex-1 overflow-hidden">
						<h3 className="font-medium mb-3 flex items-center gap-2">
							<Train className="h-4 w-4" /> 
							Subway Map
						</h3>
						{selectedProjectId ? (
							<div className="h-[calc(100%-3rem)]">
								<Minimap
									projectId={selectedProjectId}
									currentBranchId={currentBranchId}
									onSelectBranch={handleBranchSelect}
								/>
							</div>
						) : (
							<div className="flex items-center justify-center h-40 text-center">
								<div>
									<Train className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-80" />
									<p className="text-muted-foreground text-sm">
										Select a project to view the subway map
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
				
				{/* Main Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{selectedProject ? (
						<div className="flex flex-col h-full">
							{/* Project Info Card */}
							{currentBranchId && (
								<Card className="m-4 bg-muted/30 border-muted">
									<CardHeader className="py-3 px-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<GitBranch className="h-4 w-4 text-primary" />
												<span className="text-sm font-medium">
													Branch Active
												</span>
											</div>
											<Button 
												variant="ghost" 
												size="sm" 
												onClick={() => setCurrentBranchId(null)}
												className="h-8 text-xs"
											>
												<Train className="h-3.5 w-3.5 mr-1.5" />
												Return to Main Line
											</Button>
										</div>
									</CardHeader>
								</Card>
							)}
							
							{/* Chat Area - using a flex layout to position message list and controls */}
							<div className="flex-1 overflow-hidden flex flex-col">
								<div className="flex-1 overflow-y-auto pb-2">
									<MessageList 
										projectId={selectedProjectId || ''} 
										branchId={currentBranchId}
										onBranchCreated={(newBranchId: string) => setCurrentBranchId(newBranchId)}
									/>
								</div>
								
								{/* Chat Controls - fixed at bottom */}
								<div className="border-t bg-background/95 backdrop-blur-sm">
									<div className="max-w-3xl mx-auto">
										<ChatControls
											projectId={selectedProjectId || ''}
											branchId={currentBranchId}
											mainBranchId={mainBranchId || ''}
										/>
									</div>
								</div>
							</div>
						</div>
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