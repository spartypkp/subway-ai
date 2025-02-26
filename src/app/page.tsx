// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ProjectDialog } from "@/components/projectDialog";
import { Minimap } from "@/components/minimap";
import { ChatControls } from "@/components/chat/chatControls";
import { MessageList } from "@/components/chat/messageList";
import { Button } from "@/components/ui/button";
import { PlusIcon, Menu, Train, MessageSquare, GitBranch } from "lucide-react";
import { Project } from "@/lib/types/database";
import { H1 } from "@/components/ui/typography";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function Home() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [sidebarView, setSidebarView] = useState<"projects" | "map">("projects");

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
			<header className="border-b flex justify-between items-center p-4 shrink-0">
				<div className="flex items-center gap-3">
					<Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
						<SheetTrigger asChild>
							<Button variant="outline" size="icon" className="md:hidden">
								<Menu className="h-4 w-4" />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="flex flex-col w-[280px] sm:w-[380px] p-0">
							<div className="p-4 border-b">
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
								
								<Tabs defaultValue="projects" className="w-full">
									<TabsList className="grid w-full grid-cols-2 mb-4">
										<TabsTrigger value="projects" onClick={() => setSidebarView("projects")}>Projects</TabsTrigger>
										<TabsTrigger value="map" onClick={() => setSidebarView("map")}>Subway Map</TabsTrigger>
									</TabsList>
									
									<TabsContent value="projects" className="mt-0">
										<h3 className="font-medium mb-2">Your Projects</h3>
										{loading ? (
											<div className="space-y-2">
												<Skeleton className="h-10 w-full" />
												<Skeleton className="h-10 w-full" />
											</div>
										) : (
											<ScrollArea className="h-[60vh]">
												<div className="space-y-1">
													{projects.map((project) => (
														<Button
															key={project.id}
															variant={project.id === selectedProjectId ? "secondary" : "ghost"}
															className="w-full justify-start font-normal"
															onClick={() => {
																setSelectedProjectId(project.id);
																setCurrentBranchId(null);
																setIsSidebarOpen(false);
															}}
														>
															{project.title}
														</Button>
													))}
												</div>
											</ScrollArea>
										)}
									</TabsContent>
									
									<TabsContent value="map" className="mt-0">
										{selectedProjectId && (
											<div className="h-[60vh]">
												<Minimap
													projectId={selectedProjectId}
													currentBranchId={currentBranchId}
													onSelectBranch={handleBranchSelect}
												/>
											</div>
										)}
									</TabsContent>
								</Tabs>
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
				<div className="hidden md:flex md:w-[300px] border-r overflow-hidden">
					<Tabs defaultValue="projects" className="flex flex-col w-full">
						<div className="px-4 pt-4 pb-2 border-b">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="projects">Projects</TabsTrigger>
								<TabsTrigger value="map">Subway Map</TabsTrigger>
							</TabsList>
						</div>
						
						<TabsContent value="projects" className="flex-1 overflow-hidden p-4">
							<div className="flex flex-col h-full">
								<div className="mb-4">
									<h3 className="font-medium mb-2">Your Projects</h3>
									{loading ? (
										<div className="space-y-2">
											<Skeleton className="h-10 w-full" />
											<Skeleton className="h-10 w-full" />
										</div>
									) : (
										<ScrollArea className="h-[calc(100vh-270px)]">
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
									)}
									
									<Button
										variant="outline"
										className="w-full mt-4"
										onClick={() => setIsCreateDialogOpen(true)}
									>
										<PlusIcon className="h-4 w-4 mr-2" />
										New Project
									</Button>
								</div>
							</div>
						</TabsContent>
						
						<TabsContent value="map" className="flex-1 overflow-hidden p-4">
							{selectedProjectId ? (
								<Minimap
									projectId={selectedProjectId}
									currentBranchId={currentBranchId}
									onSelectBranch={handleBranchSelect}
								/>
							) : (
								<div className="flex items-center justify-center h-full text-center p-4">
									<div>
										<Train className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-80" />
										<p className="text-muted-foreground text-sm">
											Select a project to view branches
										</p>
									</div>
								</div>
							)}
						</TabsContent>
					</Tabs>
				</div>
				
				{/* Main Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{selectedProject ? (
						<div className="flex flex-col h-full">
							{/* Project Info Card */}
							<Card className="m-4 bg-muted/30 border-muted">
								<CardHeader className="py-3 px-4">
									<div className="flex items-center justify-between">
										<div>
											<CardTitle className="text-lg flex items-center gap-2">
												{selectedProject.title}
												{currentBranchId && (
													<span className="text-xs bg-primary/10 px-2 py-1 rounded-full text-primary font-normal">
														Branch Active
													</span>
												)}
											</CardTitle>
											{selectedProject.description && (
												<CardDescription className="text-sm line-clamp-1">
													{selectedProject.description}
												</CardDescription>
											)}
										</div>
										<div className="flex items-center gap-2">
											<Button 
												variant="ghost" 
												size="sm" 
												onClick={() => setCurrentBranchId(null)}
												className={cn(
													"h-8 text-xs",
													!currentBranchId && "opacity-50 pointer-events-none"
												)}
											>
												<Train className="h-3.5 w-3.5 mr-1.5" />
												Main Line
											</Button>
											<Button
												variant="outline"
												size="sm"
												className="h-8 text-xs"
												onClick={() => {
													document.querySelector("[data-value='map']")?.dispatchEvent(
														new MouseEvent("click", { bubbles: true })
													);
												}}
											>
												<GitBranch className="h-3.5 w-3.5 mr-1.5" />
												View Map
											</Button>
										</div>
									</div>
								</CardHeader>
							</Card>
							
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