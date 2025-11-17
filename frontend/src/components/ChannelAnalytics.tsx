import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore,
  Sms,
  WhatsApp,
  TrendingUp,
  Error,
} from '@mui/icons-material';
import { apiCall } from '../api/client';

interface VendorStat {
  vendor: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  total: number;
  successRate: number;
}

interface DailyStat {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  total: number;
  successRate: number;
}

interface ChannelStat {
  channel: string;
  totalMessages: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  vendors: VendorStat[];
  events: Array<{ eventName: string; count: number }>;
  failureReasons: Array<{ reason: string; count: number }>;
  dailyStats: DailyStat[];
}

interface ChannelAnalyticsData {
  channelStats: ChannelStat[];
  summary: {
    totalChannels: number;
    totalMessages: number;
  };
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

const ChannelAnalytics: React.FC = () => {
  const [data, setData] = useState<ChannelAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');

  const fetchData = async (selectedPeriod: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiCall<ChannelAnalyticsData>('get', `/analytics/channels?period=${selectedPeriod}`);
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch channel analytics');
      console.error('Error fetching channel analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period]);

  const handlePeriodChange = (event: any) => {
    const newPeriod = event.target.value;
    setPeriod(newPeriod);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'sms':
        return <Sms color="primary" />;
      case 'whatsapp':
        return <WhatsApp color="success" />;
      default:
        return <TrendingUp />;
    }
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No channel analytics data available.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Channel Performance Analysis
        </Typography>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select value={period} label="Period" onChange={handlePeriodChange}>
            <MenuItem value="1d">Last Day</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Active Channels
              </Typography>
              <Typography variant="h6">
                {data.summary.totalChannels}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Messages
              </Typography>
              <Typography variant="h6">
                {data.summary.totalMessages}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Channel Performance Cards */}
      <Grid container spacing={3} mb={3}>
        {data.channelStats.map((channel, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  {getChannelIcon(channel.channel)}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {channel.channel.toUpperCase()}
                  </Typography>
                  <Chip 
                    label={`${channel.totalMessages} messages`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>

                {/* Performance Metrics */}
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Delivery Rate
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {channel.deliveryRate.toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={channel.deliveryRate} 
                      color="success"
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Read Rate
                    </Typography>
                    <Typography variant="h6" color="info.main">
                      {channel.readRate.toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={channel.readRate} 
                      color="info"
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Failure Rate
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {channel.failureRate.toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={channel.failureRate} 
                      color="error"
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Grid>
                </Grid>

                {/* Message Counts */}
                <Box mt={2}>
                  <Grid container spacing={1}>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">
                        Sent
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {channel.sent}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">
                        Delivered
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {channel.delivered}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">
                        Read
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {channel.read}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">
                        Failed
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {channel.failed}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Detailed Analysis */}
      {data.channelStats.map((channel, index) => (
        <Accordion key={index} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>
              {channel.channel.toUpperCase()} - Detailed Analysis
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Vendor Performance */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Vendor Performance
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Vendor</TableCell>
                        <TableCell align="right">Messages</TableCell>
                        <TableCell align="right">Success Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {channel.vendors.map((vendor, vendorIndex) => (
                        <TableRow key={vendorIndex}>
                          <TableCell>{vendor.vendor}</TableCell>
                          <TableCell align="right">{vendor.total}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${vendor.successRate.toFixed(1)}%`}
                              color={getPerformanceColor(vendor.successRate) as any}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Failure Reasons */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Failure Reasons
                </Typography>
                {channel.failureReasons.length > 0 ? (
                  <List dense>
                    {channel.failureReasons.map((failure, failureIndex) => (
                      <ListItem key={failureIndex}>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center">
                              <Error color="error" sx={{ mr: 1, fontSize: 16 }} />
                              {failure.reason}
                            </Box>
                          }
                          secondary={`${failure.count} failures`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    No failures recorded for this channel
                  </Typography>
                )}
              </Grid>

              {/* Daily Trends */}
              {channel.dailyStats.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Daily Trends
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">Messages</TableCell>
                          <TableCell align="right">Delivered</TableCell>
                          <TableCell align="right">Failed</TableCell>
                          <TableCell align="right">Success Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {channel.dailyStats.slice(-7).map((day, dayIndex) => (
                          <TableRow key={dayIndex}>
                            <TableCell>{formatDate(day.date)}</TableCell>
                            <TableCell align="right">{day.total}</TableCell>
                            <TableCell align="right">{day.delivered}</TableCell>
                            <TableCell align="right">{day.failed}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${day.successRate.toFixed(1)}%`}
                                color={getPerformanceColor(day.successRate) as any}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default ChannelAnalytics;