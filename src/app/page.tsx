// app/page.tsx
"use client";

import { ExpertPanel } from '@/components/layout/expertPanel';

export default function Home() {

	return (
		<div>
			<ExpertPanel />
			<div className="flex-1 h-full">
				<div className="flex items-center justify-center h-[80vh]">
					<div className="max-w-4xl w-full p-8">
						<div className="rounded-xl border bg-card text-card-foreground shadow">
							<div className="p-6 flex flex-col items-center gap-4">
								<h2 className="text-2xl font-semibold">Welcome to AIRoundTable</h2>
								<p className="text-muted-foreground text-center">
									This is where your AI experts will collaborate. Select or add an expert above to begin.
								</p>
							</div>
						</div>
					</div>
				</div>
				Test
			</div>
		</div>
	);
}