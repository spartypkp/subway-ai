// components/layout/MainViewport.tsx
import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { ChatView } from '@/components/views/chatView';
import { ExpertView } from '@/components/views/expertView';
import { ProjectMap } from '@/components/views/projectMap';
import { ViewLevel } from '@/lib/types/chat';

export function MainViewport() {
	const { uiState } = useConversationTimelineContext();

	// For now, we'll use simple transitions. Later we can add smooth animations
	switch (uiState.view.level) {
		case ViewLevel.PROJECT:
			return <ProjectMap />;
		case ViewLevel.EXPERT:
			return <ExpertView />;
		case ViewLevel.TIMELINE:
			return <ChatView />;
		default:
			return null;
	}
} 
