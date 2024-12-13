import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const projectId = searchParams.get('project_id');

	try {
		const result = await query(
			`SELECT * FROM experts 
       WHERE project_id = $1 
       ORDER BY position`,
			[projectId]
		);

		// If no experts found, create default expert
		if (result.rows.length === 0) {
			const defaultExpert = {
				name: "System Design Expert",
				role: "Architecture Specialist",
				color: "#6366f1",
				position: 0,
				instructions: {
					tech_stack: {
						expertise: ["System Architecture", "Design Patterns", "Scalability"],
						experience_level: "Senior",
						preferred_tools: ["Draw.io", "Miro", "UML"]
					},
					style_guide: {
						code_formatting: "Clean Architecture",
						component_structure: "Domain-Driven Design",
						naming_conventions: "Ubiquitous Language"
					},
					general: {
						response_format: "Structured Analysis",
						focus_areas: ["Architecture", "Scalability", "Best Practices"]
					},
					personality: {
						tone: "Professional",
						communication_style: "Analytical",
						expertise_level: "Expert"
					}
				}
			};

			const newExpertResult = await query(
				`INSERT INTO experts (project_id, name, role, color, position, instructions)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
				[
					projectId,
					defaultExpert.name,
					defaultExpert.role,
					defaultExpert.color,
					defaultExpert.position,
					JSON.stringify(defaultExpert.instructions)
				]
			);

			return NextResponse.json(newExpertResult.rows);
		}

		return NextResponse.json(result.rows);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const { project_id, name, role, color, position, instructions } = await req.json();
		const result = await query(
			`INSERT INTO experts (project_id, name, role, color, position, instructions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
			[project_id, name, role, color, position, JSON.stringify(instructions)]
		);
		return NextResponse.json(result.rows[0]);
	} catch (error) {
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
} 