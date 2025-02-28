"use client";

import { ReactFlowProvider } from "reactflow";
import { ProjectProvider } from "@/lib/contexts/ProjectContext";
import { ConversationProvider } from "@/lib/contexts/ConversationContext";
import React from "react";

// Create a bridge component that checks if project is loaded before rendering conversation
const ConversationBridge = ({ children }: { children: React.ReactNode }) => {
  return (
    <ConversationProvider>
      {children}
    </ConversationProvider>
  );
};

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReactFlowProvider>
      <ProjectProvider>
        <ConversationBridge>
          {children}
        </ConversationBridge>
      </ProjectProvider>
    </ReactFlowProvider>
  );
}