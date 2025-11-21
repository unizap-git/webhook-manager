import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  IconButton,
  Alert,
  Chip,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  ListItemText,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
  ContentCopy as CopyIcon,
  Business as ProjectIcon,
  ManageAccounts as ManageAccountsIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';

import { apiCall } from '../api/client';
import {
  ChildAccount,
  CreateChildAccountResponse,
  GetChildAccountsResponse,
  Project
} from '../types/api';
import { LRUCache } from '../utils/lruCache';

interface CreateChildFormData {
  email: string;
  name?: string;
  projectIds: string[];
}

const createChildSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  projectIds: z.array(z.string()).min(1, 'Please select at least one project'),
});

const ChildAccountsPage: React.FC = () => {
  const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newChildPassword, setNewChildPassword] = useState<string>('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
  const [resetChildId, setResetChildId] = useState<string>('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deleteChildId, setDeleteChildId] = useState<string>('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showManageAccessDialog, setShowManageAccessDialog] = useState(false);
  const [manageAccessChildId, setManageAccessChildId] = useState<string>('');
  const [manageAccessProjects, setManageAccessProjects] = useState<string[]>([]);

  // LRU caches to prevent memory leaks (max 20 entries each)
  const childAccountsCache = React.useRef<LRUCache<string, ChildAccount[]>>(new LRUCache(20));
  const projectsCache = React.useRef<LRUCache<string, Project[]>>(new LRUCache(20));

  const { enqueueSnackbar } = useSnackbar();

  // Clear caches on unmount
  useEffect(() => {
    return () => {
      childAccountsCache.current.clear();
      projectsCache.current.clear();
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateChildFormData>({
    resolver: zodResolver(createChildSchema),
    defaultValues: {
      projectIds: [],
    },
  });

  useEffect(() => {
    fetchChildAccounts();
    fetchProjects();
  }, []);

  useEffect(() => {
    setValue('projectIds', selectedProjects);
  }, [selectedProjects, setValue]);

  const fetchProjects = async (bypassCache = false) => {
    try {
      const cacheKey = 'projects';

      // Check cache first (unless bypassing)
      if (!bypassCache && projectsCache.current.has(cacheKey)) {
        const cachedProjects = projectsCache.current.get(cacheKey)!;
        setProjects(cachedProjects);
        return;
      }

      const response = await apiCall<{ projects: Project[] }>('get', '/projects');
      const fetchedProjects = response.projects || [];

      // Store in cache
      projectsCache.current.set(cacheKey, fetchedProjects);
      setProjects(fetchedProjects);
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to fetch projects', {
        variant: 'error'
      });
    }
  };

  const fetchChildAccounts = async (bypassCache = false) => {
    try {
      setIsLoading(true);
      const cacheKey = 'childAccounts';

      // Check cache first (unless bypassing)
      if (!bypassCache && childAccountsCache.current.has(cacheKey)) {
        const cachedAccounts = childAccountsCache.current.get(cacheKey)!;
        setChildAccounts(cachedAccounts);
        setIsLoading(false);
        return;
      }

      const response = await apiCall<GetChildAccountsResponse>('get', '/user/child-accounts');
      const fetchedAccounts = response.childAccounts;

      // Store in cache
      childAccountsCache.current.set(cacheKey, fetchedAccounts);
      setChildAccounts(fetchedAccounts);
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to fetch child accounts', {
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChild = async (data: CreateChildFormData) => {
    try {
      setIsLoading(true);

      // Create the child account
      const response = await apiCall<CreateChildAccountResponse>('post', '/user/child-accounts', {
        email: data.email,
        name: data.name,
      });

      // Grant access to selected projects using batch endpoint (single API call)
      if (data.projectIds && data.projectIds.length > 0) {
        await apiCall('post', '/projects/batch-access', {
          childUserId: response.childAccount.id,
          projectIds: data.projectIds,
        });
      }

      setNewChildPassword(response.childAccount.password || '');
      setShowPasswordDialog(true);
      setIsCreateDialogOpen(false);
      setSelectedProjects([]);
      reset();

      // Refresh the list (bypass cache to get fresh data)
      await fetchChildAccounts(true);

      enqueueSnackbar(`Child account created with access to ${data.projectIds.length} project(s)`, { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to create child account', {
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChild = (childId: string) => {
    setDeleteChildId(childId);
    setDeleteConfirmText('');
    setShowDeleteConfirmDialog(true);
  };

  const handleConfirmDeleteChild = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete account') {
      enqueueSnackbar('Please type "delete account" to confirm', { variant: 'error' });
      return;
    }

    try {
      await apiCall('delete', `/user/child-accounts/${deleteChildId}`);
      await fetchChildAccounts(true);
      setShowDeleteConfirmDialog(false);
      setDeleteConfirmText('');
      enqueueSnackbar('Child account deleted successfully', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to delete child account', {
        variant: 'error'
      });
    }
  };

  const handleResetPassword = (childId: string) => {
    setResetChildId(childId);
    setResetConfirmText('');
    setShowResetConfirmDialog(true);
  };

  const handleConfirmResetPassword = async () => {
    if (resetConfirmText.toLowerCase() !== 'change password') {
      enqueueSnackbar('Please type "change password" to confirm', { variant: 'error' });
      return;
    }

    try {
      const response = await apiCall<{ newPassword: string }>('post', `/user/child-accounts/${resetChildId}/reset-password`);
      setNewChildPassword(response.newPassword);
      setShowPasswordDialog(true);
      setShowResetConfirmDialog(false);
      setResetConfirmText('');
      enqueueSnackbar('Password reset successfully', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to reset password', { 
        variant: 'error' 
      });
    }
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(newChildPassword);
      enqueueSnackbar('Password copied to clipboard', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to copy password', { variant: 'error' });
    }
  };

  const handleManageAccess = (child: ChildAccount) => {
    setManageAccessChildId(child.id);
    const currentProjectIds = child.projectAccess?.map(pa => pa.projectId) || [];
    setManageAccessProjects(currentProjectIds);
    setShowManageAccessDialog(true);
  };

  const handleSaveManageAccess = async () => {
    try {
      setIsLoading(true);

      // Use batch endpoint to update all project access at once
      if (manageAccessProjects.length > 0) {
        await apiCall('post', '/projects/batch-access', {
          childUserId: manageAccessChildId,
          projectIds: manageAccessProjects,
        });
      }

      // Remove access from projects that were deselected
      const child = childAccounts.find(c => c.id === manageAccessChildId);
      const currentProjectIds = child?.projectAccess?.map(pa => pa.projectId) || [];
      const removedProjects = currentProjectIds.filter(id => !manageAccessProjects.includes(id));

      for (const projectId of removedProjects) {
        await apiCall('delete', `/projects/${projectId}/access/${manageAccessChildId}`);
      }

      setShowManageAccessDialog(false);
      setManageAccessProjects([]);
      await fetchChildAccounts(true);
      enqueueSnackbar('Project access updated successfully', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to update project access', {
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAllProjects = () => {
    if (selectedProjects.length === projects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(projects.map(p => p.id));
    }
  };

  const handleSelectAllManageProjects = () => {
    if (manageAccessProjects.length === projects.length) {
      setManageAccessProjects([]);
    } else {
      setManageAccessProjects(projects.map(p => p.id));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Child Accounts
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              fetchChildAccounts(true);
              fetchProjects(true);
            }}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Create Child Account
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Child accounts can only access the Analytics page and see all parent data. 
        Only parent accounts can manage child account passwords and access.
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Child Accounts ({childAccounts.length})
          </Typography>
          
          {childAccounts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No child accounts created yet. Create one to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Project Access</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {childAccounts.map((child) => (
                    <TableRow key={child.id}>
                      <TableCell>{child.email}</TableCell>
                      <TableCell>{child.name || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {child.projectAccess && child.projectAccess.length > 0 ? (
                            child.projectAccess.map((pa) => (
                              <Chip
                                key={pa.projectId}
                                label={pa.project.name}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No access
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(child.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label="Active"
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Manage Project Access">
                          <IconButton
                            onClick={() => handleManageAccess(child)}
                            size="small"
                            color="info"
                          >
                            <ManageAccountsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset Password">
                          <IconButton
                            onClick={() => handleResetPassword(child.id)}
                            size="small"
                            color="primary"
                          >
                            <KeyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Account">
                          <IconButton
                            onClick={() => handleDeleteChild(child.id)}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Child Account Dialog */}
      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Child Account</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Create a new child account that will have analytics-only access.
            Select which projects the child account can access.
            A secure password will be generated automatically.
          </DialogContentText>
          <Box component="form" onSubmit={handleSubmit(handleCreateChild)}>
            <TextField
              {...register('email')}
              autoFocus
              margin="dense"
              label="Email Address"
              type="email"
              fullWidth
              variant="outlined"
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={{ mb: 2 }}
            />
            <TextField
              {...register('name')}
              margin="dense"
              label="Name (Optional)"
              type="text"
              fullWidth
              variant="outlined"
              error={!!errors.name}
              helperText={errors.name?.message}
              sx={{ mb: 2 }}
            />
            
            {/* Project Selection */}
            <FormControl 
              fullWidth 
              margin="dense"
              error={!!errors.projectIds}
            >
              <InputLabel id="project-select-label">
                <Box display="flex" alignItems="center">
                  <ProjectIcon sx={{ mr: 0.5 }} fontSize="small" />
                  Select Projects *
                </Box>
              </InputLabel>
              <Select
                labelId="project-select-label"
                multiple
                value={selectedProjects}
                onChange={(e) => setSelectedProjects(e.target.value as string[])}
                label={
                  <Box display="flex" alignItems="center">
                    <ProjectIcon sx={{ mr: 0.5 }} fontSize="small" />
                    Select Projects *
                  </Box>
                }
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const project = projects.find(p => p.id === value);
                      return (
                        <Chip key={value} label={project?.name || value} size="small" />
                      );
                    })}
                  </Box>
                )}
              >
                <MenuItem>
                  <Checkbox
                    checked={selectedProjects.length === projects.length && projects.length > 0}
                    indeterminate={selectedProjects.length > 0 && selectedProjects.length < projects.length}
                    onChange={handleSelectAllProjects}
                  />
                  <ListItemText primary="Select All" />
                </MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    <Checkbox checked={selectedProjects.includes(project.id)} />
                    <ListItemText 
                      primary={project.name}
                      secondary={project.description}
                    />
                  </MenuItem>
                ))}
              </Select>
              {errors.projectIds && (
                <FormHelperText>{errors.projectIds.message}</FormHelperText>
              )}
              {selectedProjects.length === 0 && !errors.projectIds && (
                <FormHelperText>
                  Child account will have access to selected projects only
                </FormHelperText>
              )}
              {selectedProjects.length > 0 && (
                <FormHelperText>
                  {selectedProjects.length} project(s) selected
                </FormHelperText>
              )}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setIsCreateDialogOpen(false);
            setSelectedProjects([]);
            reset();
          }}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              // Validate that projects are selected
              if (selectedProjects.length === 0) {
                setValue('projectIds', []);
                return;
              }
              setValue('projectIds', selectedProjects);
              handleSubmit(handleCreateChild)();
            }}
            variant="contained"
            disabled={isLoading || selectedProjects.length === 0}
          >
            {isLoading ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Confirmation Dialog */}
      <Dialog 
        open={showResetConfirmDialog} 
        onClose={() => {
          setShowResetConfirmDialog(false);
          setResetConfirmText('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Password Reset</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to reset this child account password? This action cannot be undone.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2, fontWeight: 'bold' }}>
            Please type "change password" to confirm:
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Type 'change password' to confirm"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowResetConfirmDialog(false);
              setResetConfirmText('');
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmResetPassword}
            variant="contained"
            color="error"
            disabled={resetConfirmText.toLowerCase() !== 'change password'}
          >
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Display Dialog */}
      <Dialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Child Account Password</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Please save this password securely. It will not be shown again.
          </Alert>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '1.1rem'
          }}>
            <Box sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
              {newChildPassword}
            </Box>
            <IconButton onClick={handleCopyPassword} size="small" color="primary">
              <CopyIcon />
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowPasswordDialog(false)}
            variant="contained"
          >
            I've Saved the Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirmDialog}
        onClose={() => {
          setShowDeleteConfirmDialog(false);
          setDeleteConfirmText('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Account Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to delete this child account? This action cannot be undone.
            All project access will be revoked.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2, fontWeight: 'bold' }}>
            Please type "delete account" to confirm:
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Type 'delete account' to confirm"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowDeleteConfirmDialog(false);
              setDeleteConfirmText('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteChild}
            variant="contained"
            color="error"
            disabled={deleteConfirmText.toLowerCase() !== 'delete account'}
          >
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Project Access Dialog */}
      <Dialog
        open={showManageAccessDialog}
        onClose={() => {
          setShowManageAccessDialog(false);
          setManageAccessProjects([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manage Project Access</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select which projects this child account can access.
          </DialogContentText>
          <FormControl fullWidth margin="dense">
            <InputLabel id="manage-access-label">
              <Box display="flex" alignItems="center">
                <ProjectIcon sx={{ mr: 0.5 }} fontSize="small" />
                Select Projects
              </Box>
            </InputLabel>
            <Select
              labelId="manage-access-label"
              multiple
              value={manageAccessProjects}
              onChange={(e) => setManageAccessProjects(e.target.value as string[])}
              label={
                <Box display="flex" alignItems="center">
                  <ProjectIcon sx={{ mr: 0.5 }} fontSize="small" />
                  Select Projects
                </Box>
              }
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const project = projects.find(p => p.id === value);
                    return (
                      <Chip key={value} label={project?.name || value} size="small" />
                    );
                  })}
                </Box>
              )}
            >
              <MenuItem>
                <Checkbox
                  checked={manageAccessProjects.length === projects.length && projects.length > 0}
                  indeterminate={manageAccessProjects.length > 0 && manageAccessProjects.length < projects.length}
                  onChange={handleSelectAllManageProjects}
                />
                <ListItemText primary="Select All" />
              </MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  <Checkbox checked={manageAccessProjects.includes(project.id)} />
                  <ListItemText
                    primary={project.name}
                    secondary={project.description}
                  />
                </MenuItem>
              ))}
            </Select>
            {manageAccessProjects.length > 0 && (
              <FormHelperText>
                {manageAccessProjects.length} project(s) selected
              </FormHelperText>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowManageAccessDialog(false);
              setManageAccessProjects([]);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveManageAccess}
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChildAccountsPage;