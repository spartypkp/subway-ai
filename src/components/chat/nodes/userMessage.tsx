import React from 'react';
import { User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrackSegment } from './trackSegment';
import { TimelineNode } from '@/lib/types/database';

interface UserMessageProps {
    node: TimelineNode;
    isActive: boolean;
    branchColor: string;
    onMessageSelect: (messageId: string) => void;
}

export const UserMessage: React.FC<UserMessageProps> = ({
    node,
    isActive,
    branchColor,
    onMessageSelect,
}) => {
    return (
        <div
            className={cn(
                "group relative z-10 my-3",
                "mx-auto w-full max-w-3xl px-16",
                "flex flex-col items-center"
            )}
            onClick={() => onMessageSelect(node.id)}
            data-node="message"
            data-id={node.id}
            data-branch={node.branch_id}
            data-type={node.type}
        >
            {/* Track segment above message */}
            <TrackSegment 
                color={branchColor} 
                position="above"
                height="20px"
            />

            <div className="relative w-full">
                {/* Message avatar */}
                <div
                    className="absolute top-8 transform -translate-y-1/2 size-12 flex items-center justify-center rounded-full border-2 shadow-md z-20 left-[-4rem]"
                    style={{
                        borderColor: branchColor,
                        background: branchColor,
                        opacity: isActive ? 1 : 0.7,
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    <User className="size-6 text-white" />
                </div>

                {/* Message card */}
                <Card
                    className={cn(
                        "transition-all duration-200 p-0 overflow-hidden",
                        "text-primary-foreground shadow-sm shadow-primary/10",
                        isActive && "ring-2 ring-offset-2",
                        "group-hover:shadow-md"
                    )}
                    style={{
                        borderColor: branchColor,
                        backgroundColor: branchColor,
                        borderRadius: '12px 12px 12px 3px',
                        borderWidth: '1.5px',
                        ...(isActive ? {
                            ringColor: `${branchColor}`,
                            transform: 'scale(1.01)'
                        } : {})
                    }}
                >
                    {/* Time indicator */}
                    <div className="px-2 py-0.5 text-[10px] font-medium border-b bg-black/10 border-black/10 text-white/90">
                        {new Date(node.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </div>

                    <div className="p-3.5">
                        <div className="prose prose-sm max-w-none prose-invert">
                            {node.message_text || ''}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Track segment below message */}
            <TrackSegment color={branchColor} height="20px" position="below" />
        </div>
    );
};