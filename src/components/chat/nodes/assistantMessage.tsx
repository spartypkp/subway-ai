import React from 'react';
import { Bot, GitBranch, Sparkles, SwitchCamera } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { TimelineNode } from '@/lib/types/database';
import { TrackSegment } from './trackSegment';
import { BranchPointInfo } from '../conversationView'


interface AssistantMessageProps {
    node: TimelineNode;
    isActive: boolean;
    streamingContent: string | null;
    branchColor: string;
    stationNumber: number;
    onMessageSelect: (messageId: string) => void;
    onBranchClick: (messageId: string, yValue: number) => void;
    hasBranchOptions?: boolean;
    branchPointInfo?: BranchPointInfo;
    getBranchSwitchTarget?: (branchPointInfo: BranchPointInfo | undefined, currentBranchId: string | null) => any;
    currentBranchId: string | null;
    switchBranch: (branchId: string) => void;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
    node,
    isActive,
    streamingContent,
    branchColor,
    stationNumber,
    onMessageSelect,
    onBranchClick,
    hasBranchOptions,
    branchPointInfo,
    getBranchSwitchTarget,
    currentBranchId,
    switchBranch
}) => {
    // Same logic as in messageList but scoped to this component
    const messageText = node.id === 'streaming-message' && streamingContent !== null
        ? streamingContent
        : node.message_text || '';
    const isStreaming = node.id === 'streaming-message' && streamingContent !== null;
    const showTypingIndicator = Boolean(isStreaming || node.isStreaming);

    // Format message text with typing indicators
    const formatMessageText = (text: string, showTypingIndicator: boolean): string => {
        if (!text && showTypingIndicator) {
            return `<span class="inline-flex items-center">
              <span class="typing-indicator">
                <span></span><span></span><span></span>
              </span>
            </span>`;
        }

        if (showTypingIndicator) {
            return `${text}<span class="inline-flex items-center ml-1">
              <span class="typing-indicator">
                <span></span><span></span><span></span>
              </span>
            </span>`;
        }

        return text;
    };

    return (
        <div
            className={cn(
                "group relative z-10 my-3",
                "mx-auto w-full max-w-3xl px-16",
                "flex flex-col items-center",
                isStreaming && "animate-fadeIn"
            )}
            onClick={() => onMessageSelect(node.id)}
            data-node="message"
            data-id={node.id}
            data-branch={node.branch_id}
            data-type={node.type}
            data-streaming={isStreaming ? 'true' : 'false'}
        >
            {/* Track segment above message */}
            <TrackSegment 
                color={branchColor} 
                position="above"
                height="20px"
            />

            <div className="relative w-full">
                
                {hasBranchOptions && branchPointInfo && getBranchSwitchTarget && (
                    <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 z-0">
                        <div className="relative">
                            {(() => {
                                const switchTarget = getBranchSwitchTarget(branchPointInfo, currentBranchId);
                                return switchTarget ? (
                                    <>
                                        {/* Horizontal branch line with transition */}
                                        <div
                                            className="absolute h-3"
                                            style={{
                                                background: switchTarget.branchColor,
                                                borderTopRightRadius: '4px',
                                                width: 'calc(50vw - 20px)',
                                                left: '-10px',
                                                top: '-1.5px',
                                                zIndex: 0
                                            }}
                                        />

                                        {/* Branch switch button */}
                                        <div className="absolute transform translate-y-8" style={{ left: '40px', zIndex: 1 }}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 text-xs bg-white shadow-md border-2 px-4 flex items-center gap-2 font-medium"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    switchBranch(switchTarget.branchId);
                                                }}
                                                style={{
                                                    color: switchTarget.branchColor,
                                                    borderColor: `${switchTarget.branchColor}`,
                                                }}
                                            >
                                                <SwitchCamera className="h-4 w-4" />
                                                <span>Switch to {switchTarget.branchName || 'branch'}</span>
                                            </Button>
                                        </div>
                                    </>
                                ) : null;
                            })()}
                        </div>
                    </div>
                )}

                {/* Message avatar */}
                <div
                    className="absolute top-8 transform -translate-y-1/2 size-12 flex items-center justify-center rounded-full border-2 shadow-md bg-background z-20 right-[-4rem]"
                    style={{
                        borderColor: branchColor,
                        background: 'white',
                        opacity: isActive ? 1 : 0.7,
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    <Bot className="size-6" style={{ color: branchColor }} />
                </div>

                {/* Message card */}
                <Card
                    className={cn(
                        "transition-all duration-200 p-0 overflow-hidden",
                        "border shadow-sm hover:shadow",
                        isActive && "ring-2 ring-offset-2",
                        "group-hover:shadow-md",
                        isStreaming && "border-primary/40"
                    )}
                    style={{
                        borderRadius: '12px 12px 3px 12px',
                        borderWidth: '1.5px',
                        ...(isActive ? {
                            ringColor: `${branchColor}`,
                            transform: 'scale(1.01)'
                        } : {})
                    }}
                >
                    {/* Time indicator */}
                    <div
                        className={cn(
                            "px-2 py-0.5 text-[10px] font-medium border-b",
                            "bg-muted/30 border-muted/30 text-muted-foreground",
                            isStreaming && node.isStreaming && "bg-primary/10 border-primary/20"
                        )}
                    >
                        {isStreaming
                            ? 'Just now'
                            : new Date(node.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        }
                        <span className="ml-1">• Station {stationNumber}</span>
                    </div>

                    <div className="p-3.5">
                        <div
                            className="prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{
                                __html: formatMessageText(
                                    messageText,
                                    showTypingIndicator
                                )
                            }}
                        />
                    </div>

                    {/* AI message footer */}
                    <div className="px-3.5 py-2 bg-muted/10 border-t border-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            <span>AI Assistant</span>
                            {isStreaming && (
                                <span className="ml-2 text-primary animate-pulse">generating...</span>
                            )}
                        </div>

                        {/* Branch button - only show for non-streaming messages */}
                        {!isStreaming && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs hover:bg-background rounded-full border border-transparent hover:border-muted"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onBranchClick(node.id, node.metadata?.y_value || 0);
                                            }}
                                        >
                                            <GitBranch className="h-3 w-3 mr-1" />
                                            Branch
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Create a new conversation branch from this point
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </Card>
            </div>

            {/* Track segment below message */}
            <TrackSegment color={branchColor} height="20px" position="below" />
        </div>
    );
};