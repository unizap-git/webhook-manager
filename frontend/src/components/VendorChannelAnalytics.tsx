import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Button,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  Error,
  Sms,
  WhatsApp,
  ViewModule,
  ViewList,
  TrendingUp,
  Refresh,
  GetApp,
} from '@mui/icons-material';
import { apiCall } from '../api/client';
import LoadingState from './LoadingState';
import DateRangeFilter from './DateRangeFilter';
import { 
  getPerformanceColor, 
  getPerformanceIcon, 
  formatPercentage, 
  formatDate,
  PerformanceChip 
} from '../utils/analyticsUtils';

interface VendorChannelStat {
  vendor: string;
  channel: string;
  totalMessages: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  successRate: number;
  events: Array<{ eventName: string; count: number }>;
  failureReasons: Array<{ reason: string; count: number }>;
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
  vendors: Array<{
    vendor: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    total: number;
    successRate: number;
  }>;
  events: Array<{ eventName: string; count: number }>;
  failureReasons: Array<{ reason: string; count: number }>;
  dailyStats: Array<{
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    total: number;
    successRate: number;
  }>;
}

interface CombinedAnalyticsData {
  vendorChannelStats: VendorChannelStat[];
  channelStats: ChannelStat[];
  summary: {
    totalVendorChannelCombinations: number;
    totalChannels: number;
    totalMessages: number;
  };
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

type ViewMode = 'vendor-channel' | 'channel-focused';

const VendorChannelAnalytics: React.FC = () => {
  const [data, setData] = useState<CombinedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');
  const [viewMode, setViewMode] = useState<ViewMode>('vendor-channel');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (selectedPeriod: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch both vendor-channel and channel data
      const [vendorChannelResult, channelResult] = await Promise.all([
        apiCall('get', `/analytics/vendor-channel?period=${selectedPeriod}`),
        apiCall('get', `/analytics/channels?period=${selectedPeriod}`)
      ]);
      
      const combinedData: CombinedAnalyticsData = {
        vendorChannelStats: vendorChannelResult.vendorChannelStats,
        channelStats: channelResult.channelStats,
        summary: {
          totalVendorChannelCombinations: vendorChannelResult.summary.totalVendorChannelCombinations,
          totalChannels: channelResult.summary.totalChannels,
          totalMessages: Math.max(vendorChannelResult.summary.totalMessages, channelResult.summary.totalMessages),
        },
        period: selectedPeriod,
        dateRange: vendorChannelResult.dateRange || channelResult.dateRange,
      };
      
      setData(combinedData);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch analytics data');
      console.error('Error fetching combined analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period]);

  const handlePeriodChange = (newPeriod: string, customRange?: any) => {
    setPeriod(newPeriod);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(period);
  };

  const handleExport = () => {
    if (!data) return;
    
    // Create CSV data
    const csvData = viewMode === 'vendor-channel' 
      ? data.vendorChannelStats.map(stat => ({
          Vendor: stat.vendor,
          Channel: stat.channel,
          'Total Messages': stat.totalMessages,
          'Success Rate': `${stat.successRate.toFixed(1)}%`,
          'Delivery Rate': `${stat.deliveryRate.toFixed(1)}%`,
          'Failure Rate': `${stat.failureRate.toFixed(1)}%`,
          Delivered: stat.delivered,
          Failed: stat.failed,
        }))
      : data.channelStats.map(stat => ({
          Channel: stat.channel,
          'Total Messages': stat.totalMessages,
          'Delivery Rate': `${stat.deliveryRate.toFixed(1)}%`,
          'Read Rate': `${stat.readRate.toFixed(1)}%`,
          'Failure Rate': `${stat.failureRate.toFixed(1)}%`,
          Delivered: stat.delivered,
          Read: stat.read,
          Failed: stat.failed,
        }));

    // Convert to CSV and download
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${viewMode}-analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const renderVendorChannelView = () => {
    if (!data?.vendorChannelStats.length) {
      return (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No vendor-channel data available for the selected period.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        {/* Performance Table */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Vendor-Channel Performance Matrix
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell align="right">Messages</TableCell>
                    <TableCell align="right">Delivered</TableCell>
                    <TableCell align="right">Read</TableCell>
                    <TableCell align="right">Failed</TableCell>
                    <TableCell align="right">Success Rate</TableCell>
                    <TableCell align="right">Delivery Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.vendorChannelStats.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {stat.vendor}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          {getChannelIcon(stat.channel)}
                          <Chip 
                            label={stat.channel.toUpperCase()} 
                            size="small"
                            color={stat.channel === 'sms' ? 'primary' : 'secondary'}
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="right">{stat.totalMessages}</TableCell>
                      <TableCell align="right">{stat.delivered}</TableCell>
                      <TableCell align="right">{stat.read}</TableCell>
                      <TableCell align="right">{stat.failed}</TableCell>
                      <TableCell align="right">
                        <PerformanceChip value={stat.successRate} showIcon />
                      </TableCell>
                      <TableCell align="right">
                        <PerformanceChip value={stat.deliveryRate} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Detailed Analysis */}
        {data.vendorChannelStats.map((stat, index) => (
          <Accordion key={index} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>
                {stat.vendor} - {stat.channel.toUpperCase()} Detailed Analysis
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* Event Distribution */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Event Distribution
                  </Typography>
                  <List dense>
                    {stat.events.map((event, eventIndex) => (
                      <ListItem key={eventIndex}>
                        <ListItemText
                          primary={event.eventName}
                          secondary={`${event.count} events (${((event.count / stat.totalMessages) * 100).toFixed(1)}%)`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>

                {/* Failure Reasons */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Failure Reasons
                  </Typography>
                  {stat.failureReasons.length > 0 ? (
                    <List dense>
                      {stat.failureReasons.map((failure, failureIndex) => (
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
                      No failures recorded
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </>
    );
  };

  const renderChannelFocusedView = () => {
    if (!data?.channelStats.length) {
      return (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No channel data available for the selected period.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        {/* Channel Performance Cards */}
        <Grid container spacing={3} mb={3}>
          {data.channelStats.map((channel, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
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
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Delivery Rate
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatPercentage(channel.deliveryRate)}
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
                        {formatPercentage(channel.readRate)}
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
                        {formatPercentage(channel.failureRate)}
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
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Detailed Channel Analysis */}
        {data.channelStats.map((channel, index) => (
          <Accordion key={index} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>
                {channel.channel.toUpperCase()} - Detailed Analysis ({channel.totalMessages} messages)
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
                              <PerformanceChip value={vendor.successRate} />
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
                    Failure Analysis
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
                      Daily Performance Trends (Last 7 Days)
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
                                <PerformanceChip value={day.successRate} />
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
      </>
    );
  };

  return (
    <Box>
      {/* Header with Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h5" component="h2">
          Communication Performance Analysis
        </Typography>
        
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <DateRangeFilter 
            value={period} 
            onChange={handlePeriodChange}
            size="small"
          />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={refreshing}
            size="small"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<GetApp />}
            onClick={handleExport}
            disabled={!data}
            size="small"
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      <LoadingState loading={loading} error={error}>
        {data && (
          <>
            {/* Summary Cards */}
            <Grid container spacing={2} mb={3}>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      Total Messages
                    </Typography>
                    <Typography variant="h6">
                      {data.summary.totalMessages.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
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
                      Vendor-Channel Combinations
                    </Typography>
                    <Typography variant="h6">
                      {data.summary.totalVendorChannelCombinations}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      Analysis Period
                    </Typography>
                    <Typography variant="h6">
                      {period === 'today' ? 'Today' : 
                       period === 'yesterday' ? 'Yesterday' : 
                       period === '7d' ? '7 Days' :
                       period === '30d' ? '30 Days' : 
                       period === '90d' ? '90 Days' : 'Custom'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* View Mode Toggle */}
            <Box mb={3}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                aria-label="view mode"
                size="small"
              >
                <ToggleButton value="vendor-channel" aria-label="vendor channel matrix">
                  <ViewModule sx={{ mr: 1 }} />
                  Vendor-Channel Matrix
                </ToggleButton>
                <ToggleButton value="channel-focused" aria-label="channel focused">
                  <ViewList sx={{ mr: 1 }} />
                  Channel-Focused View
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Dynamic Content Based on View Mode */}
            {viewMode === 'vendor-channel' && renderVendorChannelView()}
            {viewMode === 'channel-focused' && renderChannelFocusedView()}
          </>
        )}
      </LoadingState>
    </Box>
  );
};

export default VendorChannelAnalytics;