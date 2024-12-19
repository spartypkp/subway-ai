import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const {
      project_id,
      expert_id,
      parent_id = null,
      node_type = 'message',
      content = {
        text: '',
        role: 'user'
      }
    } = await req.json();

    const result = await query(
      `INSERT INTO timeline_nodes (
        project_id,
        expert_id,
        parent_id,
        node_type,
        content,
        status,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        project_id,
        expert_id,
        parent_id,
        node_type,
        JSON.stringify(content),
        null,
        null
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
} 