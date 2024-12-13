import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

const DEFAULT_EXPERT = {
	name: "System Design Expert",
	role: "Architecture Specialist",
	color: "#6366f1", // Indigo color
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

export async function POST(req: Request) {
	try {
		// Start a transaction
		await query('BEGIN');

		// Create new project
		const { name = "New Project" } = await req.json();
		const projectResult = await query(
			`INSERT INTO projects (name, description, instructions)
       VALUES ($1, $2, $3)
       RETURNING *`,
			[name, "A new project", "Default project instructions"]
		);

		const project = projectResult.rows[0];

		// Add default system design expert
		await query(
			`INSERT INTO experts (project_id, name, role, color, position, instructions)
       VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				project.id,
				DEFAULT_EXPERT.name,
				DEFAULT_EXPERT.role,
				DEFAULT_EXPERT.color,
				DEFAULT_EXPERT.position,
				JSON.stringify(DEFAULT_EXPERT.instructions)
			]
		);

		await query('COMMIT');

		return NextResponse.json(project);
	} catch (error) {
		await query('ROLLBACK');
		console.error('Database error:', error);
		return NextResponse.json({ error: 'Database error' }, { status: 500 });
	}
} 