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
  Paper,
} from '@mui/material';
import {
  ExpandMore,
  Error,
  Warning,
  BugReport,
  Timeline,
} from '@mui/icons-material';
import { apiCall } from '../api/client';

interface FailureExample {
  messageId: string;
  recipient: string;
  timestamp: string;
  rawPayload: any;
}

interface FailureReason {
  reason: string;
  count: number;
  percentage: number;
  vendors: Array<{ vendor: string; count: number }>;
  channels: Array<{ channel: string; count: number }>;
  examples: FailureExample[];
}

interface VendorChannelFailure {
  vendor: string;
  channel: string;
  totalFailures: number;
  reasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

interface DailyFailure {
  date: string;
  totalFailures: number;
  reasons: Array<{
    reason: string;
    count: number;
  }>;
}

interface FailureAnalyticsData {
  summary: {
    totalFailedMessages: number;
    uniqueFailureReasons: number;
    topFailureReason: string | null;
    period: string;
  };
  failureReasons: FailureReason[];
  vendorChannelFailures: VendorChannelFailure[];
  dailyFailures: DailyFailure[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

const FailureAnalytics: React.FC = () => {
  const [data, setData] = useState<FailureAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');

  const fetchData = async (selectedPeriod: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiCall<FailureAnalyticsData>('get', `/analytics/failures?period=${selectedPeriod}`);
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch failure analytics');
      console.error('Error fetching failure analytics:', err);
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

  const getSeverityColor = (percentage: number) => {
    if (percentage >= 50) return 'error';
    if (percentage >= 20) return 'warning';
    return 'default';
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
        No failure analytics data available.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Failure Analysis & Debugging
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
              <Box display="flex" alignItems="center">
                <Error color="error" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="h6">
                    {data.summary.totalFailedMessages}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Failed Messages
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <BugReport color="warning" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="h6">
                    {data.summary.uniqueFailureReasons}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Unique Reasons
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Warning color="error" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="h6">
                    {data.summary.topFailureReason || 'N/A'}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Top Failure Reason
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Failure Reasons Breakdown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center">
            <Error sx={{ mr: 1 }} />
            Failure Reasons Analysis
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Percentage</TableCell>
                  <TableCell align="right">Affected Vendors</TableCell>
                  <TableCell align="right">Affected Channels</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.failureReasons.map((reason, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {reason.reason}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{reason.count}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${reason.percentage.toFixed(1)}%`}
                        color={getSeverityColor(reason.percentage) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {reason.vendors.map((v, i) => (
                        <Chip 
                          key={i}
                          label={`${v.vendor} (${v.count})`}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell align="right">
                      {reason.channels.map((c, i) => (
                        <Chip 
                          key={i}
                          label={`${c.channel} (${c.count})`}
                          size="small"
                          color="secondary"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Vendor-Channel Failure Matrix */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Vendor-Channel Failure Matrix
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell align="right">Total Failures</TableCell>
                  <TableCell>Top Failure Reasons</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.vendorChannelFailures.map((vcFailure, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {vcFailure.vendor}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={vcFailure.channel.toUpperCase()}
                        size="small"
                        color={vcFailure.channel === 'sms' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={vcFailure.totalFailures}
                        color="error"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {vcFailure.reasons.slice(0, 2).map((reason, reasonIndex) => (
                        <Chip
                          key={reasonIndex}
                          label={`${reason.reason} (${reason.percentage.toFixed(1)}%)`}
                          size="small"
                          color="warning"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Detailed Failure Examples */}
      {data.failureReasons.filter(r => r.examples.length > 0).map((reason, index) => (
        <Accordion key={index} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>
              {reason.reason} - Webhook Examples ({reason.count} failures)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="subtitle2" gutterBottom>
              Raw Webhook Examples for Debugging:
            </Typography>
            {reason.examples.map((example, exampleIndex) => (
              <Paper key={exampleIndex} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="primary">
                      Message Details:
                    </Typography>
                    <Typography variant="body2">
                      <strong>Message ID:</strong> {example.messageId}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Recipient:</strong> {example.recipient}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Timestamp:</strong> {formatDate(example.timestamp)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="secondary">
                      Raw Webhook Payload:
                    </Typography>
                    <Box component="pre" sx={{ 
                      fontSize: 11, 
                      bgcolor: 'grey.100', 
                      p: 1, 
                      borderRadius: 1, 
                      overflow: 'auto',
                      maxHeight: 200
                    }}>
                      {JSON.stringify(example.rawPayload, null, 2)}
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Daily Failure Trends */}
      {data.dailyFailures.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <Timeline sx={{ mr: 1 }} />
              Daily Failure Trends
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Total Failures</TableCell>
                    <TableCell>Top Failure Reasons</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.dailyFailures.slice(-7).map((day, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(day.date)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={day.totalFailures}
                          color="error"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {day.reasons.slice(0, 3).map((reason, reasonIndex) => (
                          <Chip
                            key={reasonIndex}
                            label={`${reason.reason} (${reason.count})`}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default FailureAnalytics;