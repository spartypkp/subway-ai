// app/page.tsx
"use client";

import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { ControlPanel } from '@/components/layout/controlPanel';
import { MainViewport } from '@/components/layout/mainViewport';
import { TopBar } from '@/components/layout/topBar';

export default function Home() {
	const { uiState } = useConversationTimelineContext();

	return (
		<div className="h-screen w-full grid grid-rows-[auto_1fr_auto] bg-background">
			<TopBar />
			<MainViewport />
			<ControlPanel />
		</div>
	);
}