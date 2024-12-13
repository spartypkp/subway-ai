// app/page.tsx
"use client";

import { ExpertPanel } from '@/components/layout/expertPanel';

export default function Home() {

	return (
		<div>
			<ExpertPanel />
			<div className="flex-1 h-full">
				Test
			</div>
		</div>
	);
}