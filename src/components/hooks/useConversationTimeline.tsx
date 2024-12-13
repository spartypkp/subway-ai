"use client";

import { ConversationNode, Expert, NavigationHistoryEntry, UIState, ViewLevel } from '@/lib/types/chat';
import { buildTimelineMessages, generateNodeId, generateSummary, getPathToNode, isNodeVisible } from '@/lib/utils';
import { Message } from 'ai';
import { useChat } from 'ai/react';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

// First, we'll define the type for our context value based on what useConversationTimeline returns
export interface ConversationTimelineContextValue {
	// State
	uiState: UIState;
	activeNodeId: string;
	activePath: string[];
	currentNode: ConversationNode | null;

	// Navigation
	navigateToProjectView: () => void;
	navigateToExpertView: (expertId: string) => void;
	navigateToNode: (nodeId: string) => void;
	navigateBack: () => void;

	// Viewport controls
	viewport: {
		setZoom: (zoom: number) => void;
		pan: (dx: number, dy: number) => void;
	};

	// Chat functionality from Vercel AI SDK
	messages: Message[];
	input: string;
	handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
	handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	isLoading: boolean;

	// Node management
	createBranch: (parentNodeId: string) => Promise<string>;
	getNode: (nodeId: string) => ConversationNode | null;
	getAllNodes: () => ConversationNode[];
	getVisibleNodes: () => ConversationNode[];
	isNodeInMainTimeline: (nodeId: string) => boolean;
}

// Create the context with a meaningful default value of null
const ConversationTimelineContext = createContext<ConversationTimelineContextValue | null>(null);

export interface ConversationTimelineProviderProps {
	children: ReactNode;
	expert: Expert;
	initialNodeId?: string;
}

export function ConversationTimelineProvider({
	children,
	expert,
	initialNodeId
}: ConversationTimelineProviderProps) {
	// Use our hook to get all the functionality and state
	const timelineState = useConversationTimeline({
		expert,
		initialNodeId
	});

	// Provide all the state and functions to children
	return (
		<ConversationTimelineContext.Provider value={timelineState}>
			{children}
		</ConversationTimelineContext.Provider>
	);
}

export function useConversationTimeline({
	expert,
	initialNodeId = expert.rootNodeId
}: {
	expert: Expert;
	initialNodeId?: string;
}) {
	// Initialize our core state - UI state management and conversation nodes
	const [uiState, setUIState] = useState<UIState>({
		view: {
			level: ViewLevel.PROJECT,
			expertId: null,
			nodeId: null
		},
		viewport: {
			position: { x: 0, y: 0 },
			zoom: 1
		},
		navigation: {
			history: [],
			canGoBack: false,
			canGoForward: false
		}
	});

	// Maintain our conversation tree structure
	const [nodes, setNodes] = useState<Map<string, ConversationNode>>(new Map());

	// Track the currently active node for chat interactions
	const [activeNodeId, setActiveNodeId] = useState<string>(initialNodeId);

	// Initialize the Vercel AI SDK chat integration
	const chat = useChat({
		id: `${expert.id}-${activeNodeId}`,
		initialMessages: buildTimelineMessages(expert, activeNodeId, nodes)
	});

	// Navigation System
	const navigate = useCallback((newView: Partial<UIState['view']>) => {
		setUIState(prev => {
			// Create a proper NavigationHistoryEntry from the current view
			const historyEntry: NavigationHistoryEntry = {
				view: { ...prev.view }
			};

			return {
				...prev,
				navigation: {
					...prev.navigation,
					history: [...prev.navigation.history, historyEntry],
					canGoBack: true,
					canGoForward: false
				},
				view: {
					...prev.view,
					...newView
				},
				viewport: {
					position: { x: 0, y: 0 },
					zoom: 1
				}
			};
		});
	}, []);

	// Navigation helper functions
	const navigateToProjectView = useCallback(() => {
		navigate({
			level: ViewLevel.PROJECT,
			expertId: null,
			nodeId: null
		});
	}, [navigate]);

	const navigateToExpertView = useCallback((expertId: string) => {
		navigate({
			level: ViewLevel.EXPERT,
			expertId,
			nodeId: null
		});
	}, [navigate]);

	const navigateToNode = useCallback((nodeId: string) => {
		setActiveNodeId(nodeId); // Update active node for chat
		navigate({
			level: ViewLevel.TIMELINE,
			expertId: expert.id,
			nodeId
		});
	}, [navigate, expert.id]);

	// Navigation history management
	const navigateBack = useCallback(() => {
		if (!uiState.navigation.canGoBack || uiState.navigation.history.length === 0) return;

		const previousEntry = uiState.navigation.history[uiState.navigation.history.length - 1];
		setUIState(prev => ({
			...prev,
			view: previousEntry.view,  // Now correctly accessing the view property
			navigation: {
				...prev.navigation,
				history: prev.navigation.history.slice(0, -1),
				canGoBack: prev.navigation.history.length > 1,
				canGoForward: true
			}
		}));
	}, [uiState.navigation]);

	// Viewport Controls
	const viewport = useMemo(() => ({
		setZoom: (zoom: number) => {
			setUIState(prev => ({
				...prev,
				viewport: { ...prev.viewport, zoom }
			}));
		},
		pan: (dx: number, dy: number) => {
			setUIState(prev => ({
				...prev,
				viewport: {
					...prev.viewport,
					position: {
						x: prev.viewport.position.x + dx,
						y: prev.viewport.position.y + dy
					}
				}
			}));
		}
	}), []);

	// Node Management
	const getNode = useCallback((nodeId: string): ConversationNode | null => {
		return nodes.get(nodeId) || null;
	}, [nodes]);

	// Handle new chat messages and update the conversation tree
	const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
		try {
			e.preventDefault();
			await chat.handleSubmit(e);

			// Ensure we have the messages we need
			const lastUserMessage = chat.messages[chat.messages.length - 2];
			const lastAssistantMessage = chat.messages[chat.messages.length - 1];

			if (!lastUserMessage || !lastAssistantMessage) {
				throw new Error('Invalid chat messages');
			}

			const currentNode = getNode(activeNodeId);

			const newNode: ConversationNode = {
				id: generateNodeId(),
				parentId: activeNodeId,
				expertId: expert.id,
				summary: generateSummary(lastUserMessage, lastAssistantMessage),
				timestamp: new Date(),
				userMessage: lastUserMessage,
				assistantResponse: lastAssistantMessage,
				branchNodeIds: [],
				childNodeId: null,
				metadata: {
					isMainTimeline: currentNode?.metadata?.isMainTimeline ?? true,
					depth: (currentNode?.metadata?.depth || 0) + 1
				}
			};

			setNodes(prev => {
				const next = new Map(prev);
				const parentNode = next.get(activeNodeId);
				if (parentNode) {
					parentNode.childNodeId = newNode.id;
				}
				next.set(newNode.id, newNode);
				return next;
			});

			setActiveNodeId(newNode.id);
			navigateToNode(newNode.id);
		} catch (error) {
			console.error('Error in handleSubmit:', error);
			// Handle error appropriately - could add error state management
		}
	}, [activeNodeId, expert.id, chat, getNode, navigateToNode]);

	// Branch creation for alternate conversation paths
	const createBranch = useCallback(async (parentNodeId: string): Promise<string> => {
		const parentNode = getNode(parentNodeId);
		if (!parentNode) throw new Error('Parent node not found');

		const branchNode: ConversationNode = {
			id: generateNodeId(),
			parentId: parentNodeId,
			expertId: expert.id,
			summary: 'New branch',
			timestamp: new Date(),
			userMessage: null,
			assistantResponse: null,
			branchNodeIds: [],
			childNodeId: null,
			metadata: {
				isMainTimeline: false,
				depth: parentNode.metadata?.depth || 0
			}
		};

		setNodes(prev => {
			const next = new Map(prev);
			const parent = next.get(parentNodeId);
			if (parent) {
				parent.branchNodeIds.push(branchNode.id);
			}
			next.set(branchNode.id, branchNode);
			return next;
		});

		return branchNode.id;
	}, [expert.id, getNode]);

	// Return the public interface
	return {
		// State
		uiState,
		activeNodeId,
		activePath: getPathToNode(activeNodeId, nodes),
		currentNode: getNode(activeNodeId),

		// Navigation
		navigateToProjectView,
		navigateToExpertView,
		navigateToNode,
		navigateBack,

		// Viewport controls
		viewport,

		// Chat functionality
		...chat,
		handleSubmit,

		// Node management
		createBranch,
		getNode,
		getAllNodes: useCallback(() => Array.from(nodes.values()), [nodes]),
		getVisibleNodes: useCallback(() =>
			Array.from(nodes.values()).filter(node =>
				uiState.view.level !== ViewLevel.PROJECT &&
				isNodeVisible(node.id, nodes, uiState, {
					x: 0, y: 0, width: window.innerWidth, height: window.innerHeight
				})
			), [nodes, uiState.view.level, uiState.viewport]),

		// Utility functions
		isNodeInMainTimeline: useCallback((nodeId: string) =>
			getNode(nodeId)?.metadata?.isMainTimeline ?? false,
			[getNode])
	};
}

// Create a custom hook for consuming the context
export function useConversationTimelineContext() {
	const context = useContext(ConversationTimelineContext);

	if (context === null) {
		throw new Error(
			'useConversationTimelineContext must be used within a ConversationTimelineProvider. ' +
			'Make sure you have wrapped your component tree with ConversationTimelineProvider.'
		);
	}

	return context;
}