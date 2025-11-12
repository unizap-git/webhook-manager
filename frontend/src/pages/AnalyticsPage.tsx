import React from 'react';
import {
  Box,
  Typography,
  Paper,
} from '@mui/material';

const AnalyticsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Analytics
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Detailed analytics and reporting
      </Typography>

      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Advanced Analytics Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This page will include detailed charts, message tracking, failure analysis, and export capabilities.
        </Typography>
      </Paper>
    </Box>
  );
};

export default AnalyticsPage;