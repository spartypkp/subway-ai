import { TimelineNode } from "@/lib/types/database";

export async function createEmptyNode({
  projectId,
  expertId,
  parentId = null,
}: {
  projectId: string;
  expertId: string;
  parentId?: string | null;
}): Promise<TimelineNode> {
  try {
    const response = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        expert_id: expertId,
        parent_id: parentId,
        type: 'message',
        content: {
          text: '',
          role: 'user'
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create node');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create node:', error);
    throw error;
  }
} 