import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
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
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  TrendingUp,
  Send,
  CheckCircle,
  Visibility,
  Error,
  BarChart,
} from '@mui/icons-material';
import { apiCall } from '../api/client';

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

  const fetchAnalytics = async (selectedPeriod: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiCall<AnalyticsData>('get', `/analytics/dashboard?period=${selectedPeriod}`);
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
  }, [period]);

  const handlePeriodChange = (event: any) => {
    const newPeriod = event.target.value;
    setPeriod(newPeriod);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
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
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Analytics
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!analyticsData) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Analytics
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          No analytics data available.
        </Alert>
      </Box>
    );
  }

  const { summary, dailyStats, vendorStats } = analyticsData;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Analytics Dashboard
        </Typography>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={period}
            label="Period"
            onChange={handlePeriodChange}
          >
            <MenuItem value="1d">Last Day</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
            <MenuItem value="90d">Last 90 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

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
                <Chip 
                  label={summary.deliveryRate >= 90 ? "Excellent" : summary.deliveryRate >= 70 ? "Good" : "Needs Improvement"} 
                  color={summary.deliveryRate >= 90 ? "success" : summary.deliveryRate >= 70 ? "warning" : "error"}
                  size="small"
                  sx={{ ml: 2 }}
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
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12}>
            <Card>
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
                        <TableCell align="right">Success Rate</TableCell>
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
                          <TableCell align="right">
                            <Chip
                              label={formatPercentage(vendor.successRate)}
                              color={vendor.successRate >= 90 ? "success" : vendor.successRate >= 70 ? "warning" : "error"}
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
          </Grid>
        </Grid>
      )}

      {/* Daily Statistics */}
      {dailyStats.length > 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
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
                        <TableCell align="right">Success Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dailyStats.map((day, index) => (
                        <TableRow key={index}>
                          <TableCell component="th" scope="row">
                            {formatDate(day.date)}
                          </TableCell>
                          <TableCell align="right">{day.totalMessages}</TableCell>
                          <TableCell align="right">{day.totalSent}</TableCell>
                          <TableCell align="right">{day.totalDelivered}</TableCell>
                          <TableCell align="right">{day.totalRead}</TableCell>
                          <TableCell align="right">{day.totalFailed}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={formatPercentage(day.successRate)}
                              color={day.successRate >= 90 ? "success" : day.successRate >= 70 ? "warning" : "error"}
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
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default AnalyticsPage;