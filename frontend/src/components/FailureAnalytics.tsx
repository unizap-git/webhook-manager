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
  Paper,
  Button,
  TablePagination,
} from '@mui/material';
import {
  ExpandMore,
  Error,
  Warning,
  BugReport,
  Timeline,
  Refresh,
  GetApp,
} from '@mui/icons-material';
import { apiCall } from '../api/client';
import LoadingState from './LoadingState';
import { useProject } from '../contexts/ProjectContext';
import { formatPercentage, formatDate, PerformanceChip } from '../utils/analyticsUtils';

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

interface FailureAnalyticsProps {
  period?: string;
}

const FailureAnalytics: React.FC<FailureAnalyticsProps> = ({ period = '7d' }) => {
  const [data, setData] = useState<FailureAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyFailuresPage, setDailyFailuresPage] = useState(0);
  const [dailyFailuresRowsPerPage, setDailyFailuresRowsPerPage] = useState(10);
  const [failureReasonsPage, setFailureReasonsPage] = useState(0);
  const [failureReasonsRowsPerPage, setFailureReasonsRowsPerPage] = useState(10);
  const [webhookExamplesPagination, setWebhookExamplesPagination] = useState<Record<string, { page: number, rowsPerPage: number }>>({});
  const [cacheInfo, setCacheInfo] = useState<{ cached: boolean; cachedAt?: string; expiresIn?: number } | null>(null);
  const { selectedProjectId, isAllProjects } = useProject();

  // Frontend cache to avoid re-fetching when switching tabs
  const dataCache = React.useRef<Map<string, FailureAnalyticsData>>(new Map());

  // Get channel color based on channel type
  const getChannelColor = (channel: string): 'primary' | 'error' | 'success' => {
    const channelLower = channel.toLowerCase();
    if (channelLower === 'sms') return 'primary'; // Blue
    if (channelLower === 'email') return 'error'; // Red
    if (channelLower === 'whatsapp') return 'success'; // Green
    return 'primary'; // Default to blue
  };

  // Helper functions for webhook examples pagination
  const getWebhookPagination = (reasonKey: string) => {
    return webhookExamplesPagination[reasonKey] || { page: 0, rowsPerPage: 10 };
  };

  const setWebhookPagination = (reasonKey: string, page: number, rowsPerPage: number) => {
    setWebhookExamplesPagination(prev => ({
      ...prev,
      [reasonKey]: { page, rowsPerPage }
    }));
  };

  const fetchData = async (selectedPeriod: string, bypassCache: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      // Generate frontend cache key based on period and project
      const cacheKey = `${selectedPeriod}_${selectedProjectId || 'all'}`;

      // Check frontend cache first (unless bypassing or refreshing)
      if (!bypassCache && dataCache.current.has(cacheKey)) {
        const cachedData = dataCache.current.get(cacheKey)!;
        setData(cachedData);
        setLoading(false);
        return;
      }

      // Build query params with project filter
      const queryParams = new URLSearchParams({
        period: selectedPeriod,
      });

      if (selectedProjectId && !isAllProjects) {
        queryParams.append('projectId', selectedProjectId);
      }

      // Add nocache parameter if bypassing cache
      if (bypassCache) {
        queryParams.append('nocache', 'true');
      }

      const result: any = await apiCall<FailureAnalyticsData>('get', `/analytics/failures?${queryParams.toString()}`);

      // Extract cache metadata if present
      if (result.meta) {
        setCacheInfo(result.meta);
      } else {
        setCacheInfo(null);
      }

      // Store in frontend cache for future tab switches
      dataCache.current.set(cacheKey, result);

      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch failure analytics');
      console.error('Error fetching failure analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period, selectedProjectId]); // Re-fetch when project changes

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(period, true); // Bypass cache on refresh
  };

  // Format "Last updated" text
  const getLastUpdatedText = (): string => {
    if (!cacheInfo || !cacheInfo.cachedAt) return '';

    const cachedTime = new Date(cacheInfo.cachedAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - cachedTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Updated just now';
    if (diffInMinutes === 1) return 'Updated 1 minute ago';
    if (diffInMinutes < 60) return `Updated ${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return 'Updated 1 hour ago';
    return `Updated ${diffInHours} hours ago`;
  };

  const handleExport = () => {
    if (!data) return;
    
    const csvData = data.failureReasons.map(reason => ({
      'Failure Reason': reason.reason,
      'Count': reason.count,
      'Percentage': `${reason.percentage.toFixed(1)}%`,
      'Affected Vendors': reason.vendors.map(v => v.vendor).join('; '),
      'Affected Channels': reason.channels.map(c => c.channel).join('; '),
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => String((row as any)[header])).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failure-analysis-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" component="h2">
            Failure Analysis & Debugging
          </Typography>
          {cacheInfo && cacheInfo.cached && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {getLastUpdatedText()}
            </Typography>
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
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
                      {data.failureReasons
                        .slice(failureReasonsPage * failureReasonsRowsPerPage, failureReasonsPage * failureReasonsRowsPerPage + failureReasonsRowsPerPage)
                        .map((reason, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="subtitle2">
                              {reason.reason}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{reason.count}</TableCell>
                          <TableCell align="right">
                            <PerformanceChip
                              value={reason.percentage}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {reason.vendors.map((v, i) => (
                              <Chip
                                key={i}
                                label={`${v.vendor} (${v.count})`}
                                size="small"
                                color="warning"
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
                                color={getChannelColor(c.channel)}
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={data.failureReasons.length}
                  rowsPerPage={failureReasonsRowsPerPage}
                  page={failureReasonsPage}
                  onPageChange={(_, newPage) => setFailureReasonsPage(newPage)}
                  onRowsPerPageChange={(event) => {
                    setFailureReasonsRowsPerPage(parseInt(event.target.value, 10));
                    setFailureReasonsPage(0);
                  }}
                />
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
                              color={getChannelColor(vcFailure.channel)}
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
                                label={`${reason.reason} (${formatPercentage(reason.percentage)})`}
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
            {data.failureReasons.filter(r => r.examples.length > 0).map((reason, index) => {
              const pagination = getWebhookPagination(reason.reason);
              const paginatedExamples = reason.examples.slice(
                pagination.page * pagination.rowsPerPage,
                pagination.page * pagination.rowsPerPage + pagination.rowsPerPage
              );

              return (
                <Accordion key={index} sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>
                      {reason.reason} - Webhook Examples ({reason.examples.length} examples)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" gutterBottom>
                      Raw Webhook Examples for Debugging:
                    </Typography>
                    {paginatedExamples.map((example, exampleIndex) => (
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
                    <TablePagination
                      rowsPerPageOptions={[10, 25, 50]}
                      component="div"
                      count={reason.examples.length}
                      rowsPerPage={pagination.rowsPerPage}
                      page={pagination.page}
                      onPageChange={(_, newPage) => setWebhookPagination(reason.reason, newPage, pagination.rowsPerPage)}
                      onRowsPerPageChange={(event) => {
                        const newRowsPerPage = parseInt(event.target.value, 10);
                        setWebhookPagination(reason.reason, 0, newRowsPerPage);
                      }}
                    />
                  </AccordionDetails>
                </Accordion>
              );
            })}

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
                        {data.dailyFailures
                          .slice(dailyFailuresPage * dailyFailuresRowsPerPage, dailyFailuresPage * dailyFailuresRowsPerPage + dailyFailuresRowsPerPage)
                          .map((day, index) => (
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
                  <TablePagination
                    rowsPerPageOptions={[10, 25, 50]}
                    component="div"
                    count={data.dailyFailures.length}
                    rowsPerPage={dailyFailuresRowsPerPage}
                    page={dailyFailuresPage}
                    onPageChange={(_, newPage) => setDailyFailuresPage(newPage)}
                    onRowsPerPageChange={(event) => {
                      setDailyFailuresRowsPerPage(parseInt(event.target.value, 10));
                      setDailyFailuresPage(0);
                    }}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </LoadingState>
    </Box>
  );
};

export default FailureAnalytics;