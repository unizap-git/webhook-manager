import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { themes, ThemeMode } from './themes';
import { api } from '../api/client';

interface ThemeContextType {
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = 'webhook-hub-theme';
const SYNC_DEBOUNCE_MS = 1000; // 1 second debounce for backend sync

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Purple is default as per user requirement
  const [themeMode, setThemeModeState] = useState<ThemeMode>('purple');
  const [syncTimeout, setSyncTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (savedTheme && (savedTheme === 'default' || savedTheme === 'purple')) {
      setThemeModeState(savedTheme);
    }
  }, []);

  // Sync theme to backend (debounced)
  const syncThemeToBackend = useCallback(async (mode: ThemeMode) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return; // Not logged in, skip backend sync

      await api.put('/user/preferences', {
        theme: mode,
      });
    } catch (error) {
      console.error('Failed to sync theme to backend:', error);
      // Don't show error to user - theme still works from localStorage
    }
  }, []);

  // Set theme mode with persistence
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);

    // Save to localStorage immediately
    localStorage.setItem(THEME_STORAGE_KEY, mode);

    // Debounce backend sync
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    const timeout = setTimeout(() => {
      syncThemeToBackend(mode);
    }, SYNC_DEBOUNCE_MS);

    setSyncTimeout(timeout);
  }, [syncTimeout, syncThemeToBackend]);

  // Toggle between default and purple
  const toggleTheme = useCallback(() => {
    const newMode: ThemeMode = themeMode === 'default' ? 'purple' : 'default';
    setThemeMode(newMode);
  }, [themeMode, setThemeMode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
    };
  }, [syncTimeout]);

  const value: ThemeContextType = {
    themeMode,
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={themes[themeMode]}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
