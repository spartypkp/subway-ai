"use client";
import { ConversationNode, Expert } from '@/lib/types/chat';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

// The different levels of detail in our application
type ViewLevel = 'project' | 'expert' | 'timeline';

interface ViewportState {
	position: { x: number; y: number; };
	zoom: number;
}

interface UseNavigationReturn {
	// Current view state
	currentViewLevel: ViewLevel;
	activeExpertId: string | null;
	activeTimelineId: string | null;
	viewport: ViewportState;

	// Navigation actions
	navigateToProjectView: () => void;
	navigateToExpertView: (expertId: string) => void;
	navigateToTimelineView: (expertId: string, timelineId: string) => void;
	navigateBack: () => void;

	// Viewport controls
	setZoom: (zoom: number) => void;
	pan: (dx: number, dy: number) => void;
	resetViewport: () => void;

	// Layout calculations
	getExpertPosition: (expertId: string) => { x: number; y: number; };
	getNodePosition: (nodeId: string) => { x: number; y: number; };

	// View-specific utilities
	isExpertVisible: (expertId: string) => boolean;
	isNodeVisible: (nodeId: string) => boolean;
	getVisibleExperts: () => Expert[];
	getVisibleNodes: () => ConversationNode[];
}

const NavigationContext = createContext<UseNavigationReturn | null>(null);

export function NavigationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const navigation = useNavigation();
	return (
		<NavigationContext.Provider value={navigation}>
			{children}
		</NavigationContext.Provider>
	);
}

export function useNavigationContext() {
	const context = useContext(NavigationContext);
	if (!context) {
		throw new Error('useNavigationContext must be used within a NavigationProvider');
	}
	return context;
}

function getExperts(): Expert[] {
	// TODO: Fetch experts from database
	return [];
}

function getNodes(): Map<string, ConversationNode> {
	// TODO: Fetch nodes from database
	return new Map();
}

export function useNavigation(

): UseNavigationReturn {
	// Core navigation state
	const [currentViewLevel, setCurrentViewLevel] = useState<ViewLevel>('project');
	const [activeExpertId, setActiveExpertId] = useState<string | null>(null);
	const [activeTimelineId, setActiveTimelineId] = useState<string | null>(null);

	const experts = getExperts();
	const nodes = getNodes();
	// Viewport state management
	const [viewport, setViewport] = useState<ViewportState>({
		position: { x: 0, y: 0 },
		zoom: 1
	});

	// Navigation history for back button functionality
	const [navigationHistory, setNavigationHistory] = useState<Array<{
		level: ViewLevel;
		expertId: string | null;
		timelineId: string | null;
	}>>([]);

	// Navigation actions
	const navigateToProjectView = useCallback(() => {
		setNavigationHistory(prev => [...prev, {
			level: currentViewLevel,
			expertId: activeExpertId,
			timelineId: activeTimelineId
		}]);

		setCurrentViewLevel('project');
		setActiveExpertId(null);
		setActiveTimelineId(null);
		resetViewport();
	}, [currentViewLevel, activeExpertId, activeTimelineId]);

	const navigateToExpertView = useCallback((expertId: string) => {
		setNavigationHistory(prev => [...prev, {
			level: currentViewLevel,
			expertId: activeExpertId,
			timelineId: activeTimelineId
		}]);

		setCurrentViewLevel('expert');
		setActiveExpertId(expertId);
		setActiveTimelineId(null);
		resetViewport();
	}, [currentViewLevel, activeExpertId, activeTimelineId]);

	const navigateToTimelineView = useCallback((expertId: string, timelineId: string) => {
		setNavigationHistory(prev => [...prev, {
			level: currentViewLevel,
			expertId: activeExpertId,
			timelineId: activeTimelineId
		}]);

		setCurrentViewLevel('timeline');
		setActiveExpertId(expertId);
		setActiveTimelineId(timelineId);
		resetViewport();
	}, [currentViewLevel, activeExpertId, activeTimelineId]);

	const navigateBack = useCallback(() => {
		const previousState = navigationHistory[navigationHistory.length - 1];
		if (!previousState) return;

		setCurrentViewLevel(previousState.level);
		setActiveExpertId(previousState.expertId);
		setActiveTimelineId(previousState.timelineId);
		resetViewport();

		setNavigationHistory(prev => prev.slice(0, -1));
	}, [navigationHistory]);

	// Viewport controls
	const setZoom = useCallback((zoom: number) => {
		setViewport(prev => ({ ...prev, zoom }));
	}, []);

	const pan = useCallback((dx: number, dy: number) => {
		setViewport(prev => ({
			...prev,
			position: {
				x: prev.position.x + dx,
				y: prev.position.y + dy
			}
		}));
	}, []);

	const resetViewport = useCallback(() => {
		setViewport({
			position: { x: 0, y: 0 },
			zoom: 1
		});
	}, []);

	// Layout calculations
	const getExpertPosition = useCallback((expertId: string) => {
		// Calculate expert position based on current view level and viewport
		// This would implement the layout logic for the project-level view
		return { x: 0, y: 0 }; // Placeholder implementation
	}, [viewport]);

	const getNodePosition = useCallback((nodeId: string) => {
		// Calculate node position based on current view level and viewport
		// This would implement the subway-map layout logic
		return { x: 0, y: 0 }; // Placeholder implementation
	}, [viewport, activeExpertId]);

	// View-specific utilities
	const isExpertVisible = useCallback((expertId: string) => {
		if (currentViewLevel === 'timeline') return false;
		const position = getExpertPosition(expertId);
		// Check if expert is within current viewport bounds
		return true; // Placeholder implementation
	}, [currentViewLevel, viewport, getExpertPosition]);

	const isNodeVisible = useCallback((nodeId: string) => {
		if (currentViewLevel === 'project') return false;
		const position = getNodePosition(nodeId);
		// Check if node is within current viewport bounds
		return true; // Placeholder implementation
	}, [currentViewLevel, viewport, getNodePosition]);

	const getVisibleExperts = useCallback(() => {
		return experts.filter(expert => isExpertVisible(expert.id));
	}, [experts, isExpertVisible]);

	const getVisibleNodes = useCallback(() => {
		return Array.from(nodes.values()).filter(node => isNodeVisible(node.id));
	}, [nodes, isNodeVisible]);

	return {
		currentViewLevel,
		activeExpertId,
		activeTimelineId,
		viewport,
		navigateToProjectView,
		navigateToExpertView,
		navigateToTimelineView,
		navigateBack,
		setZoom,
		pan,
		resetViewport,
		getExpertPosition,
		getNodePosition,
		isExpertVisible,
		isNodeVisible,
		getVisibleExperts,
		getVisibleNodes
	};
}