"use client";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ExpertFormValues, expertFormSchema } from "@/lib/schemas/forms";
import { Expert } from "@/lib/types/database";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

interface ExpertFormProps {
	projectId: string;
	currentExpert: Expert;
	experts: Expert[];
	setExperts: (experts: Expert[]) => void;
}

export function ExpertForm({ projectId, currentExpert, experts, setExperts }: ExpertFormProps) {
	const form = useForm<ExpertFormValues>({
		resolver: zodResolver(expertFormSchema),
		defaultValues: currentExpert || {
			name: "",
			role: "",
			color: "#6366f1",
			position: 0,
			active: true,
			instructions: null,
			settings: null,
			metadata: null
		}
	});

	const handleExpertUpdate = async (data: ExpertFormValues) => {
		try {
			const response = await fetch(`/api/experts/${currentExpert.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...data,
					project_id: projectId
				})
			});

			if (!response.ok) throw new Error('Failed to update expert');

			const updatedExpert = await response.json();
			setExperts(experts.map(expert =>
				expert.id === currentExpert.id ? updatedExpert : expert
			));
		} catch (error) {
			console.error('Failed to update expert:', error);
			// TODO: Add error handling UI
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleExpertUpdate)} className="space-y-4">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Expert Name</FormLabel>
							<FormControl>
								<Input placeholder="AI Expert" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="role"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Role</FormLabel>
							<FormControl>
								<Input placeholder="Specialist" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="color"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Color</FormLabel>
							<FormControl>
								<Input type="color" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit">Save Expert</Button>
			</form>
		</Form>
	);
} 