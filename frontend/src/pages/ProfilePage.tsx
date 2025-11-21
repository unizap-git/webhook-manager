import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
} from '@mui/material';
import {
  Lock as LockIcon,
  Refresh as RefreshIcon,
  SupervisorAccount as ParentIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

import { useAuthStore } from '../store/authStore';
import { apiCall } from '../api/client';
import { ProfileResponse, ChangePasswordResponse } from '../types/api';
import { useSnackbar } from 'notistack';
import { LRUCache } from '../utils/lruCache';
import {
  MessagesSentIcon,
  ConfigurationsIcon,
  ProjectsIcon,
  ChildAccountsIcon,
  SuccessRateIcon,
  DailyAverageIcon,
} from '../components/CustomIcons';

// LRU Cache with 20-minute TTL
interface CachedProfile {
  data: ProfileResponse;
  timestamp: number;
}

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { user } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const profileCache = useRef<LRUCache<string, CachedProfile>>(new LRUCache(5));
  const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

  const fetchProfile = async (bypassCache = false) => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = `profile-${user?.id}`;

      // Check cache
      if (!bypassCache && profileCache.current.has(cacheKey)) {
        const cached = profileCache.current.get(cacheKey)!;
        const age = Date.now() - cached.timestamp;

        if (age < CACHE_TTL) {
          setProfile(cached.data);
          setLoading(false);
          return;
        }
      }

      const data = await apiCall<ProfileResponse>('get', '/user/profile');
      setProfile(data);

      // Cache the data
      profileCache.current.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to load profile';
      setError(errorMessage);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      enqueueSnackbar('Please fill in all password fields', { variant: 'warning' });
      return;
    }

    if (newPassword !== confirmPassword) {
      enqueueSnackbar('New passwords do not match', { variant: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      enqueueSnackbar('Password must be at least 6 characters', { variant: 'error' });
      return;
    }

    try {
      setPasswordLoading(true);
      const response = await apiCall<ChangePasswordResponse>('post', '/user/change-password', {
        currentPassword,
        newPassword,
      });

      enqueueSnackbar(response.message || 'Password changed successfully', { variant: 'success' });
      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to change password';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !profile) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!profile) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        No profile data available
      </Alert>
    );
  }

  const joinDate = new Date(profile.user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const accountAge = Math.floor(
    (Date.now() - new Date(profile.user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Prepare chart data
  const usageChartData = profile.usageTrends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    messages: trend.count,
  }));

  // Stat cards config
  const statCards = [
    {
      title: 'Total Messages',
      value: profile.stats.totalMessages.toLocaleString(),
      icon: <MessagesSentIcon sx={{ fontSize: 32 }} />,
      color: 'primary',
    },
    {
      title: 'Active Configurations',
      value: profile.stats.activeConfigurations.toLocaleString(),
      icon: <ConfigurationsIcon sx={{ fontSize: 32 }} />,
      color: 'info',
    },
    {
      title: 'Projects',
      value: profile.stats.projectsCount.toLocaleString(),
      icon: <ProjectsIcon sx={{ fontSize: 32 }} />,
      color: 'secondary',
    },
    ...(profile.user.accountType === 'PARENT' ? [{
      title: 'Child Accounts',
      value: profile.stats.childAccountsCount.toLocaleString(),
      icon: <ChildAccountsIcon sx={{ fontSize: 32 }} />,
      color: 'warning',
    }] : []),
    {
      title: 'Success Rate',
      value: `${profile.stats.successRate.toFixed(1)}%`,
      icon: <SuccessRateIcon sx={{ fontSize: 32 }} />,
      color: 'success',
    },
    {
      title: 'Avg Daily Messages',
      value: profile.stats.avgDailyMessages.toLocaleString(),
      icon: <DailyAverageIcon sx={{ fontSize: 32 }} />,
      color: 'info',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'success';
      case 'read': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Profile
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<LockIcon />}
            onClick={() => setPasswordDialogOpen(true)}
            size="small"
          >
            Change Password
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchProfile(true)}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Enhanced User Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{
                    width: 96,
                    height: 96,
                    bgcolor: 'primary.main',
                    fontSize: '2.5rem',
                    mb: 2,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  }}
                >
                  {user?.name?.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="h5" gutterBottom textAlign="center">
                  {profile.user.name}
                </Typography>
                <Chip
                  label={profile.user.accountType}
                  color={profile.user.accountType === 'PARENT' ? 'primary' : 'secondary'}
                  size="small"
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {profile.user.email}
                </Typography>
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Member Since
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {joinDate}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {accountAge} days ago
                  </Typography>
                </Box>

                {profile.user.parent && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                        <ParentIcon fontSize="small" />
                        Parent Account
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {profile.user.parent.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {profile.user.parent.email}
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Statistics Cards */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {statCards.map((stat, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          backgroundColor: 'rgba(0, 0, 0, 0.03)',
                          display: 'flex',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        }}
                      >
                        {stat.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {stat.title}
                        </Typography>
                        <Typography variant="h5" fontWeight="bold">
                          {stat.value}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Usage Analytics Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Message Volume Trend (Last 30 Days)
            </Typography>
            {usageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={usageChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="messages" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                No usage data available
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Top Vendors */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Vendors Used
            </Typography>
            {profile.topVendors.length > 0 ? (
              <List dense>
                {profile.topVendors.map((vendor, index) => (
                  <ListItem key={vendor.vendorId} divider={index < profile.topVendors.length - 1}>
                    <ListItemIcon>
                      <Chip label={index + 1} size="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={vendor.vendorName}
                      secondary={`${vendor.messageCount.toLocaleString()} messages`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No vendor data available
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            {profile.recentActivity.length > 0 ? (
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {profile.recentActivity.map((activity, index) => (
                  <ListItem key={activity.id} divider={index < profile.recentActivity.length - 1}>
                    <ListItemIcon>
                      <Chip label={activity.status} size="small" color={getStatusColor(activity.status)} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${activity.vendor} → ${activity.recipient}`}
                      secondary={`${activity.channel} • ${new Date(activity.timestamp).toLocaleString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No recent activity
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Projects Quick View */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Projects
            </Typography>
            {profile.projects.length > 0 ? (
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {profile.projects.map((project, index) => (
                  <ListItem key={project.id} divider={index < profile.projects.length - 1}>
                    <ListItemText
                      primary={project.name}
                      secondary={`${project._count.messages.toLocaleString()} messages • ${project._count.userVendorChannels} configs`}
                    />
                    <IconButton size="small">
                      <ChevronRightIcon />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No projects yet
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Child Accounts Management (Parent Only) */}
        {profile.user.accountType === 'PARENT' && profile.childAccounts && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Child Accounts Management
              </Typography>
              {profile.childAccounts.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Project Access</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {profile.childAccounts.map((child) => (
                      <TableRow key={child.id}>
                        <TableCell>{child.name}</TableCell>
                        <TableCell>{child.email}</TableCell>
                        <TableCell>
                          <Chip label={`${child._count.projectAccess} projects`} size="small" />
                        </TableCell>
                        <TableCell>
                          {new Date(child.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  No child accounts created yet
                </Typography>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Current Password"
              type="password"
              fullWidth
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordLoading}
            />
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordLoading}
              helperText="Must be at least 6 characters"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordLoading}
              error={confirmPassword !== '' && newPassword !== confirmPassword}
              helperText={confirmPassword !== '' && newPassword !== confirmPassword ? 'Passwords do not match' : ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)} disabled={passwordLoading}>
            Cancel
          </Button>
          <Button onClick={handleChangePassword} variant="contained" disabled={passwordLoading}>
            {passwordLoading ? <CircularProgress size={24} /> : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfilePage;
