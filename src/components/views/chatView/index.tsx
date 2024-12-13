import { useConversationTimelineContext } from '@/components/hooks/useConversationTimeline';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

export function ChatView() {
	const {
		messages,
		input,
		handleInputChange,
		handleSubmit,
		isLoading,
		currentNode,
		createBranch
	} = useConversationTimelineContext();

	if (!currentNode) return null;

	return (
		<div className="flex flex-col h-full">
			{/* Messages area */}
			<ScrollArea className="flex-1 p-4">
				<div className="space-y-4">
					{messages.map((message) => (
						<div
							key={message.id}
							className={`p-4 rounded-lg ${message.role === 'user'
									? 'bg-primary text-primary-foreground ml-12'
									: 'bg-muted mr-12'
								}`}
						>
							{message.content}
						</div>
					))}
					{isLoading && (
						<div className="p-4 bg-muted rounded-lg mr-12">
							Thinking...
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Input area */}
			<form onSubmit={handleSubmit} className="border-t p-4 space-y-4">
				{/* Branch creation button */}
				<div className="flex justify-end">
					<Button
						type="button"
						variant="outline"
						onClick={() => createBranch(currentNode.id)}
						className="text-sm"
					>
						Create Branch
					</Button>
				</div>

				<div className="flex gap-4">
					<Textarea
						value={input}
						onChange={handleInputChange}
						placeholder="Type your message..."
						className="flex-1"
						rows={3}
					/>
					<Button type="submit" disabled={isLoading}>
						Send
					</Button>
				</div>
			</form>
		</div>
	);
}