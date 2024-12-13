// components/views/ProjectMap/ExpertNode.tsx
import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { Expert } from '@/lib/types/chat';

export function ExpertNode({ expert }: { expert: Expert; }) {
	const { navigateToExpertView } = useConversationTimelineContext();

	return (
		<button
			onClick={() => navigateToExpertView(expert.id)}
			className="p-6 border rounded-lg hover:bg-accent"
		>
			<h3 className="font-bold">{expert.name}</h3>
			<p className="text-sm text-muted-foreground">{expert.domain}</p>
			{/* TODO: Add timeline preview visualization */}
		</button>
	);
}