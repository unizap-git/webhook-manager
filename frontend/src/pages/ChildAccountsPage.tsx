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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';

import { apiCall } from '../api/client';
import { 
  ChildAccount, 
  CreateChildAccountResponse, 
  GetChildAccountsResponse 
} from '../types/api';

const createChildSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

type CreateChildFormData = z.infer<typeof createChildSchema>;

const ChildAccountsPage: React.FC = () => {
  const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newChildPassword, setNewChildPassword] = useState<string>('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  const { enqueueSnackbar } = useSnackbar();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateChildFormData>({
    resolver: zodResolver(createChildSchema),
  });

  const fetchChildAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await apiCall<GetChildAccountsResponse>('get', '/user/child-accounts');
      setChildAccounts(response.childAccounts);
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
      const response = await apiCall<CreateChildAccountResponse>('post', '/user/child-accounts', data);
      
      setNewChildPassword(response.childAccount.password || '');
      setShowPasswordDialog(true);
      setIsCreateDialogOpen(false);
      reset();
      
      // Refresh the list
      await fetchChildAccounts();
      
      enqueueSnackbar('Child account created successfully', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to create child account', { 
        variant: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!window.confirm('Are you sure you want to delete this child account?')) {
      return;
    }

    try {
      await apiCall('delete', `/user/child-accounts/${childId}`);
      await fetchChildAccounts();
      enqueueSnackbar('Child account deleted successfully', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'Failed to delete child account', { 
        variant: 'error' 
      });
    }
  };

  const handleResetPassword = async (childId: string) => {
    if (!window.confirm('Are you sure you want to reset this child account password?')) {
      return;
    }

    try {
      const response = await apiCall<{ newPassword: string }>('post', `/user/child-accounts/${childId}/reset-password`);
      setNewChildPassword(response.newPassword);
      setShowPasswordDialog(true);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    fetchChildAccounts();
  }, []);

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
            onClick={fetchChildAccounts}
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
                      <TableCell>{formatDate(child.createdAt)}</TableCell>
                      <TableCell>
                        <Chip 
                          label="Active" 
                          color="success" 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell align="right">
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
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit(handleCreateChild)}
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Account'}
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
    </Box>
  );
};

export default ChildAccountsPage;