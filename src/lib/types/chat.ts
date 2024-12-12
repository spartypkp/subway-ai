
export interface ConversationNode {
	id: string;
	parentId: string | null;  // null for root node
	expertId: string;        // which expert this node belongs to
	summary: string;         // one-line summary for the subway map view
	timestamp: Date;

	// The actual conversation data
	userMessage: string;
	assistantResponse: string;

	// References to branches
	childNodeIds: string[];  // IDs of child nodes

	// Optional metadata
	metadata?: {
		isMainPath: boolean;   // is this node part of the main conversation path?
		branchName?: string;   // optional name for this branch
	};
}