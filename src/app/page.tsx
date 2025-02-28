// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ProjectDialog } from "@/components/projectDialog";
import { Minimap } from "@/components/minimap";
// import { MinimapWithContext } from "@/components/minimapWithContext";
import { ChatControls } from "@/components/chat/chatControls";
// import { ChatControlsWithContext } from "@/components/chat/chatControlsWithContext";
// import { MessageList } from "@/components/chat/messageList";
import { ConversationView } from "@/components/chat/conversationView";
// import { MessageListWithContext } from "@/components/chat/messageListWithContext";
import { Button } from "@/components/ui/button";
import { 
	PlusIcon, 
	Menu, 
	Train, 
	GitBranch, 
	Map,
	ChevronDown,
	Trash2,
	ArrowLeftCircle,
	ArrowRightCircle
} from "lucide-react";
import { Project, TimelineNode } from "@/lib/types/database";
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
import { useProject } from "@/lib/contexts/ProjectContext";
import { useConversation } from "@/lib/contexts/ConversationContext";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function Home() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [branchDialogOpen, setBranchDialogOpen] = useState(false);
	const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
	const [branchReason, setBranchReason] = useState('');
	const [creatingBranch, setCreatingBranch] = useState(false);
	const [branchDirection, setBranchDirection] = useState<'left' | 'right' | 'auto'>('auto');
	
	// Get project data from ProjectContext
	const { 
		projects, 
		selectedProject, 
		selectedProjectId, 
		mainBranchId, 
		loading: projectLoading, 
		selectProject, 
		createProject, 
		deleteProject 
	} = useProject();

	// Get conversation data from ConversationContext
	const {
		currentBranchId,
		switchBranch,
		createBranch,
		loading: conversationLoading
	} = useConversation();

	// Combined loading state
	const loading = projectLoading || conversationLoading.data;

	// Debugging: Track component mounting
	useEffect(() => {
		console.log('🔍 DEBUG: Main page component mounted');
		return () => console.log('🔍 DEBUG: Main page component unmounted');
	}, []);

	const handleCreateProject = async (name: string, description: string) => {
		try {
			await createProject(name, description);
			setIsCreateDialogOpen(false);
		} catch (error) {
			console.error("Error creating project:", error);
		}
	};

	const handleDeleteProject = async () => {
		if (!selectedProjectId) return;
		
		try {
			await deleteProject(selectedProjectId);
			setIsDeleteDialogOpen(false);
		} catch (error) {
			console.error("Error deleting project:", error);
		}
	};

	const handleBranchSelect = (branchId: string) => {
		console.log('🔍 DEBUG: Branch selected:', branchId);
		
		// Check if we're switching to a different branch
		if (branchId !== currentBranchId) {
			console.log('🔍 DEBUG: Switching from branch', currentBranchId, 'to branch', branchId);
			
			// Use the context's switchBranch method
			switchBranch(branchId);
			
			// Close the sidebar if it's open
			if (isSidebarOpen) {
				setIsSidebarOpen(false);
			}
		} else {
			console.log('🔍 DEBUG: Already on branch', branchId);
		}
	};
	
	// Handle branch creation from a message
	const handleBranchClick = (messageId: string, direction?: 'left' | 'right' | 'auto') => {
		setSelectedMessageId(messageId);
		// Store the selected direction if provided
		if (direction) {
			setBranchDirection(direction);
		} else {
			setBranchDirection('auto');
		}
		setBranchDialogOpen(true);
	};

	// Create a new branch based on the selected message
	const handleCreateBranch = async () => {
		setCreatingBranch(true);

		try {
			// Use the context's createBranch function
			const newBranchId = await createBranch({
				branchPointNodeId: selectedMessageId as string,
				name: branchReason || undefined,
				createdBy: 'user',
				direction: branchDirection
			});

			// Reset dialog state
			setBranchDialogOpen(false);
			setBranchReason('');

			// Switch to the new branch
			switchBranch(newBranchId);
		} catch (error) {
			console.error('Failed to create branch:', error);
		} finally {
			setCreatingBranch(false);
		}
	};

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
																	selectProject(project.id);
																	switchBranch(null); // Reset to main branch
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
                                                    
                                                        <Minimap 
															onSelectNode={(nodeId) => console.log('Selected node:', nodeId)}
														/>
                                                   
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
											selectProject(project.id);
											switchBranch(null); // Reset to main branch
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
								<Minimap 
									onSelectNode={(nodeId) => console.log('Selected node:', nodeId)}
								/>
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
										onClick={() => switchBranch(null)}
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
										<ConversationView 
											onMessageSelect={(messageId) => console.log('Message selected:', messageId)}
											onBranchClick={handleBranchClick}
										/>
									</div>
									
									{/* Chat Controls */}
									<div className="border-t bg-background/95 backdrop-blur-sm">
										<div className="mx-auto">
											<ChatControls />
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

			{/* Branch creation dialog */}
			<Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Create a new {branchDirection === 'left' ? 'left' : 'right'} branch</DialogTitle>
						<DialogDescription>
							Create a new conversation branch that splits {branchDirection === 'left' ? 'left' : 'right'} from this point. This allows you to explore a different direction without losing the original conversation.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="branch-reason">Branch name (optional)</Label>
							<Input
								id="branch-reason"
								placeholder="e.g., Alternative approach, What-if scenario"
								value={branchReason}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranchReason(e.target.value)}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								A descriptive name will help you remember the purpose of this branch.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
						<Button
							onClick={handleCreateBranch}
							disabled={creatingBranch}
							className="gap-1"
						>
							{creatingBranch ? (
								<>Creating<span className="animate-pulse">...</span></>
							) : (
								<>
									{branchDirection === 'left' ? 
										<ArrowLeftCircle className="h-4 w-4 mr-1" /> : 
										<ArrowRightCircle className="h-4 w-4 mr-1" />
									}
									Create Branch
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}