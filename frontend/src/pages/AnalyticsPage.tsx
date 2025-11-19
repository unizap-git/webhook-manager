import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  TrendingUp,
  Send,
  CheckCircle,
  Visibility,
  Error,
  BarChart,
  BugReport,
  Compare,
} from '@mui/icons-material';
import { apiCall } from '../api/client';
import VendorChannelAnalytics from '../components/VendorChannelAnalytics';
import FailureAnalytics from '../components/FailureAnalytics';
import LoadingState from '../components/LoadingState';
import DateRangeFilter from '../components/DateRangeFilter';
import { formatPercentage, PerformanceChip } from '../utils/analyticsUtils';
import { useProject } from '../contexts/ProjectContext';

interface AnalyticsSummary {
  totalMessages: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
}

interface DailyStats {
  date: string;
  totalMessages: number;
  successRate: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
}

interface VendorStats {
  vendorId: string;
  vendorName: string;
  totalMessages: number;
  successRate: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  dailyStats: DailyStats[];
  vendorStats: VendorStats[];
  period: string;
}

const AnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');
  const [tabValue, setTabValue] = useState(0);
  const { selectedProjectId, isAllProjects } = useProject();

  const fetchAnalytics = async (selectedPeriod: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query params with project filter
      const queryParams = new URLSearchParams({
        period: selectedPeriod,
      });
      
      if (selectedProjectId && !isAllProjects) {
        queryParams.append('projectId', selectedProjectId);
      }
      
      const data = await apiCall<AnalyticsData>('get', `/analytics/dashboard?${queryParams.toString()}`);
      setAnalyticsData(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch analytics data');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period, selectedProjectId]); // Re-fetch when project changes

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const renderOverviewTab = () => {
    if (!analyticsData) {
      return null;
    }

    const { summary, dailyStats, vendorStats } = analyticsData;

    return (
      <>
        {/* Summary Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <Send color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    {summary.totalMessages}
                  </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  Total Messages
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <TrendingUp color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    {summary.totalSent}
                  </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  Sent
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <CheckCircle color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    {summary.totalDelivered}
                  </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  Delivered
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <Visibility color="info" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    {summary.totalRead}
                  </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  Read
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <Error color="error" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    {summary.totalFailed}
                  </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  Failed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Performance Metrics */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Delivery Rate
                </Typography>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h4" color="success.main">
                    {formatPercentage(summary.deliveryRate)}
                  </Typography>
                  <PerformanceChip 
                    value={summary.deliveryRate}
                    showIcon
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={summary.deliveryRate} 
                  color="success"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Read Rate
                </Typography>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h4" color="info.main">
                    {formatPercentage(summary.readRate)}
                  </Typography>
                  <Chip 
                    label={summary.readRate >= 50 ? "High" : summary.readRate >= 20 ? "Medium" : "Low"} 
                    color={summary.readRate >= 50 ? "success" : summary.readRate >= 20 ? "warning" : "default"}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={summary.readRate} 
                  color="info"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Failure Rate
                </Typography>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h4" color="error.main">
                    {formatPercentage(summary.failureRate)}
                  </Typography>
                  <Chip 
                    label={summary.failureRate <= 5 ? "Excellent" : summary.failureRate <= 15 ? "Good" : "High"}
                    color={summary.failureRate <= 5 ? "success" : summary.failureRate <= 15 ? "warning" : "error"}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={summary.failureRate} 
                  color="error"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Vendor Performance */}
        {vendorStats.length > 0 && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <BarChart sx={{ mr: 1 }} />
                Vendor Performance
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Vendor</TableCell>
                      <TableCell align="right">Messages</TableCell>
                      <TableCell align="right">Sent</TableCell>
                      <TableCell align="right">Delivered</TableCell>
                      <TableCell align="right">Read</TableCell>
                      <TableCell align="right">Failed</TableCell>
                      <TableCell align="center">Success Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vendorStats.map((vendor) => (
                      <TableRow key={vendor.vendorId}>
                        <TableCell component="th" scope="row">
                          <Typography variant="subtitle2">
                            {vendor.vendorName}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{vendor.totalMessages}</TableCell>
                        <TableCell align="right">{vendor.totalSent}</TableCell>
                        <TableCell align="right">{vendor.totalDelivered}</TableCell>
                        <TableCell align="right">{vendor.totalRead}</TableCell>
                        <TableCell align="right">{vendor.totalFailed}</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center' }}>
                          <PerformanceChip value={vendor.successRate} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Daily Statistics */}
        {dailyStats.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Daily Statistics
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Messages</TableCell>
                      <TableCell align="right">Sent</TableCell>
                      <TableCell align="right">Delivered</TableCell>
                      <TableCell align="right">Read</TableCell>
                      <TableCell align="right">Failed</TableCell>
                      <TableCell align="center">Success Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyStats.map((day, index) => (
                      <TableRow key={index}>
                        <TableCell component="th" scope="row">
                          {new Date(day.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">{day.totalMessages}</TableCell>
                        <TableCell align="right">{day.totalSent}</TableCell>
                        <TableCell align="right">{day.totalDelivered}</TableCell>
                        <TableCell align="right">{day.totalRead}</TableCell>
                        <TableCell align="right">{day.totalFailed}</TableCell>
                        <TableCell align="center" sx={{ textAlign: 'center' }}>
                          <PerformanceChip value={day.successRate} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Communication Analytics
        </Typography>
        
        <DateRangeFilter 
          value={period} 
          onChange={handlePeriodChange}
        />
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          aria-label="analytics tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label="Overview" 
            icon={<BarChart />} 
            iconPosition="start"
          />
          <Tab 
            label="Channel Performance" 
            icon={<Compare />}
            iconPosition="start"
          />
          <Tab 
            label="Failure Analysis" 
            icon={<BugReport />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <LoadingState loading={loading} error={error}>
        {tabValue === 0 && renderOverviewTab()}
        {tabValue === 1 && <VendorChannelAnalytics period={period} />}
        {tabValue === 2 && <FailureAnalytics period={period} />}
      </LoadingState>
    </Box>
  );
};

export default AnalyticsPage;