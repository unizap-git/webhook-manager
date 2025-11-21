import React from 'react';
import { Box, Switch, Tooltip, styled } from '@mui/material';
import { useTheme } from '../theme/ThemeContext';

// Styled switch with custom purple color
const ThemeSwitch = styled(Switch)(({ theme }) => ({
  width: 56,
  height: 28,
  padding: 0,
  display: 'flex',
  '&:active': {
    '& .MuiSwitch-thumb': {
      width: 22,
    },
    '& .MuiSwitch-switchBase.Mui-checked': {
      transform: 'translateX(24px)',
    },
  },
  '& .MuiSwitch-switchBase': {
    padding: 3,
    '&.Mui-checked': {
      transform: 'translateX(28px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: '#8c47e2',
      },
    },
  },
  '& .MuiSwitch-thumb': {
    boxShadow: '0 2px 4px 0 rgb(0 35 11 / 20%)',
    width: 22,
    height: 22,
    borderRadius: 11,
    transition: theme.transitions.create(['width'], {
      duration: 200,
    }),
  },
  '& .MuiSwitch-track': {
    borderRadius: 28 / 2,
    opacity: 1,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.25)',
    boxSizing: 'border-box',
  },
}));

export const ThemeToggle: React.FC = () => {
  const { themeMode, toggleTheme } = useTheme();

  const isPurple = themeMode === 'purple';

  return (
    <Tooltip title={isPurple ? 'Switch to Default Theme' : 'Switch to Purple Theme'} arrow>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mr: 2,
        }}
      >
        <Box
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: !isPurple ? 'primary.main' : 'text.secondary',
            transition: 'color 0.3s',
          }}
        >
          Default
        </Box>
        <ThemeSwitch
          checked={isPurple}
          onChange={toggleTheme}
          inputProps={{ 'aria-label': 'theme toggle' }}
        />
        <Box
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: isPurple ? 'primary.main' : 'text.secondary',
            transition: 'color 0.3s',
          }}
        >
          Purple
        </Box>
      </Box>
    </Tooltip>
  );
};
