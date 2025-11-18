import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import { Business as ProjectIcon } from '@mui/icons-material';
import { useAuthStore } from '../../store/authStore';
import { apiCall } from '../../api/client';

interface Project {
  id: string;
  name: string;
  description?: string;
  _count?: {
    vendors: number;
    channels: number;
    messages: number;
  };
}

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  size?: 'small' | 'medium';
  showAllOption?: boolean;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  selectedProjectId,
  onProjectChange,
  size = 'small',
  showAllOption = true,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, token } = useAuthStore();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiCall<{ projects: Project[] }>('get', '/projects');
      setProjects(response.projects || []);
      
      // Auto-select first project if none selected and we have projects
      if (!selectedProjectId && response.projects?.length > 0) {
        onProjectChange(response.projects[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch projects:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch projects if user is authenticated and has a token
    if (isAuthenticated && token) {
      fetchProjects();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  const handleProjectChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    onProjectChange(value === 'all' ? null : value);
  };

  if (!isAuthenticated || !token) {
    return (
      <Box display="flex" alignItems="center" minWidth={200}>
        <ProjectIcon sx={{ mr: 1, color: 'action.active' }} fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          Please log in
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" alignItems="center" minWidth={200}>
        <ProjectIcon sx={{ mr: 1, color: 'action.active' }} fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          Loading projects...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" alignItems="center" minWidth={200}>
        <ProjectIcon sx={{ mr: 1, color: 'error.main' }} fontSize="small" />
        <Typography variant="body2" color="error">
          Error loading projects
        </Typography>
      </Box>
    );
  }

  if (projects.length === 0) {
    return (
      <Box display="flex" alignItems="center" minWidth={200}>
        <ProjectIcon sx={{ mr: 1, color: 'action.active' }} fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          No projects found
        </Typography>
      </Box>
    );
  }

  return (
    <FormControl size={size} sx={{ minWidth: 200 }}>
      <InputLabel id="project-selector-label">
        <Box display="flex" alignItems="center">
          <ProjectIcon sx={{ mr: 0.5 }} fontSize="small" />
          Project
        </Box>
      </InputLabel>
      <Select
        labelId="project-selector-label"
        value={selectedProjectId || (showAllOption ? 'all' : '')}
        onChange={handleProjectChange}
        label={
          <Box display="flex" alignItems="center">
            <ProjectIcon sx={{ mr: 0.5 }} fontSize="small" />
            Project
          </Box>
        }
      >
        {showAllOption && (
          <MenuItem value="all">
            <Box>
              <Typography variant="inherit" fontWeight="medium">
                All Projects
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Aggregated view across all projects
              </Typography>
            </Box>
          </MenuItem>
        )}
        {projects.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            <Box>
              <Typography variant="inherit" fontWeight="medium">
                {project.name}
              </Typography>
              {project.description && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {project.description}
                </Typography>
              )}
              {project._count && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {project._count.userVendorChannels || 0} configurations • {project._count.messages || 0} messages
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ProjectSelector;