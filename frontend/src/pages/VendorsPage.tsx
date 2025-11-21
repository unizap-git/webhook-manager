import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Grid,
  Paper,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Business as ProjectIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';

import { apiCall } from '../api/client';
import { Vendor, Channel, UserVendorChannel } from '../types/api';
import { LRUCache } from '../utils/lruCache';

interface AddConfigFormData {
  vendorId: string;
  channelId: string;
  projectId: string;
  webhookSecret?: string;
}

const VendorsPage: React.FC = () => {
  const [configs, setConfigs] = useState<UserVendorChannel[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfigId, setDeleteConfigId] = useState<string>('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // LRU caches to prevent memory leaks (max 20 entries each)
  const vendorsCache = React.useRef<LRUCache<string, Vendor[]>>(new LRUCache(20));
  const channelsCache = React.useRef<LRUCache<string, Channel[]>>(new LRUCache(20));
  const projectsCache = React.useRef<LRUCache<string, any[]>>(new LRUCache(20));

  const { enqueueSnackbar } = useSnackbar();

  // Clear caches on unmount
  useEffect(() => {
    return () => {
      vendorsCache.current.clear();
      channelsCache.current.clear();
      projectsCache.current.clear();
    };
  }, []);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AddConfigFormData>();

  // Watch the selected vendor to conditionally show webhook secret field
  const selectedVendorId = watch('vendorId');
  const selectedVendor = vendors.find(v => v.id === selectedVendorId);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (bypassCache = false) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch vendors with 30-minute cache
      let vendorsData: Vendor[];
      const vendorsCacheKey = 'vendors';
      if (!bypassCache && vendorsCache.current.has(vendorsCacheKey)) {
        vendorsData = vendorsCache.current.get(vendorsCacheKey)!;
      } else {
        const response = await apiCall<{ vendors: Vendor[] }>('get', '/vendors');
        vendorsData = response.vendors;
        vendorsCache.current.set(vendorsCacheKey, vendorsData);
      }

      // Fetch channels with 30-minute cache
      let channelsData: Channel[];
      const channelsCacheKey = 'channels';
      if (!bypassCache && channelsCache.current.has(channelsCacheKey)) {
        channelsData = channelsCache.current.get(channelsCacheKey)!;
      } else {
        const response = await apiCall<{ channels: Channel[] }>('get', '/vendors/channels');
        channelsData = response.channels;
        channelsCache.current.set(channelsCacheKey, channelsData);
      }

      // Fetch projects with cache
      let projectsData: any[];
      const projectsCacheKey = 'projects';
      if (!bypassCache && projectsCache.current.has(projectsCacheKey)) {
        projectsData = projectsCache.current.get(projectsCacheKey)!;
      } else {
        const response = await apiCall<{ projects: any[] }>('get', '/projects');
        projectsData = response.projects;
        projectsCache.current.set(projectsCacheKey, projectsData);
      }

      // Always fetch configs fresh (they change frequently)
      const configsResponse = await apiCall<{ configs: UserVendorChannel[] }>('get', '/vendors/user-configs');

      setConfigs(configsResponse.configs);
      setVendors(vendorsData);
      setChannels(channelsData);
      setProjects(projectsData);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to load data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConfig = async (data: AddConfigFormData) => {
    try {
      setAddLoading(true);
      
      const response = await apiCall<{ config: UserVendorChannel }>('post', '/vendors/user-configs', data);
      
      setConfigs((prev) => [...prev, response.config]);
      setDialogOpen(false);
      reset();
      
      enqueueSnackbar('Vendor configuration added successfully!', { variant: 'success' });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to add configuration';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteClick = (configId: string) => {
    setDeleteConfigId(configId);
    setDeleteConfirmText('');
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete config') {
      enqueueSnackbar('Please type "delete config" to confirm', { variant: 'error' });
      return;
    }

    try {
      await apiCall('delete', `/vendors/user-configs/${deleteConfigId}`);

      setConfigs((prev) => prev.filter((config) => config.id !== deleteConfigId));
      setShowDeleteDialog(false);
      setDeleteConfirmText('');

      enqueueSnackbar('Configuration removed successfully!', { variant: 'success' });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to remove configuration';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  const handleCopyWebhookUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      enqueueSnackbar('Webhook URL copied to clipboard!', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to copy to clipboard', { variant: 'error' });
    }
  };

  // Filter configs based on search query
  const filteredConfigs = configs.filter((config) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      config.vendor.name.toLowerCase().includes(query) ||
      config.channel.name.toLowerCase().includes(query) ||
      config.project?.name?.toLowerCase().includes(query) ||
      config.webhookUrl.toLowerCase().includes(query)
    );
  });

  // Group configs by project
  const configsByProject = filteredConfigs.reduce((acc, config) => {
    const projectId = config.project?.id || 'unknown';
    const projectName = config.project?.name || 'Unknown Project';

    if (!acc[projectId]) {
      acc[projectId] = {
        projectName,
        configs: [],
      };
    }
    acc[projectId].configs.push(config);
    return acc;
  }, {} as Record<string, { projectName: string; configs: UserVendorChannel[] }>);

  // Calculate statistics
  const stats = {
    totalConfigs: configs.length,
    vendorCounts: configs.reduce((acc, config) => {
      acc[config.vendor.name] = (acc[config.vendor.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    channelCounts: configs.reduce((acc, config) => {
      acc[config.channel.name] = (acc[config.channel.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    projectCounts: configs.reduce((acc, config) => {
      const projectName = config.project?.name || 'Unknown';
      acc[projectName] = (acc[projectName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const topVendors = Object.entries(stats.vendorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const topChannels = Object.entries(stats.channelCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Vendors & Channels
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchData(true)}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Add Configuration
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Card */}
      {configs.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BarChartIcon sx={{ mr: 1 }} color="primary" />
              <Typography variant="h6">Configuration Statistics</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">
                  Total Configurations
                </Typography>
                <Typography variant="h4">{stats.totalConfigs}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Top Vendors
                </Typography>
                {topVendors.map(([vendor, count]) => (
                  <Box key={vendor} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{vendor}</Typography>
                    <Chip label={count} size="small" />
                  </Box>
                ))}
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Top Channels
                </Typography>
                {topChannels.map(([channel, count]) => (
                  <Box key={channel} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{channel}</Typography>
                    <Chip label={count} size="small" color="primary" />
                  </Box>
                ))}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      {configs.length > 0 && (
        <TextField
          fullWidth
          placeholder="Search by vendor, channel, or project..."
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
          sx={{ mb: 3 }}
        />
      )}

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Configure webhook URLs for your communication vendors and channels.
      </Typography>

      {configs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No configurations yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add your first vendor-channel configuration to start receiving webhooks.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Add Configuration
          </Button>
        </Paper>
      ) : filteredConfigs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No configurations match your search
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search query
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Group by Project - Accordions */}
          {Object.entries(configsByProject).map(([projectId, { projectName, configs: projectConfigs }]) => {
            // Paginate configs within each project
            const paginatedConfigs = projectConfigs.slice(
              page * rowsPerPage,
              page * rowsPerPage + rowsPerPage
            );

            return (
              <Accordion key={projectId} defaultExpanded sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ProjectIcon color="primary" />
                    <Typography variant="h6">{projectName}</Typography>
                    <Chip label={`${projectConfigs.length} config${projectConfigs.length !== 1 ? 's' : ''}`} size="small" />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {paginatedConfigs.map((config) => (
                      <Grid item xs={12} md={6} lg={4} key={config.id}>
                        <Card>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" gutterBottom>
                                  {config.vendor.name}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  <Chip
                                    label={config.channel.name}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                </Box>
                              </Box>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(config.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>

                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Webhook URL:
                            </Typography>

                            <Box
                              sx={{
                                p: 2,
                                bgcolor: 'grey.100',
                                borderRadius: 1,
                                mb: 2,
                                wordBreak: 'break-all',
                                fontSize: '0.875rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {config.webhookUrl}
                            </Box>

                            <Button
                              fullWidth
                              variant="outlined"
                              startIcon={<CopyIcon />}
                              onClick={() => handleCopyWebhookUrl(config.webhookUrl)}
                            >
                              Copy URL
                            </Button>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Pagination for this project */}
                  {projectConfigs.length > rowsPerPage && (
                    <TablePagination
                      rowsPerPageOptions={[12, 24, 48]}
                      component="div"
                      count={projectConfigs.length}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={(_, newPage) => setPage(newPage)}
                      onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(0);
                      }}
                    />
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </>
      )}

      {/* Add Configuration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleAddConfig)}>
          <DialogTitle>Add Vendor Configuration</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
              <Controller
                name="projectId"
                control={control}
                rules={{ required: 'Please select a project' }}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.projectId}>
                    <InputLabel>Project</InputLabel>
                    <Select {...field} label="Project">
                      {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="vendorId"
                control={control}
                rules={{ required: 'Please select a vendor' }}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.vendorId}>
                    <InputLabel>Vendor</InputLabel>
                    <Select {...field} label="Vendor">
                      {vendors.map((vendor) => (
                        <MenuItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="channelId"
                control={control}
                rules={{ required: 'Please select a channel' }}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.channelId}>
                    <InputLabel>Channel</InputLabel>
                    <Select {...field} label="Channel">
                      {channels.map((channel) => (
                        <MenuItem key={channel.id} value={channel.id}>
                          {channel.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              {/* Show webhook secret field for AiSensy */}
              {selectedVendor?.slug === 'aisensy' && (
                <Controller
                  name="webhookSecret"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Webhook Secret (Optional)"
                      type="password"
                      helperText="Required for webhook signature verification. Get this from your AiSensy webhook configuration."
                      error={!!errors.webhookSecret}
                    />
                  )}
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={addLoading}
            >
              {addLoading ? 'Adding...' : 'Add Configuration'}
            </Button>
          </DialogActions>
        </form>
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
        <DialogTitle>Confirm Configuration Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to delete this configuration? This action cannot be undone.
            The webhook URL will stop receiving events immediately.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2, fontWeight: 'bold' }}>
            Please type "delete config" to confirm:
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Type 'delete config' to confirm"
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
            disabled={deleteConfirmText.toLowerCase() !== 'delete config'}
          >
            Delete Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorsPage;