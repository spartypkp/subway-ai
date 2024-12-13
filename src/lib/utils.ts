import { Message } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ConversationNode, Expert, UIState } from "./types/chat";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function generateNodeId(): string {
	return crypto.randomUUID();
}

export function generateSummary(userMessage: Message, assistantResponse: Message): string {
	return `Faking summary for now!`;
}

interface VisibilityBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}


// Helper function that finds all paths in the node tree for visualization
export function getAllPaths(nodes: Map<string, ConversationNode>) {
	// We'll store all paths here, with the main timeline path first
	const paths: string[][] = [];
	const visited = new Set<string>();

	// This function recursively traces a path from a given node
	function tracePath(nodeId: string, currentPath: string[] = []) {
		// Avoid cycles and already visited branches
		if (visited.has(nodeId)) return;
		visited.add(nodeId);

		const node = nodes.get(nodeId);
		if (!node) return;

		// Add this node to the current path
		currentPath.push(nodeId);

		// If this node has a direct child, continue the path
		if (node.childNodeId) {
			tracePath(node.childNodeId, currentPath);
		} else {
			// When we reach the end of a path, add it to our collection
			paths.push([...currentPath]);
		}

		// Now trace all branch paths from this node
		for (const branchId of node.branchNodeIds) {
			tracePath(branchId, [...currentPath.slice(0, -1)]);
		}
	}

	// Start tracing from the root node(s)
	const rootNodes = Array.from(nodes.values()).filter(node => !node.parentId);
	for (const rootNode of rootNodes) {
		tracePath(rootNode.id);
	}

	return paths;
}

// Enhanced getPathToNode function
export function getPathToNode(nodeId: string, nodes: Map<string, ConversationNode>) {
	const path: string[] = [];
	let currentId = nodeId;

	// Walk up the tree until we reach a root node
	while (currentId) {
		const node = nodes.get(currentId);
		if (!node) break;

		// Add this node to the front of the path
		path.unshift(currentId);

		// If we've reached a root node, stop
		if (!node.parentId) break;
		currentId = node.parentId;
	}

	return path;
}
export function fetchExpert(expertId: string): Promise<Expert> {
	return Promise.resolve({
		id: expertId,
		name: 'Backend Architecture Expert',
		domain: 'Backend Development',
		longTermMemory: 'Expert in backend architecture...',
		rootNodeId: 'root-node-1'
	});
}
export function isNodeVisible(
	nodeId: string,
	nodes: Map<string, ConversationNode>,
	uiState: UIState,
	viewBounds: VisibilityBounds
): boolean {
	const node = nodes.get(nodeId);
	if (!node) return false;

	const nodeDepth = node.metadata?.depth || 0;
	const path = getPathToNode(nodeId, nodes);

	const nodeX = (path.length * 100) * uiState.viewport.zoom + uiState.viewport.position.x;
	const nodeY = nodeDepth * 50 * uiState.viewport.zoom + uiState.viewport.position.y;

	return (
		nodeX >= viewBounds.x &&
		nodeX <= viewBounds.x + viewBounds.width &&
		nodeY >= viewBounds.y &&
		nodeY <= viewBounds.y + viewBounds.height
	);
}
// Walks up the tree to build complete context for a given node
export function buildTimelineMessages(
	expert: Expert,
	nodeId: string,
	nodes: Map<string, ConversationNode>
): Message[] {
	const messages: Message[] = [];
	let currentId = nodeId;

	messages.push({
		role: 'system',
		content: expert.longTermMemory,
		id: 'system-message'
	});

	while (currentId) {
		const node = getNode(currentId, nodes);
		if (!node) break;

		if (node.userMessage) messages.unshift(node.userMessage);
		if (node.assistantResponse) messages.unshift(node.assistantResponse);
		if (!node.parentId) break;
		currentId = node.parentId;
	}

	return messages;
}
export function getNode(nodeId: string, nodes: Map<string, ConversationNode>): ConversationNode | null {
	return nodes.get(nodeId) || null;
}

// export function getNode(nodeId: string): ConversationNode {
// 	// TODO: Implement this. Fake by creating a dummy node.
// 	return {
// 		id: nodeId,
// 		parentId: null,
// 		expertId: 'dummy',
// 		summary: '',
// 		timestamp: new Date(),
// 		userMessage: { id: 'dummy-user-message', role: 'user', content: 'dummy' },
// 		assistantResponse: { id: 'dummy-assistant-message', role: 'assistant', content: 'dummy' },
// 		branchNodeIds: [],
// 		metadata: { isMainTimeline: true, depth: 0 }
// 	};
// }