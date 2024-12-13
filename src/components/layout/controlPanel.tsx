import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { ViewLevel } from '@/lib/types/chat';

export function ControlPanel() {
	const { viewport, uiState } = useConversationTimelineContext();

	// Only show controls for Project and Expert views
	if (uiState.view.level === ViewLevel.TIMELINE) return null;

	return (
		<div className="border-t p-4 flex justify-end gap-4">
			{/* Basic zoom controls - we'll enhance these later */}
			<button
				onClick={() => viewport.setZoom(viewport.zoom - 0.1)}
				className="p-2"
			>
				-
			</button>
			<span>{(viewport.zoom * 100).toFixed(0)}%</span>
			<button
				onClick={() => viewport.setZoom(viewport.zoom + 0.1)}
				className="p-2"
			>
				+
			</button>
		</div>
	);
}