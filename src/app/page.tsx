// app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { ProjectDialog } from "@/components/projectDialog";
import { Minimap } from "@/components/minimap";
import { ChatControls } from "@/components/chat/chatControls";
import { MessageList, MessageListRef } from "@/components/chat/messageList";
import { Button } from "@/components/ui/button";
import { 
	PlusIcon, 
	Menu, 
	Train, 
	GitBranch, 
	Map,
	ChevronDown,
	Trash2
} from "lucide-react";
import { Project } from "@/lib/types/database";
import { H1 } from "@/components/ui/typography";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { TimelineNode } from "@/lib/types/database";
import { ReactFlowProvider } from "reactflow";

export default function Home() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
	const [mainBranchId, setMainBranchId] = useState<string | null>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [streamingContent, setStreamingContent] = useState<string | null>(null);

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
				
				// Map any title property to name for backward compatibility
				const processedData = data.map((project: any) => ({
					...project,
					name: project.name || project.title || 'Unnamed Project'
				}));
				
				setProjects(processedData);
				
				// If there are projects, select the first one
				if (processedData.length > 0 && !selectedProjectId) {
					console.log('🔍 DEBUG: Auto-selecting first project:', processedData[0].id, processedData[0].name);
					setSelectedProjectId(processedData[0].id);
				}
			} catch (error) {
				console.error("🔍 DEBUG: Failed to fetch projects:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchProjects();
	}, [selectedProjectId]);

	// Fetch main branch ID when project is selected
	useEffect(() => {
		const fetchMainBranch = async () => {
			if (!selectedProjectId) return;
			
			console.log('🔍 DEBUG: Fetching main branch for project:', selectedProjectId);
			try {
				const response = await fetch(`/api/nodes?project_id=${selectedProjectId}&root=true`);
				const data = await response.json();
				
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

	const handleCreateProject = async (name: string, description: string) => {
		try {
			const response = await fetch("/api/projects", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name, description }),
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

	const handleDeleteProject = async () => {
		if (!selectedProjectId) return;
		
		try {
			const response = await fetch(`/api/projects/${selectedProjectId}`, {
				method: "DELETE",
			});

			if (!response.ok) throw new Error("Failed to delete project");

			// Remove the deleted project from the projects array
			const updatedProjects = projects.filter(p => p.id !== selectedProjectId);
			setProjects(updatedProjects);
			
			// Select another project if available, otherwise set to null
			if (updatedProjects.length > 0) {
				setSelectedProjectId(updatedProjects[0].id);
			} else {
				setSelectedProjectId(null);
			}
			
			// Reset branch state
			setCurrentBranchId(null);
			setMainBranchId(null);
			
			// Close the delete dialog
			setIsDeleteDialogOpen(false);
			
			console.log('🔍 DEBUG: Project deleted successfully');
		} catch (error) {
			console.error("Error deleting project:", error);
		}
	};

	const handleBranchSelect = (branchId: string) => {
		console.log('🔍 DEBUG: Branch selected:', branchId);
		
		// Check if we're switching to a different branch
		if (branchId !== currentBranchId) {
			console.log('🔍 DEBUG: Switching from branch', currentBranchId, 'to branch', branchId);
			
			// Update the current branch ID
			setCurrentBranchId(branchId);
			
			// Close the sidebar if it's open
			if (isSidebarOpen) {
				setIsSidebarOpen(false);
			}
		} else {
			console.log('🔍 DEBUG: Already on branch', branchId);
		}
	};

	// Safety check to ensure we always have a valid string for projectId
	const safeProjectId = selectedProjectId || '';

	// Add function to handle optimistic message updates
	const handleOptimisticUpdate = (newMessages: TimelineNode[]) => {
		// Process all messages, not just AI messages
		// This ensures both user and assistant messages are properly handled
		
		// First, pass all messages to the MessageList component
		if (messageListRef.current && messageListRef.current.handleOptimisticUpdate) {
			messageListRef.current.handleOptimisticUpdate(newMessages);
		}
		
		// Then, handle streaming content for AI messages
		const aiMessage = newMessages.find(msg => msg.type === 'assistant-message');
		if (aiMessage) {
			// For real streaming implementation, we don't need to simulate word-by-word display
			// The streaming will be handled by the backend and the UI will update as chunks arrive
			setStreamingContent(aiMessage.message_text || '');
		}
	};

	// Reference to the MessageList component to access its handleOptimisticUpdate method
	const messageListRef = useRef<MessageListRef>(null);

	return (
		<main className="flex flex-col h-screen max-h-screen bg-background">
			{/* Header with controls */}
			<header className="border-b flex justify-between items-center p-3 shrink-0">
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
																{project.name}
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
											<div className="h-[40vh] border rounded-md overflow-hidden">
												{loading ? (
													<div className="h-full w-full flex items-center justify-center bg-muted/10">
														<div className="animate-pulse flex flex-col items-center gap-2">
															<Train className="h-5 w-5 text-muted-foreground" />
															<div className="h-2 w-24 bg-muted rounded-full"></div>
														</div>
													</div>
												) : (
													<ReactFlowProvider key={`flow-mobile-${safeProjectId}`}>
														<Minimap
															projectId={safeProjectId}
															currentBranchId={currentBranchId}
															onSelectBranch={handleBranchSelect}
														/>
													</ReactFlowProvider>
												)}
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
					
					<div className="flex items-center">
						<H1 className="text-xl font-bold md:text-2xl flex items-center gap-2">
							<Train className="h-5 w-5 text-primary hidden sm:inline-block" />
							{selectedProject ? (
								selectedProject.name
							) : loading ? (
								<Skeleton className="h-8 w-[200px]" />
							) : (
								"Subway AI"
							)}
						</H1>
					</div>
				</div>

				<div className="flex gap-2 items-center">
					{/* Project selector dropdown */}
					{projects.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm" className="flex items-center gap-1">
									<Map className="h-4 w-4 mr-1" />
									{selectedProject ? (
										<span className="max-w-[150px] truncate">{selectedProject.name}</span>
									) : (
										"Select Project"
									)}
									<ChevronDown className="h-4 w-4 ml-1" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{projects.map(project => (
									<DropdownMenuItem 
										key={project.id}
										onClick={() => {
											setSelectedProjectId(project.id);
											setCurrentBranchId(null);
										}}
										className={cn(
											"flex items-center gap-2",
											project.id === selectedProjectId ? "bg-muted" : ""
										)}
									>
										{project.id === selectedProjectId && (
											<div className="h-2 w-2 rounded-full bg-primary" />
										)}
										<span className="max-w-[200px] truncate">{project.name}</span>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsCreateDialogOpen(true)}
							className="flex items-center"
						>
							<PlusIcon className="h-4 w-4 mr-2" />
							New Project
						</Button>
						
						{selectedProjectId && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsDeleteDialogOpen(true)}
								className="text-destructive hover:bg-destructive/10 border-destructive/20"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</header>
			
			<div className="flex flex-1 overflow-hidden">
				{/* Main Content Area */}
				{selectedProject ? (
					<div className="w-full flex flex-col md:flex-row h-full">
						{/* Subway Map Section */}
						<div className="h-[250px] md:h-auto md:w-3/5 border-b md:border-b-0 md:border-r">
							{loading ? (
								<div className="h-full w-full flex items-center justify-center">
									<div className="animate-pulse flex flex-col items-center gap-3">
										<Train className="h-8 w-8 text-primary/30" />
										<div className="h-2 w-32 bg-muted rounded-full"></div>
										<div className="h-2 w-40 bg-muted rounded-full mt-2"></div>
									</div>
								</div>
							) : (
								<ReactFlowProvider key={`flow-${safeProjectId}`}>
									<Minimap
										projectId={safeProjectId}
										currentBranchId={currentBranchId}
										onSelectBranch={handleBranchSelect}
									/>
								</ReactFlowProvider>
							)}
						</div>
						
						{/* Chat Section */}
						<div className="flex-1 flex flex-col w-full md:w-2/5 overflow-hidden">
							{/* Branch Info */}
							{currentBranchId && (
								<div className="px-4 pt-3 pb-2 flex items-center justify-between border-b">
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
										className="h-7 text-xs"
									>
										<Train className="h-3.5 w-3.5 mr-1.5" />
										Return to Main Line
									</Button>
								</div>
							)}
							
							{/* Chat Area */}
							<div className="flex-1 overflow-hidden flex flex-col">
								<div className="flex-1 overflow-y-auto pb-2">
									<MessageList 
										ref={messageListRef}
										projectId={safeProjectId} 
										branchId={currentBranchId}
										onBranchCreated={(newBranchId: string) => setCurrentBranchId(newBranchId)}
										onBranchSwitch={handleBranchSelect}
										streamingContent={streamingContent}
										onOptimisticUpdate={handleOptimisticUpdate}
									/>
								</div>
								
								{/* Chat Controls */}
								<div className="border-t bg-background/95 backdrop-blur-sm">
									<div className="mx-auto">
										<ChatControls
											projectId={safeProjectId}
											branchId={currentBranchId}
											mainBranchId={mainBranchId || ''}
											onOptimisticUpdate={handleOptimisticUpdate}
											onMessageSubmit={() => setStreamingContent(null)} // Reset streaming content when submitting a new message
										/>
									</div>
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
			
			<ProjectDialog
				isOpen={isCreateDialogOpen}
				onClose={() => setIsCreateDialogOpen(false)}
				onCreate={handleCreateProject}
			/>
			
			{/* Delete Project Confirmation Dialog */}
			<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Project</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone.
							All conversations and branches in this project will be permanently deleted.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction 
							onClick={handleDeleteProject}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}