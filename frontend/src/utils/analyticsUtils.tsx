import { Chip, Box } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

export const getPerformanceColor = (rate: number) => {
  if (rate >= 90) return 'success';
  if (rate >= 70) return 'warning';
  return 'error';
};

export const getPerformanceIcon = (rate: number) => {
  if (rate >= 70) return <TrendingUp color="success" />;
  return <TrendingDown color="error" />;
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface PerformanceChipProps {
  value: number;
  showIcon?: boolean;
  size?: 'small' | 'medium';
}

export const PerformanceChip: React.FC<PerformanceChipProps> = ({ 
  value, 
  showIcon = false, 
  size = 'small' 
}) => (
  <Box display="flex" alignItems="center" justifyContent="center">
    {showIcon && getPerformanceIcon(value)}
    <Chip
      label={formatPercentage(value)}
      color={getPerformanceColor(value) as any}
      size={size}
      sx={showIcon ? { ml: 1 } : {}}
    />
  </Box>
);

export const getSuccessRateLabel = (rate: number): string => {
  if (rate >= 95) return 'Excellent';
  if (rate >= 85) return 'Very Good';
  if (rate >= 70) return 'Good';
  if (rate >= 50) return 'Fair';
  return 'Needs Improvement';
};

export const getFailureSeverity = (percentage: number) => {
  if (percentage >= 50) return 'error';
  if (percentage >= 20) return 'warning';
  return 'default';
};