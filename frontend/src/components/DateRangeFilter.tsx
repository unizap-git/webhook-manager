import React, { useState } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  SelectChangeEvent,
} from '@mui/material';
import {
  Today,
  History,
  DateRange,
  CalendarMonth,
  Event,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

interface DateOption {
  value: string;
  label: string;
  icon: React.ReactElement;
  description?: string;
}

interface DateRange {
  startDate: dayjs.Dayjs | null;
  endDate: dayjs.Dayjs | null;
}

interface DateRangeFilterProps {
  value: string;
  onChange: (period: string, customRange?: DateRange) => void;
  sx?: any;
  size?: 'small' | 'medium';
}

const dateOptions: DateOption[] = [
  { 
    value: 'today', 
    label: 'Today', 
    icon: <Today />,
    description: dayjs().format('MM/DD/YYYY')
  },
  { 
    value: 'yesterday', 
    label: 'Yesterday', 
    icon: <History />,
    description: dayjs().subtract(1, 'day').format('MM/DD/YYYY')
  },
  { 
    value: '7d', 
    label: 'Last 7 days', 
    icon: <DateRange />,
    description: 'Most recent week'
  },
  { 
    value: '30d', 
    label: 'Last 30 days', 
    icon: <CalendarMonth />,
    description: 'Most recent month'
  },
  { 
    value: '90d', 
    label: 'Last 90 days', 
    icon: <CalendarMonth />,
    description: 'Most recent quarter'
  },
  { 
    value: 'custom', 
    label: 'Custom range', 
    icon: <Event />,
    description: 'Select specific dates'
  },
];

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ 
  value, 
  onChange, 
  sx = {},
  size = 'medium' 
}) => {
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  const handlePeriodChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    
    if (newValue === 'custom') {
      setCustomDialogOpen(true);
    } else {
      onChange(newValue);
    }
  };

  const handleCustomRangeApply = () => {
    if (customRange.startDate && customRange.endDate) {
      onChange('custom', customRange);
      setCustomDialogOpen(false);
    }
  };

  const getDisplayLabel = () => {
    const option = dateOptions.find(opt => opt.value === value);
    if (option) {
      return option.label;
    }
    return 'Custom range';
  };

  const renderMenuItem = (option: DateOption) => (
    <MenuItem key={option.value} value={option.value}>
      <Box display="flex" alignItems="center" width="100%">
        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
          {option.icon}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ fontWeight: 'medium' }}>
            {option.label}
          </Box>
          {option.description && (
            <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {option.description}
            </Box>
          )}
        </Box>
      </Box>
    </MenuItem>
  );

  return (
    <>
      <FormControl sx={{ minWidth: 180, ...sx }} size={size}>
        <InputLabel>Time Period</InputLabel>
        <Select
          value={value}
          label="Time Period"
          onChange={handlePeriodChange}
          renderValue={() => (
            <Box display="flex" alignItems="center">
              {dateOptions.find(opt => opt.value === value)?.icon && (
                <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                  {dateOptions.find(opt => opt.value === value)?.icon}
                </Box>
              )}
              {getDisplayLabel()}
              {value === 'custom' && customRange.startDate && customRange.endDate && (
                <Chip 
                  label={`${customRange.startDate.format('MM/DD/YYYY')} - ${customRange.endDate.format('MM/DD/YYYY')}`}
                  size="small"
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
          )}
        >
          {dateOptions.map(renderMenuItem)}
        </Select>
      </FormControl>

      {/* Custom Date Range Dialog */}
      <Dialog 
        open={customDialogOpen} 
        onClose={() => setCustomDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select Custom Date Range</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
              <DatePicker
                label="Start Date"
                value={customRange.startDate}
                onChange={(date) => setCustomRange(prev => ({ ...prev, startDate: date }))}
                maxDate={customRange.endDate || dayjs()}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
              <DatePicker
                label="End Date"
                value={customRange.endDate}
                onChange={(date) => setCustomRange(prev => ({ ...prev, endDate: date }))}
                minDate={customRange.startDate}
                maxDate={dayjs()}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCustomRangeApply}
            variant="contained"
            disabled={!customRange.startDate || !customRange.endDate}
          >
            Apply Range
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DateRangeFilter;