import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const expertId = searchParams.get('expert_id');
  const projectId = searchParams.get('project_id');

  try {
    const result = await query(
      `SELECT * FROM timeline_nodes 
       WHERE expert_id = $1 AND project_id = $2
       ORDER BY created_at ASC`,
      [expertId, projectId]
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
} 