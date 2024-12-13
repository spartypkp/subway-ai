import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { ExpertNode } from '@/components/views/projectMap/expertNode';
import { Expert } from '@/lib/types/chat';

export function ProjectMap() {
	const { uiState } = useConversationTimelineContext();

	// For now, we'll use mock data
	const mockExperts: Expert[] = [
		{ id: 'expert1', name: 'Analytics Expert', domain: 'Data Analysis', longTermMemory: 'You are a data analyst', rootNodeId: 'node1' },
		{ id: 'expert2', name: 'Development Expert', domain: 'Software Development', longTermMemory: 'You are a software developer', rootNodeId: 'node2' },
	];

	return (
		<div className="p-8 relative w-full h-full">
			{/* TODO: Replace with actual subway map visualization */}
			<div className="grid grid-cols-2 gap-8">
				{mockExperts.map(expert => (
					<ExpertNode key={expert.id} expert={expert} />
				))}
			</div>
		</div>
	);
}