"use client";

import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { ConversationNode, UIState, ViewLevel } from '@/lib/types/chat';
import { cn } from '@/lib/utils';
import { Message } from 'ai';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConversationPage() {
	const {
		uiState,
		viewport,
		navigateToProjectView,
		navigateToExpertView,
		navigateToNode,
		navigateBack,
		messages,
		input,
		handleInputChange,
		handleSubmit,
		isLoading,
		getVisibleNodes,
		currentNode
	} = useConversationTimelineContext();

	// This determines what view to render based on our UI state
	return (
		<div className="flex h-screen w-screen overflow-hidden bg-gray-50">
			{/* Navigation Header */}
			<NavigationHeader
				uiState={uiState}
				onBack={navigateBack}
			/>

			{/* Main Content Area */}
			<main className="flex-1 overflow-hidden">
				{uiState.view.level === ViewLevel.PROJECT && (
					<ProjectView onSelectExpert={navigateToExpertView} />
				)}

				{uiState.view.level === ViewLevel.EXPERT && (
					<ExpertTimelineView
						onNodeSelect={navigateToNode}
						visibleNodes={getVisibleNodes()}
						viewport={viewport}
					/>
				)}

				{uiState.view.level === ViewLevel.TIMELINE && (
					<ChatView
						messages={messages}
						input={input}
						onInputChange={handleInputChange}
						onSubmit={handleSubmit}
						isLoading={isLoading}
						currentNode={currentNode}
					/>
				)}
			</main>
		</div>
	);
}

// The navigation header shows breadcrumbs and back button
function NavigationHeader({
	uiState,
	onBack
}: {
	uiState: UIState;
	onBack: () => void;
}) {
	return (
		<header className="absolute top-0 left-0 right-0 h-14 bg-white border-b px-4 flex items-center">
			<button
				onClick={onBack}
				disabled={!uiState.navigation.canGoBack}
				className={cn(
					"p-2 rounded-full hover:bg-gray-100",
					!uiState.navigation.canGoBack && "opacity-50 cursor-not-allowed"
				)}
			>
				<ChevronLeft className="w-5 h-5" />
			</button>

			<div className="ml-4 flex items-center gap-2 text-sm text-gray-600">
				<span>Project</span>
				{uiState.view.expertId && (
					<>
						<ChevronRight className="w-4 h-4" />
						<span>Expert View</span>
					</>
				)}
				{uiState.view.nodeId && (
					<>
						<ChevronRight className="w-4 h-4" />
						<span>Chat</span>
					</>
				)}
			</div>
		</header>
	);
}

function ProjectView({
	onSelectExpert
}: {
	onSelectExpert: (expertId: string) => void;
}) {
	// In a real application, this would likely come from a database or API
	// For now, we'll use sample data to demonstrate the interface
	const availableExperts = [
		{
			id: 'backend-expert',
			name: 'Backend Architecture Expert',
			domain: 'Backend Development',
			description: 'Specializes in server architecture, API design, and database optimization'
		},
		{
			id: 'frontend-expert',
			name: 'Frontend Development Expert',
			domain: 'Frontend Development',
			description: 'Focuses on UI/UX implementation, component architecture, and state management'
		},
		{
			id: 'database-expert',
			name: 'Database Expert',
			domain: 'Database Systems',
			description: 'Expert in database design, optimization, and data modeling'
		}
	];

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<h1 className="text-2xl font-bold text-gray-900">Project Experts</h1>
				<p className="text-gray-600 mt-2">
					Select an expert to begin a conversation or continue an existing discussion.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{availableExperts.map((expert) => (
					<button
						key={expert.id}
						onClick={() => onSelectExpert(expert.id)}
						className="block p-6 bg-white rounded-lg border hover:border-blue-500 hover:shadow-lg transition-all"
					>
						<div className="flex flex-col h-full">
							<h2 className="text-xl font-semibold text-gray-900">{expert.name}</h2>
							<p className="text-sm text-blue-600 mt-1">{expert.domain}</p>
							<p className="text-gray-600 mt-4 flex-grow">{expert.description}</p>
							<div className="mt-4 text-sm text-gray-500">
								Click to view conversations
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}

// The subway map visualization for an expert's timeline
function ExpertTimelineView({
	onNodeSelect,
	visibleNodes,
	viewport
}: {
	onNodeSelect: (nodeId: string) => void;
	visibleNodes: ConversationNode[];
	viewport: {
		setZoom: (zoom: number) => void;
		pan: (dx: number, dy: number) => void;
	};
}) {
	// Implementation for the subway map visualization
	return (
		<div
			className="h-full w-full relative"
		// Add pan and zoom handlers here
		>
			<svg className="w-full h-full">
				{/* We'll implement the subway map visualization here */}
				{/* This will need careful implementation of the paths and nodes */}
			</svg>
		</div>
	);
}

// The actual chat interface when viewing a timeline
function ChatView({
	messages,
	input,
	onInputChange,
	onSubmit,
	isLoading,
	currentNode
}: {
	messages: Message[];
	input: string;
	onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	isLoading: boolean;
	currentNode: ConversationNode | null;
}) {
	return (
		<div className="flex flex-col h-full">
			{/* Messages Area */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"p-4 rounded-lg max-w-3xl mx-auto",
							message.role === "user"
								? "bg-blue-50 ml-auto"
								: "bg-gray-50 mr-auto"
						)}
					>
						{message.content}
					</div>
				))}
				{isLoading && (
					<div className="p-4 bg-gray-50 rounded-lg animate-pulse">
						Thinking...
					</div>
				)}
			</div>

			{/* Input Area */}
			<form
				onSubmit={onSubmit}
				className="border-t p-4 bg-white"
			>
				<textarea
					value={input}
					onChange={onInputChange}
					placeholder="Type your message..."
					className="w-full p-2 border rounded-lg resize-none"
					rows={3}
				/>
				<button
					type="submit"
					disabled={isLoading}
					className={cn(
						"mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg",
						isLoading && "opacity-50 cursor-not-allowed"
					)}
				>
					Send
				</button>
			</form>
		</div>
	);
}