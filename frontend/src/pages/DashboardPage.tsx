import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress,
  Tooltip,
  Stack,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Schedule as ScheduleIcon,
  BarChart as BarChartIcon,
  DonutLarge as DonutLargeIcon,
  Timeline as TimelineIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useSnackbar } from 'notistack';
import { apiCall } from '../api/client';
import { DashboardStats, Project, Vendor, Channel } from '../types/api';
import { LRUCache } from '../utils/lruCache';
import { MessagesSentIcon, DeliveredIcon, ReadIcon, FailedIcon } from '../components/CustomIcons';

// Period options
const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '1d', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface CachedData {
  data: DashboardStats;
  timestamp: number;
  comparisonData?: DashboardStats;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  subtitle?: string;
  trend?: number;
  sparklineData?: number[];
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
  trend,
  sparklineData
}) => {
  const trendColor = trend && trend > 0 ? 'success.main' : trend && trend < 0 ? 'error.main' : 'text.secondary';
  const TrendIcon = trend && trend > 0 ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {icon}
          </Box>
          {trend !== undefined && trend !== 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', color: trendColor }}>
              <TrendIcon sx={{ fontSize: 20, mr: 0.5 }} />
              <Typography variant="body2" fontWeight="medium">
                {Math.abs(trend).toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>
        <Typography variant="h6" component="h3" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h3" component="div" sx={{ mb: 1, fontWeight: 'bold' }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        {sparklineData && sparklineData.length > 0 && (
          <Box sx={{ mt: 2, height: 40 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData.map((val, idx) => ({ value: val, index: idx }))}>
                <defs>
                  <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={COLORS[0]}
                  fill={`url(#gradient-${color})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [comparisonStats, setComparisonStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('7d');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const { enqueueSnackbar } = useSnackbar();

  // LRU cache with 1-minute TTL
  const dashboardCache = useRef<LRUCache<string, CachedData>>(new LRUCache(20));
  const CACHE_TTL = 60 * 1000; // 1 minute

  // Clear cache on unmount
  useEffect(() => {
    return () => {
      dashboardCache.current.clear();
    };
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats(true); // Bypass cache
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [autoRefresh, period, projectFilter, vendorFilter, channelFilter]);

  const getCacheKey = (p: string, proj: string, vend: string, chan: string) => {
    return `${p}-${proj}-${vend}-${chan}`;
  };

  const fetchStats = useCallback(async (bypassCache = false) => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = getCacheKey(period, projectFilter, vendorFilter, channelFilter);

      // Check cache first
      if (!bypassCache && dashboardCache.current.has(cacheKey)) {
        const cached = dashboardCache.current.get(cacheKey)!;
        const age = Date.now() - cached.timestamp;

        if (age < CACHE_TTL) {
          setStats(cached.data);
          if (cached.comparisonData) {
            setComparisonStats(cached.comparisonData);
          }
          setLoading(false);
          return;
        }
      }

      // Build query params
      const params = new URLSearchParams({ period });
      if (projectFilter !== 'all') params.append('projectId', projectFilter);
      if (vendorFilter !== 'all') params.append('vendorId', vendorFilter);
      if (channelFilter !== 'all') params.append('channelId', channelFilter);

      const data = await apiCall<DashboardStats>('get', `/analytics/dashboard?${params.toString()}`);
      setStats(data);
      setLastUpdated(new Date());

      // Fetch comparison data (previous period)
      const comparisonPeriod = getComparisonPeriod(period);
      if (comparisonPeriod) {
        try {
          const compParams = new URLSearchParams({ period: comparisonPeriod });
          if (projectFilter !== 'all') compParams.append('projectId', projectFilter);
          if (vendorFilter !== 'all') compParams.append('vendorId', vendorFilter);
          if (channelFilter !== 'all') compParams.append('channelId', channelFilter);

          const compData = await apiCall<DashboardStats>('get', `/analytics/dashboard?${compParams.toString()}`);
          setComparisonStats(compData);

          // Cache both datasets
          dashboardCache.current.set(cacheKey, {
            data,
            comparisonData: compData,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.log('Could not fetch comparison data:', err);
          dashboardCache.current.set(cacheKey, {
            data,
            timestamp: Date.now(),
          });
        }
      } else {
        dashboardCache.current.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to load dashboard stats';
      setError(errorMessage);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [period, projectFilter, vendorFilter, channelFilter, enqueueSnackbar]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await apiCall<{ projects: Project[] }>('get', '/projects');
      setProjects(response.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await apiCall<{ vendors: Vendor[] }>('get', '/vendors');
      setVendors(response.vendors || []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      const response = await apiCall<{ channels: Channel[] }>('get', '/vendors/channels');
      setChannels(response.channels || []);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchProjects();
    fetchVendors();
    fetchChannels();
  }, [fetchProjects, fetchVendors, fetchChannels]);

  const getComparisonPeriod = (currentPeriod: string): string | null => {
    const periodMap: Record<string, string> = {
      'today': 'yesterday',
      'yesterday': '1d',
      '1d': '1d',
      '7d': '7d',
      '30d': '30d',
      '90d': '90d',
    };
    return periodMap[currentPeriod] || null;
  };

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const handleExportCSV = () => {
    if (!stats) return;

    const csvData = [
      ['Metric', 'Value'],
      ['Total Messages', stats.summary.totalMessages],
      ['Total Sent', stats.summary.totalSent],
      ['Total Delivered', stats.summary.totalDelivered],
      ['Total Read', stats.summary.totalRead],
      ['Total Failed', stats.summary.totalFailed],
      ['Delivery Rate', `${stats.summary.deliveryRate.toFixed(2)}%`],
      ['Read Rate', `${stats.summary.readRate.toFixed(2)}%`],
      ['Failure Rate', `${stats.summary.failureRate.toFixed(2)}%`],
      [],
      ['Vendor Performance'],
      ['Vendor', 'Messages', 'Success Rate', 'Delivered', 'Read', 'Failed'],
      ...stats.vendorStats.map(v => [
        v.vendorName,
        v.totalMessages,
        `${v.successRate.toFixed(2)}%`,
        v.totalDelivered,
        v.totalRead,
        v.totalFailed,
      ]),
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${period}-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    enqueueSnackbar('Dashboard data exported successfully', { variant: 'success' });
  };

  // Prepare chart data
  const dailyChartData = stats?.dailyStats.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    messages: day.totalMessages,
    delivered: day.totalDelivered,
    read: day.totalRead,
    failed: day.totalFailed,
    successRate: day.successRate.toFixed(1),
  })) || [];

  const vendorChartData = stats?.vendorStats.slice(0, 5).map(vendor => ({
    name: vendor.vendorName.length > 15 ? vendor.vendorName.substring(0, 15) + '...' : vendor.vendorName,
    messages: vendor.totalMessages,
    successRate: vendor.successRate.toFixed(1),
    delivered: vendor.totalDelivered,
    read: vendor.totalRead,
    failed: vendor.totalFailed,
  })) || [];

  // Group messages by vendor for pie chart
  const pieChartData = stats?.vendorStats.slice(0, 6).map(vendor => ({
    name: vendor.vendorName,
    value: vendor.totalMessages,
  })) || [];

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !stats) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        No data available
      </Alert>
    );
  }

  const trends = comparisonStats ? {
    messages: calculateTrend(stats.summary.totalMessages, comparisonStats.summary.totalMessages),
    delivered: calculateTrend(stats.summary.totalDelivered, comparisonStats.summary.totalDelivered),
    read: calculateTrend(stats.summary.totalRead, comparisonStats.summary.totalRead),
    failed: calculateTrend(stats.summary.totalFailed, comparisonStats.summary.totalFailed),
  } : undefined;

  const sparklineMessages = stats.dailyStats.map(d => d.totalMessages);
  const sparklineDelivered = stats.dailyStats.map(d => d.totalDelivered);
  const sparklineRead = stats.dailyStats.map(d => d.totalRead);
  const sparklineFailed = stats.dailyStats.map(d => d.totalFailed);

  return (
    <Box>
      {/* Header with Filters */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={`Last updated: ${lastUpdated.toLocaleTimeString()}`}>
              <Chip
                icon={<ScheduleIcon />}
                label={lastUpdated.toLocaleTimeString()}
                size="small"
                variant="outlined"
              />
            </Tooltip>
            <Tooltip title="Auto-refresh every 5 minutes">
              <Chip
                label={autoRefresh ? 'Auto ON' : 'Auto OFF'}
                size="small"
                color={autoRefresh ? 'success' : 'default'}
                onClick={() => setAutoRefresh(!autoRefresh)}
              />
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => fetchStats(true)}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportCSV}
              size="small"
            >
              Export
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FilterIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIOD_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Project</InputLabel>
            <Select
              value={projectFilter}
              label="Project"
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <MenuItem value="all">All Projects</MenuItem>
              {projects.map(project => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Vendor</InputLabel>
            <Select
              value={vendorFilter}
              label="Vendor"
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <MenuItem value="all">All Vendors</MenuItem>
              {vendors.map(vendor => (
                <MenuItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Channel</InputLabel>
            <Select
              value={channelFilter}
              label="Channel"
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <MenuItem value="all">All Channels</MenuItem>
              {channels.map(channel => (
                <MenuItem key={channel.id} value={channel.id}>
                  {channel.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {/* Failure Alert */}
      {stats.summary.failureRate > 10 && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="medium">
            High failure rate detected: {stats.summary.failureRate.toFixed(1)}%
          </Typography>
          <Typography variant="caption">
            {stats.summary.totalFailed} messages failed out of {stats.summary.totalMessages} total
          </Typography>
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Messages"
            value={stats.summary.totalMessages.toLocaleString()}
            icon={<MessagesSentIcon sx={{ fontSize: 32 }} />}
            color="primary"
            trend={trends?.messages}
            sparklineData={sparklineMessages}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Delivered"
            value={stats.summary.totalDelivered.toLocaleString()}
            icon={<DeliveredIcon sx={{ fontSize: 32 }} />}
            color="success"
            subtitle={`${stats.summary.deliveryRate.toFixed(1)}% delivery rate`}
            trend={trends?.delivered}
            sparklineData={sparklineDelivered}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Read"
            value={stats.summary.totalRead.toLocaleString()}
            icon={<ReadIcon sx={{ fontSize: 32 }} />}
            color="info"
            subtitle={`${stats.summary.readRate.toFixed(1)}% read rate`}
            trend={trends?.read}
            sparklineData={sparklineRead}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed"
            value={stats.summary.totalFailed.toLocaleString()}
            icon={<FailedIcon sx={{ fontSize: 32 }} />}
            color="error"
            subtitle={`${stats.summary.failureRate.toFixed(1)}% failure rate`}
            trend={trends?.failed}
            sparklineData={sparklineFailed}
          />
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Daily Trends Line Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TimelineIcon sx={{ mr: 1 }} color="primary" />
              <Typography variant="h6">Daily Message Trends</Typography>
            </Box>
            {dailyChartData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No daily trend data available
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="messages" stroke="#8884d8" strokeWidth={2} name="Total" />
                  <Line type="monotone" dataKey="delivered" stroke="#82ca9d" strokeWidth={2} name="Delivered" />
                  <Line type="monotone" dataKey="read" stroke="#ffc658" strokeWidth={2} name="Read" />
                  <Line type="monotone" dataKey="failed" stroke="#ff7c7c" strokeWidth={2} name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Vendor Distribution Pie Chart */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DonutLargeIcon sx={{ mr: 1 }} color="primary" />
              <Typography variant="h6">Vendor Distribution</Typography>
            </Box>
            {pieChartData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No vendor data available
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Vendor Performance Bar Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BarChartIcon sx={{ mr: 1 }} color="primary" />
              <Typography variant="h6">Vendor Performance Comparison</Typography>
            </Box>
            {vendorChartData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No vendor performance data available
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="delivered" fill="#82ca9d" name="Delivered" />
                  <Bar yAxisId="left" dataKey="read" fill="#ffc658" name="Read" />
                  <Bar yAxisId="left" dataKey="failed" fill="#ff7c7c" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Vendor Performance Cards */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <BarChartIcon sx={{ mr: 1 }} color="primary" />
          Vendor Performance Details
        </Typography>
        <Grid container spacing={3}>
          {stats.vendorStats.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No vendor data available for the selected period
                </Typography>
              </Paper>
            </Grid>
          ) : (
            stats.vendorStats.map((vendor) => (
              <Grid item xs={12} sm={6} md={4} key={vendor.vendorId}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {vendor.vendorName}
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h4" color="primary.main">
                        {vendor.totalMessages.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total Messages
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Success Rate</Typography>
                        <Typography variant="body2" fontWeight="medium" color="success.main">
                          {vendor.successRate.toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={vendor.successRate}
                        color="success"
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>

                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Delivered
                        </Typography>
                        <Chip
                          label={vendor.totalDelivered.toLocaleString()}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Read
                        </Typography>
                        <Chip
                          label={vendor.totalRead.toLocaleString()}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Failed
                        </Typography>
                        <Chip
                          label={vendor.totalFailed.toLocaleString()}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </Box>
    </Box>
  );
};

export default DashboardPage;
