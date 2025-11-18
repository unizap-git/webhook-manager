import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface ProjectContextType {
  selectedProject: Project | null;
  selectedProjectId: string | null;
  setSelectedProject: (project: Project | null) => void;
  setSelectedProjectId: (projectId: string | null) => void;
  isAllProjects: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Load saved project from localStorage on mount
  useEffect(() => {
    const savedProjectId = localStorage.getItem('selectedProjectId');
    const savedProject = localStorage.getItem('selectedProject');
    
    if (savedProjectId && savedProjectId !== 'null') {
      setSelectedProjectId(savedProjectId);
      
      if (savedProject && savedProject !== 'null') {
        try {
          setSelectedProject(JSON.parse(savedProject));
        } catch (error) {
          console.error('Failed to parse saved project:', error);
        }
      }
    }
  }, []);

  // Save to localStorage when project changes
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('selectedProjectId', selectedProjectId);
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('selectedProject', JSON.stringify(selectedProject));
    } else {
      localStorage.removeItem('selectedProject');
    }
  }, [selectedProject]);

  const handleSetSelectedProject = (project: Project | null) => {
    setSelectedProject(project);
    setSelectedProjectId(project?.id || null);
  };

  const handleSetSelectedProjectId = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    if (!projectId) {
      setSelectedProject(null);
    }
  };

  const isAllProjects = selectedProjectId === null;

  return (
    <ProjectContext.Provider
      value={{
        selectedProject,
        selectedProjectId,
        setSelectedProject: handleSetSelectedProject,
        setSelectedProjectId: handleSetSelectedProjectId,
        isAllProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export default ProjectProvider;