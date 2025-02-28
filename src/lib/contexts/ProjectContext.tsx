"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Project, TimelineNode } from '@/lib/types/database';

/**
 * ProjectContext
 * 
 * A global context provider that manages project selection, creation, and deletion.
 * This centralizes project management to:
 * 1. Eliminate duplicate API calls
 * 2. Ensure data consistency across components
 * 3. Provide project data to all components that need it
 * 4. Separate project management from UI components
 */

// Main context interface
interface ProjectContextValue {
  // Data
  projects: Project[];
  selectedProject: Project | null;
  selectedProjectId: string | null;
  mainBranchId: string | null;
  
  // State
  loading: boolean;
  
  // Actions
  fetchProjects: () => Promise<void>;
  selectProject: (projectId: string) => void;
  createProject: (name: string, description: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  fetchMainBranchId: (projectId: string) => Promise<string | null>;
}

// Create the context with a default undefined value
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

// Props for the provider component
interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [mainBranchId, setMainBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived state
  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId) || null, 
    [projects, selectedProjectId]
  );

  // Fetch all projects
  const fetchProjects = useCallback(async (): Promise<void> => {
    //console.log('🔍 DEBUG: Fetching projects...');
    setLoading(true);
    
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      
      const data = await response.json();
      //console.log('🔍 DEBUG: Projects fetched:', data.length, 'projects');
      
      // Map any title property to name for backward compatibility
      const processedData = data.map((project: any) => ({
        ...project,
        name: project.name || project.title || 'Unnamed Project'
      }));
      
      setProjects(processedData);
      
      // If there are projects and none selected, select the first one
      if (processedData.length > 0 && !selectedProjectId) {
        //console.log('🔍 DEBUG: Auto-selecting first project:', processedData[0].id, processedData[0].name);
        setSelectedProjectId(processedData[0].id);
      }
    } catch (error) {
      console.error("🔍 DEBUG: Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  // Select a project
  const selectProject = useCallback((projectId: string) => {
    //console.log('🔍 DEBUG: Selecting project:', projectId);
    setSelectedProjectId(projectId);
  }, []);

  // Create a new project
  const createProject = useCallback(async (name: string, description: string): Promise<Project> => {
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) throw new Error("Failed to create project");

      const newProject = await response.json();
      setProjects(prev => [...prev, newProject]);
      setSelectedProjectId(newProject.id);
      
      return newProject;
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  }, []);

  // Delete a project
  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete project");

      // Remove the deleted project from the projects array
      const updatedProjects = projects.filter(p => p.id !== projectId);
      setProjects(updatedProjects);
      
      // Select another project if available, otherwise set to null
      if (updatedProjects.length > 0) {
        setSelectedProjectId(updatedProjects[0].id);
      } else {
        setSelectedProjectId(null);
      }
      
      // Reset main branch ID
      setMainBranchId(null);
      
      //console.log('🔍 DEBUG: Project deleted successfully');
    } catch (error) {
      console.error("Error deleting project:", error);
      throw error;
    }
  }, [projects]);

  // Fetch main branch ID for a project
  const fetchMainBranchId = useCallback(async (projectId: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/nodes?project_id=${projectId}&root=true`);
      if (!response.ok) {
        throw new Error(`Failed to fetch root node: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Find the root node
      const rootNode = data.find((node: TimelineNode) => node.type === 'root');
      if (rootNode) {
        //console.log('🔍 DEBUG: Found root node:', rootNode.id, 'with branch:', rootNode.branch_id);
        setMainBranchId(rootNode.branch_id);
        return rootNode.branch_id;
      } else {
        //console.warn('🔍 DEBUG: No root node found in response');
        setMainBranchId(null);
        return null;
      }
    } catch (error) {
      console.error("🔍 DEBUG: Failed to fetch root node:", error);
      setMainBranchId(null);
      return null;
    }
  }, []);

  // Fetch main branch ID when project changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchMainBranchId(selectedProjectId);
    }
  }, [selectedProjectId, fetchMainBranchId]);

  // Initial data load
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Create memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo<ProjectContextValue>(() => ({
    // Data
    projects,
    selectedProject,
    selectedProjectId,
    mainBranchId,
    
    // State
    loading,
    
    // Actions
    fetchProjects,
    selectProject,
    createProject,
    deleteProject,
    fetchMainBranchId,
  }), [
    projects, 
    selectedProject, 
    selectedProjectId, 
    mainBranchId, 
    loading, 
    fetchProjects, 
    selectProject, 
    createProject, 
    deleteProject, 
    fetchMainBranchId
  ]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

// Hook to use the project context
export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}; 