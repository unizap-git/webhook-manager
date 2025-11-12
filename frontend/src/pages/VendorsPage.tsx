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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';

import { apiCall } from '../api/client';
import { Vendor, Channel, UserVendorChannel } from '../types/api';

interface AddConfigFormData {
  vendorId: string;
  channelId: string;
}

const VendorsPage: React.FC = () => {
  const [configs, setConfigs] = useState<UserVendorChannel[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddConfigFormData>();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [configsData, vendorsData, channelsData] = await Promise.all([
        apiCall<{ configs: UserVendorChannel[] }>('get', '/vendors/user-configs'),
        apiCall<{ vendors: Vendor[] }>('get', '/vendors'),
        apiCall<{ channels: Channel[] }>('get', '/channels'),
      ]);

      setConfigs(configsData.configs);
      setVendors(vendorsData.vendors);
      setChannels(channelsData.channels);
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

  const handleRemoveConfig = async (configId: string) => {
    try {
      await apiCall('delete', `/vendors/user-configs/${configId}`);
      
      setConfigs((prev) => prev.filter((config) => config.id !== configId));
      
      enqueueSnackbar('Configuration removed successfully!', { variant: 'success' });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to remove configuration';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  const handleCopyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    enqueueSnackbar('Webhook URL copied to clipboard!', { variant: 'success' });
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Vendors & Channels
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Configuration
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
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
      ) : (
        <Grid container spacing={3}>
          {configs.map((config) => (
            <Grid item xs={12} md={6} lg={4} key={config.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {config.vendor.name}
                      </Typography>
                      <Chip
                        label={config.channel.name}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveConfig(config.id)}
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
      )}

      {/* Add Configuration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(handleAddConfig)}>
          <DialogTitle>Add Vendor Configuration</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
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
    </Box>
  );
};

export default VendorsPage;