import { Message } from 'ai';

export interface Expert {
	id: string;
	name: string;
	domain: string;
	longTermMemory: string;  // Expert's background knowledge
	rootNodeId: string;  // Starting point of this expert's conversation tree
}


export interface ConversationNode {
	id: string;
	parentId: string | null;  // null for root node
	expertId: string;        // which expert this node belongs to
	summary: string;         // one-line summary for the subway map view
	timestamp: Date;

	// The actual conversation data. Can be null if no conversation has been had yet.
	userMessage: Message | null;
	assistantResponse: Message | null;

	// Reference to the child node
	childNodeId: string | null;

	// References to branches
	branchNodeIds: string[];  // IDs of child nodes

	// Optional metadata
	metadata?: {
		isMainTimeline: boolean;   // is this node part of the main conversation path?
		branchName?: string;   // optional name for this branch
		depth: number;
	};
}


// First, let's define our view levels with a proper string enum
export enum ViewLevel {
	PROJECT = 'project',
	EXPERT = 'expert',
	TIMELINE = 'timeline'
}

// Define a consistent viewport state
export interface ViewportState {
	position: {
		x: number;
		y: number;
	};
	zoom: number;
}

// Define the complete UI state in one place
export interface UIState {
	view: {
		level: ViewLevel;
		expertId: string | null;
		nodeId: string | null;  // Changed from timelineId for consistency with our node-based approach
	};
	viewport: ViewportState;
	navigation: {
		history: NavigationHistoryEntry[];
		canGoBack: boolean;
		canGoForward: boolean;
	};
}

// Navigation history entry becomes simpler
export interface NavigationHistoryEntry {
	view: {
		level: ViewLevel;
		expertId: string | null;
		nodeId: string | null;
	};
}