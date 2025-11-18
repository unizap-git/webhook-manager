import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Alert,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Business as ProjectIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Webhook as WebhookIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../api/client';
import LoadingState from '../components/LoadingState';
import { useProject } from '../contexts/ProjectContext';
import { Project } from '../types/api';

interface CreateProjectData {
  name: string;
  description?: string;
}

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuProject, setMenuProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<CreateProjectData>({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setSelectedProjectId } = useProject();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall<{ projects: Project[] }>('get', '/projects');
      setProjects(response.projects || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await apiCall('post', '/projects', formData);
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '' });
      await fetchProjects();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProject = async () => {
    if (!selectedProject || !formData.name.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await apiCall('put', `/projects/${selectedProject.id}`, formData);
      setEditDialogOpen(false);
      setSelectedProject(null);
      setFormData({ name: '', description: '' });
      await fetchProjects();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Are you sure you want to delete the project "${project.name}"? This will delete all associated data.`)) {
      return;
    }

    try {
      await apiCall('delete', `/projects/${project.id}`);
      await fetchProjects();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to delete project');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    setMenuAnchor(event.currentTarget);
    setMenuProject(project);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuProject(null);
  };

  const handleEditClick = () => {
    if (menuProject) {
      setSelectedProject(menuProject);
      setFormData({
        name: menuProject.name,
        description: menuProject.description || '',
      });
      setEditDialogOpen(true);
      handleMenuClose();
    }
  };

  const handleDeleteClick = () => {
    if (menuProject) {
      handleDeleteProject(menuProject);
      handleMenuClose();
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProjectId(project.id);
    navigate('/analytics');
  };

  if (loading) {
    return <LoadingState message="Loading projects..." />;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ProjectIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No projects found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first project to start organizing your vendors and channels.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid item xs={12} md={6} lg={4} key={project.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box display="flex" alignItems="center">
                      <ProjectIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" component="h2">
                        {project.name}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, project)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  {project.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {project.description}
                    </Typography>
                  )}

                  {project._count && (
                    <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                      <Chip
                        size="small"
                        icon={<WebhookIcon />}
                        label={`${project._count?.userVendorChannels || 0} Configurations`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<AnalyticsIcon />}
                        label={`${project._count?.messages || 0} Messages`}
                        variant="outlined"
                      />
                    </Box>
                  )}

                  <Typography variant="caption" color="text.secondary">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    onClick={() => handleProjectSelect(project)}
                    startIcon={<AnalyticsIcon />}
                  >
                    View Analytics
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditClick}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateProject}
            variant="contained"
            disabled={!formData.name.trim() || submitting}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditProject}
            variant="contained"
            disabled={!formData.name.trim() || submitting}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;