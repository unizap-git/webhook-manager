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
  DialogContentText,
  TextField,
  IconButton,
  Chip,
  Alert,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  TablePagination,
  InputAdornment,
  Tooltip,
  Checkbox,
  ListItemText,
  FormHelperText,
} from '@mui/material';
import {
  Add as AddIcon,
  Business as ProjectIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Webhook as WebhookIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  BarChart as BarChartIcon,
  ContentCopy as CopyIcon,
  Message as MessageIcon,
  ManageAccounts as ManageAccountsIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { apiCall } from '../api/client';
import LoadingState from '../components/LoadingState';
import { useProject } from '../contexts/ProjectContext';
import { Project, ChildAccount } from '../types/api';
import { LRUCache } from '../utils/lruCache';

interface CreateProjectData {
  name: string;
  description?: string;
}

type SortOption = 'createdAt' | 'name' | 'messages' | 'configs';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<SortOption>('createdAt');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string>('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showManageAccessDialog, setShowManageAccessDialog] = useState(false);
  const [manageAccessProjectId, setManageAccessProjectId] = useState<string>('');
  const [manageAccessChildren, setManageAccessChildren] = useState<string[]>([]);
  const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);

  const navigate = useNavigate();
  const { setSelectedProjectId } = useProject();
  const { enqueueSnackbar } = useSnackbar();

  // LRU cache to prevent memory leaks (max 20 entries)
  const projectsCache = React.useRef<LRUCache<string, Project[]>>(new LRUCache(20));
  const childAccountsCache = React.useRef<LRUCache<string, ChildAccount[]>>(new LRUCache(20));

  // Clear caches on unmount
  useEffect(() => {
    return () => {
      projectsCache.current.clear();
      childAccountsCache.current.clear();
    };
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchChildAccounts();
  }, []);

  const fetchProjects = async (bypassCache = false) => {
    try {
      setLoading(true);
      setError(null);
      const cacheKey = 'projects';

      // Check cache first (unless bypassing)
      if (!bypassCache && projectsCache.current.has(cacheKey)) {
        const cachedProjects = projectsCache.current.get(cacheKey)!;
        setProjects(cachedProjects);
        setLoading(false);
        return;
      }

      const response = await apiCall<{ projects: Project[] }>('get', '/projects');
      const fetchedProjects = response.projects || [];

      // Store in cache
      projectsCache.current.set(cacheKey, fetchedProjects);
      setProjects(fetchedProjects);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildAccounts = async (bypassCache = false) => {
    try {
      const cacheKey = 'childAccounts';

      // Check cache first (unless bypassing)
      if (!bypassCache && childAccountsCache.current.has(cacheKey)) {
        const cachedAccounts = childAccountsCache.current.get(cacheKey)!;
        setChildAccounts(cachedAccounts);
        return;
      }

      const response = await apiCall<{ success: boolean; childAccounts: ChildAccount[] }>('get', '/user/child-accounts');
      const fetchedAccounts = response.childAccounts || [];

      // Store in cache
      childAccountsCache.current.set(cacheKey, fetchedAccounts);
      setChildAccounts(fetchedAccounts);
    } catch (err: any) {
      // Child accounts may not exist or user may not be a parent - don't show error
      console.log('Could not fetch child accounts:', err);
    }
  };

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await apiCall('post', '/projects', formData);
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '' });
      await fetchProjects(true);
      enqueueSnackbar('Project created successfully', { variant: 'success' });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to create project';
      enqueueSnackbar(errorMsg, { variant: 'error' });
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
      await fetchProjects(true);
      enqueueSnackbar('Project updated successfully', { variant: 'success' });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to update project';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (project: Project) => {
    setDeleteProjectId(project.id);
    setDeleteConfirmText('');
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete project') {
      enqueueSnackbar('Please type "delete project" to confirm', { variant: 'error' });
      return;
    }

    try {
      await apiCall('delete', `/projects/${deleteProjectId}`);
      await fetchProjects(true);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
      enqueueSnackbar('Project deleted successfully', { variant: 'success' });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to delete project';
      enqueueSnackbar(errorMsg, { variant: 'error' });
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

  const handleDeleteMenuClick = () => {
    if (menuProject) {
      handleDeleteClick(menuProject);
      handleMenuClose();
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProjectId(project.id);
    navigate('/analytics');
  };

  const handleCopyProjectId = async (projectId: string) => {
    try {
      await navigator.clipboard.writeText(projectId);
      enqueueSnackbar('Project ID copied to clipboard', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to copy to clipboard', { variant: 'error' });
    }
  };

  const handleManageAccess = (project: Project) => {
    setManageAccessProjectId(project.id);
    const currentChildIds = project.projectAccess?.map(pa => pa.userId) || [];
    setManageAccessChildren(currentChildIds);
    setShowManageAccessDialog(true);
  };

  const handleSaveManageAccess = async () => {
    try {
      setSubmitting(true);

      // Get current child IDs for this project
      const project = projects.find(p => p.id === manageAccessProjectId);
      const currentChildIds = project?.projectAccess?.map(pa => pa.userId) || [];

      // Find children to add
      const childrenToAdd = manageAccessChildren.filter(id => !currentChildIds.includes(id));

      // Find children to remove
      const childrenToRemove = currentChildIds.filter(id => !manageAccessChildren.includes(id));

      // Grant access to new children
      if (childrenToAdd.length > 0) {
        await apiCall('post', '/projects/batch-access', {
          childUserId: childrenToAdd[0], // batch endpoint expects single child
          projectIds: [manageAccessProjectId],
        });

        // For additional children, call individually (or we could enhance backend to support multiple children)
        for (let i = 1; i < childrenToAdd.length; i++) {
          await apiCall('post', '/projects/access', {
            projectId: manageAccessProjectId,
            childUserId: childrenToAdd[i],
          });
        }
      }

      // Revoke access from removed children
      for (const childId of childrenToRemove) {
        await apiCall('delete', `/projects/${manageAccessProjectId}/access/${childId}`);
      }

      setShowManageAccessDialog(false);
      setManageAccessChildren([]);
      await fetchProjects(true);
      enqueueSnackbar('Project access updated successfully', { variant: 'success' });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to update project access';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAllChildren = () => {
    if (manageAccessChildren.length === childAccounts.length) {
      setManageAccessChildren([]);
    } else {
      setManageAccessChildren(childAccounts.map(c => c.id));
    }
  };

  // Filter projects based on search query
  const filteredProjects = projects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return project.name.toLowerCase().includes(query);
  });

  // Sort projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'messages':
        return (b._count?.messages || 0) - (a._count?.messages || 0);
      case 'configs':
        return (b._count?.userVendorChannels || 0) - (a._count?.userVendorChannels || 0);
      case 'createdAt':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Paginate projects
  const paginatedProjects = sortedProjects.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Calculate statistics
  const stats = {
    totalProjects: projects.length,
    totalMessages: projects.reduce((sum, p) => sum + (p._count?.messages || 0), 0),
    totalConfigs: projects.reduce((sum, p) => sum + (p._count?.userVendorChannels || 0), 0),
    mostActiveProject: projects.length > 0
      ? projects.reduce((max, p) =>
          (p._count?.messages || 0) > (max._count?.messages || 0) ? p : max
        )
      : null,
  };

  if (loading) {
    return <LoadingState loading={true} error={null}>Loading projects...</LoadingState>;
  }

  return (
    <Box>
      {/* Header with Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              fetchProjects(true);
              fetchChildAccounts(true);
            }}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Project
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Card */}
      {projects.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BarChartIcon sx={{ mr: 1 }} color="primary" />
              <Typography variant="h6">Overview</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Total Projects
                </Typography>
                <Typography variant="h4">{stats.totalProjects}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Total Messages
                </Typography>
                <Typography variant="h4">{stats.totalMessages.toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Total Configurations
                </Typography>
                <Typography variant="h4">{stats.totalConfigs}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Most Active Project
                </Typography>
                {stats.mostActiveProject ? (
                  <>
                    <Typography variant="body1" fontWeight="medium">
                      {stats.mostActiveProject.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stats.mostActiveProject._count?.messages || 0} messages
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    N/A
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Search and Sort */}
      {projects.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by project name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0); // Reset to first page on search
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              startAdornment={<SortIcon sx={{ ml: 1, mr: -0.5 }} />}
            >
              <MenuItem value="createdAt">Date Created</MenuItem>
              <MenuItem value="name">Name (A-Z)</MenuItem>
              <MenuItem value="messages">Message Count</MenuItem>
              <MenuItem value="configs">Configuration Count</MenuItem>
            </Select>
          </FormControl>
        </Box>
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
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No projects match your search
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search query
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid container spacing={3}>
            {paginatedProjects.map((project) => (
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
                          label={`${project._count?.userVendorChannels || 0} Configs`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          icon={<MessageIcon />}
                          label={`${project._count?.messages || 0} Messages`}
                          variant="outlined"
                        />
                        {project._count.projectAccess > 0 && (
                          <Chip
                            size="small"
                            icon={<ManageAccountsIcon />}
                            label={`${project._count.projectAccess} ${project._count.projectAccess === 1 ? 'Child' : 'Children'}`}
                            variant="outlined"
                            color="primary"
                          />
                        )}
                      </Box>
                    )}

                    {/* Child Account Access */}
                    {project.projectAccess && project.projectAccess.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                          Child Access:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {project.projectAccess.slice(0, 3).map((pa) => (
                            <Chip
                              key={pa.userId}
                              label={pa.user.name || pa.user.email}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          ))}
                          {project.projectAccess.length > 3 && (
                            <Chip
                              label={`+${project.projectAccess.length - 3} more`}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                    )}

                    <Typography variant="caption" color="text.secondary">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Button
                      size="small"
                      onClick={() => handleProjectSelect(project)}
                      startIcon={<AnalyticsIcon />}
                    >
                      Analytics
                    </Button>
                    {childAccounts.length > 0 && (
                      <Tooltip title="Manage Child Access">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleManageAccess(project)}
                        >
                          <ManageAccountsIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Copy Project ID">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyProjectId(project.id)}
                      >
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {sortedProjects.length > rowsPerPage && (
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={sortedProjects.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              sx={{ mt: 3 }}
            />
          )}
        </>
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
        <MenuItem onClick={handleDeleteMenuClick} sx={{ color: 'error.main' }}>
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
            {submitting ? 'Creating...' : 'Create'}
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
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setDeleteConfirmText('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Project Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to delete this project? This action cannot be undone.
            <strong> All associated data including vendor configurations, messages, and child account access will be permanently deleted.</strong>
          </DialogContentText>
          <DialogContentText sx={{ mb: 2, fontWeight: 'bold' }}>
            Please type "delete project" to confirm:
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Type 'delete project' to confirm"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmText('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={deleteConfirmText.toLowerCase() !== 'delete project'}
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Child Access Dialog */}
      <Dialog
        open={showManageAccessDialog}
        onClose={() => {
          setShowManageAccessDialog(false);
          setManageAccessChildren([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manage Child Account Access</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select which child accounts can access this project.
          </DialogContentText>
          {childAccounts.length === 0 ? (
            <Alert severity="info">
              No child accounts available. Create child accounts first to grant project access.
            </Alert>
          ) : (
            <FormControl fullWidth margin="dense">
              <InputLabel id="manage-access-label">
                <Box display="flex" alignItems="center">
                  <ManageAccountsIcon sx={{ mr: 0.5 }} fontSize="small" />
                  Select Child Accounts
                </Box>
              </InputLabel>
              <Select
                labelId="manage-access-label"
                multiple
                value={manageAccessChildren}
                onChange={(e) => setManageAccessChildren(e.target.value as string[])}
                label={
                  <Box display="flex" alignItems="center">
                    <ManageAccountsIcon sx={{ mr: 0.5 }} fontSize="small" />
                    Select Child Accounts
                  </Box>
                }
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const child = childAccounts.find(c => c.id === value);
                      return (
                        <Chip key={value} label={child?.name || child?.email || value} size="small" />
                      );
                    })}
                  </Box>
                )}
              >
                <MenuItem>
                  <Checkbox
                    checked={manageAccessChildren.length === childAccounts.length && childAccounts.length > 0}
                    indeterminate={manageAccessChildren.length > 0 && manageAccessChildren.length < childAccounts.length}
                    onChange={handleSelectAllChildren}
                  />
                  <ListItemText primary="Select All" />
                </MenuItem>
                {childAccounts.map((child) => (
                  <MenuItem key={child.id} value={child.id}>
                    <Checkbox checked={manageAccessChildren.includes(child.id)} />
                    <ListItemText
                      primary={child.name || child.email}
                      secondary={child.email}
                    />
                  </MenuItem>
                ))}
              </Select>
              {manageAccessChildren.length > 0 && (
                <FormHelperText>
                  {manageAccessChildren.length} child account(s) selected
                </FormHelperText>
              )}
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowManageAccessDialog(false);
              setManageAccessChildren([]);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveManageAccess}
            variant="contained"
            disabled={submitting || childAccounts.length === 0}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;
