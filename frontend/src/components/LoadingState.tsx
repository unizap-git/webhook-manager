import React from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';

interface LoadingStateProps {
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
  minHeight?: number;
}

const LoadingState: React.FC<LoadingStateProps> = ({ 
  loading, 
  error, 
  children, 
  minHeight = 400 
}) => {
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight={minHeight}
      >
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

  return <>{children}</>;
};

export default LoadingState;