// components/layout/TopBar.tsx
import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { ViewLevel } from '@/lib/types/chat';

export function TopBar() {
	const { uiState, navigateBack, navigateToProjectView } = useConversationTimelineContext();

	return (
		<div className="border-b p-4 flex items-center justify-between">
			<div className="flex items-center gap-4">
				{/* Only show back button if we can go back */}
				{uiState.navigation.canGoBack && (
					<button onClick={navigateBack} className="p-2">
						← Back
					</button>
				)}

				{/* Show breadcrumb based on current view */}
				<div className="flex items-center gap-2">
					<button onClick={navigateToProjectView} className="hover:underline">
						Project
					</button>
					{uiState.view.level !== ViewLevel.PROJECT && (
						<>
							<span>/</span>
							<span>{uiState.selectedExpert?.name || 'Expert'}</span>
						</>
					)}
					{uiState.view.level === ViewLevel.TIMELINE && (
						<>
							<span>/</span>
							<span>Chat</span>
						</>
					)}
				</div>
			</div>

			{/* TODO: Add additional controls (settings, help, etc.) */}
			<div></div>
		</div>
	);
}