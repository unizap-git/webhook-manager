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
} from '@mui/material';
import {
  ExpandMore,
  TrendingUp,
  TrendingDown,
  Error,
} from '@mui/icons-material';
import { apiCall } from '../api/client';

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

interface VendorChannelData {
  vendorChannelStats: VendorChannelStat[];
  summary: {
    totalVendorChannelCombinations: number;
    totalMessages: number;
  };
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

const VendorChannelAnalytics: React.FC = () => {
  const [data, setData] = useState<VendorChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');

  const fetchData = async (selectedPeriod: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiCall<VendorChannelData>('get', `/analytics/vendor-channel?period=${selectedPeriod}`);
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch vendor-channel analytics');
      console.error('Error fetching vendor-channel analytics:', err);
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

  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  const getPerformanceIcon = (rate: number) => {
    if (rate >= 90) return <TrendingUp color="success" />;
    if (rate >= 70) return <TrendingUp color="warning" />;
    return <TrendingDown color="error" />;
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
        No vendor-channel analytics data available.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Vendor-Channel Performance Matrix
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

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Combinations
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
                Total Messages
              </Typography>
              <Typography variant="h6">
                {data.summary.totalMessages}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vendor-Channel Performance Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Performance Breakdown
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
                      <Chip 
                        label={stat.channel.toUpperCase()} 
                        size="small"
                        color={stat.channel === 'sms' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell align="right">{stat.totalMessages}</TableCell>
                    <TableCell align="right">{stat.delivered}</TableCell>
                    <TableCell align="right">{stat.read}</TableCell>
                    <TableCell align="right">{stat.failed}</TableCell>
                    <TableCell align="right">
                      <Box display="flex" alignItems="center" justifyContent="flex-end">
                        {getPerformanceIcon(stat.successRate)}
                        <Chip
                          label={`${stat.successRate.toFixed(1)}%`}
                          color={getPerformanceColor(stat.successRate) as any}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${stat.deliveryRate.toFixed(1)}%`}
                        color={getPerformanceColor(stat.deliveryRate) as any}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Detailed Event Breakdown */}
      {data.vendorChannelStats.map((stat, index) => (
        <Accordion key={index} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>
              {stat.vendor} - {stat.channel.toUpperCase()} Detailed Analysis
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Event Names */}
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
    </Box>
  );
};

export default VendorChannelAnalytics;