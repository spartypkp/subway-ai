"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpertForm } from "@/components/forms/expertForm";
import { Expert } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { PenSquare, Trash2 } from "lucide-react";
import { useState } from "react";

interface ExpertCardProps {
  expert: Expert;
  isSelected: boolean;
  onSelect: (expert: Expert) => void;
  onUpdate: (updatedExpert: Expert) => void;
  onDelete?: (expert: Expert) => void;
}

export function ExpertCard({ 
  expert, 
  isSelected, 
  onSelect, 
  onUpdate,
  onDelete 
}: ExpertCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(expert);
      setIsOpen(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative px-6 py-4 rounded-xl transition-all cursor-pointer",
        "hover:scale-[1.02] hover:shadow-lg",
        isSelected && "ring-2 ring-offset-2",
        "border-2"
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${expert.color} 10%, transparent)`,
        borderColor: expert.color,
        boxShadow: `0 0 20px ${expert.color}10`
      }}
      onClick={() => onSelect(expert)}
    >
      <div className="flex items-center gap-4">
        <div
          className="h-4 w-4 rounded-full"
          style={{
            backgroundColor: expert.color,
            boxShadow: `0 0 10px ${expert.color}`
          }}
        />
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{expert.name}</h3>
          <p className="text-sm text-muted-foreground">{expert.role}</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <PenSquare className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle>Edit Expert</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogHeader>
            <ExpertForm
              projectId={expert.project_id}
              currentExpert={expert}
              experts={[expert]}
              setExperts={([updatedExpert]) => onUpdate(updatedExpert)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 