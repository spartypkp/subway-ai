"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, PenSquare, Plus } from "lucide-react";
import { useState } from "react";

interface Expert {
	id: string;
	name: string;
	color: string;
	instructions: string;
}

interface Project {
	name: string;
	description: string;
	instructions: string;
}

export function ExpertPanel() {
	// Mock data - replace with your actual data source
	const [project, setProject] = useState<Project>({
		name: "My Project",
		description: "Project description",
		instructions: "Project instructions"
	});

	const [experts] = useState<Expert[]>([
		{
			id: "1",
			name: "Frontend Expert",
			color: "green",
			instructions: "Frontend development instructions"
		}
	]);

	const [currentExpertIndex, setCurrentExpertIndex] = useState(0);
	const currentExpert = experts[currentExpertIndex];

	const canNavigateLeft = currentExpertIndex > 0;
	const canNavigateRight = currentExpertIndex < experts.length - 1;

	return (
		<div className="w-full flex flex-col">
			{/* Project Navigation Section */}
			<div className="p-4 bg-background border-b">
				<div className="flex items-center justify-between">
					<h2 className="text-2xl font-semibold">{project.name}</h2>

					<Dialog>
						<DialogTrigger asChild>
							<Button variant="ghost" size="icon">
								<PenSquare className="h-4 w-4" />
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Edit Project</DialogTitle>
							</DialogHeader>
							{/* Add your project edit form here */}
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<Separator />

			{/* Expert Panel Section */}
			<div className="p-4 flex items-center justify-between">
				{/* Left Navigation */}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
				>
					{canNavigateLeft ? (
						<ChevronLeft className="h-4 w-4" />
					) : (
						<Plus className="h-4 w-4" />
					)}
				</Button>

				{/* Expert "Subway Sign" */}
				<div className="flex items-center gap-2">
					<div
						className="relative px-6 py-3 rounded-lg flex items-center justify-between"
						style={{
							backgroundColor: `color-mix(in srgb, ${currentExpert.color} 15%, transparent)`,
							border: `1px solid ${currentExpert.color}`
						}}
					>
						<span className="text-lg font-medium">{currentExpert.name}</span>

						<Dialog>
							<DialogTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="ml-4 h-8 w-8"
								>
									<PenSquare className="h-4 w-4" />
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Edit Expert</DialogTitle>
								</DialogHeader>
								{/* Add your expert edit form here */}
							</DialogContent>
						</Dialog>
					</div>
				</div>

				{/* Right Navigation */}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
				>
					{canNavigateRight ? (
						<ChevronRight className="h-4 w-4" />
					) : (
						<Plus className="h-4 w-4" />
					)}
				</Button>
			</div>
		</div>
	);
}
