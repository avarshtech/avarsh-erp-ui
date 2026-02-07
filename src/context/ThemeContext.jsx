import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Theme Context
 * Provides light/dark mode toggle functionality across the application
 */

const ThemeContext = createContext(null);

// Theme configuration
const THEME_STORAGE_KEY = 'avarsh-erp-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

// Light theme colors for Ant Design
const lightThemeToken = {
  colorPrimary: '#6366f1',
  colorSuccess: '#22c55e',
  colorWarning: '#f59e0b',
  colorError: '#ef4444',
  colorInfo: '#3b82f6',
  colorBgContainer: '#ffffff',
  colorBgLayout: '#f8fafc',
  colorBgElevated: '#ffffff',
  colorBgSpotlight: '#f1f5f9',
  colorText: '#1e293b',
  colorTextSecondary: '#64748b',
  colorTextTertiary: '#94a3b8',
  colorTextQuaternary: '#cbd5e1',
  colorBorder: '#e2e8f0',
  colorBorderSecondary: '#f1f5f9',
  borderRadius: 10,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

// Dark theme colors for Ant Design
const darkThemeToken = {
  colorPrimary: '#818cf8',
  colorSuccess: '#4ade80',
  colorWarning: '#fbbf24',
  colorError: '#f87171',
  colorInfo: '#60a5fa',
  colorBgContainer: '#1e293b',
  colorBgLayout: '#0f172a',
  colorBgElevated: '#334155',
  colorBgSpotlight: '#475569',
  colorText: '#f1f5f9',
  colorTextSecondary: '#cbd5e1',
  colorTextTertiary: '#94a3b8',
  colorTextQuaternary: '#64748b',
  colorBorder: '#334155',
  colorBorderSecondary: '#475569',
  borderRadius: 10,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

// Component-level theme overrides for light mode
const lightComponentsToken = {
  Button: {
    borderRadius: 10,
    controlHeight: 40,
  },
  Input: {
    controlHeight: 40,
  },
  Select: {
    controlHeight: 40,
  },
  Table: {
    borderRadius: 12,
    headerBg: '#f1f5f9',
    headerColor: '#1e293b',
    rowHoverBg: '#e0e7ff',
  },
  Card: {
    colorBgContainer: '#ffffff',
  },
  Menu: {
    darkItemBg: 'transparent',
    darkSubMenuItemBg: 'rgba(0, 0, 0, 0.2)',
    darkItemSelectedBg: '#6366f1',
  },
  Layout: {
    siderBg: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    headerBg: '#ffffff',
  },
  DatePicker: {
    controlHeight: 40,
  },
  Modal: {
    contentBg: '#ffffff',
    headerBg: '#ffffff',
  },
  Tooltip: {
    colorBgSpotlight: '#475569',
    colorTextLightSolid: '#f1f5f9',
    borderRadius: 8,
    fontSize: 13,
  },
};

// Component-level theme overrides for dark mode
const darkComponentsToken = {
  Button: {
    borderRadius: 10,
    controlHeight: 40,
    defaultBg: '#334155',
    defaultBorderColor: '#475569',
  },
  Input: {
    controlHeight: 40,
    colorBgContainer: '#1e293b',
    colorBorder: '#475569',
    hoverBorderColor: '#818cf8',
    activeBorderColor: '#818cf8',
  },
  Select: {
    controlHeight: 40,
    colorBgContainer: '#1e293b',
    colorBgElevated: '#334155',
    colorBorder: '#475569',
    optionSelectedBg: '#475569',
  },
  Table: {
    borderRadius: 12,
    headerBg: '#334155',
    headerColor: '#f1f5f9',
    rowHoverBg: '#475569',
    colorBgContainer: '#1e293b',
    borderColor: '#475569',
  },
  Card: {
    colorBgContainer: '#1e293b',
    colorBorderSecondary: '#334155',
  },
  Menu: {
    darkItemBg: 'transparent',
    darkSubMenuItemBg: 'rgba(0, 0, 0, 0.3)',
    darkItemSelectedBg: '#818cf8',
  },
  Layout: {
    siderBg: '#0f172a',
    headerBg: '#1e293b',
    bodyBg: '#0f172a',
  },
  Modal: {
    contentBg: '#1e293b',
    headerBg: '#1e293b',
    titleColor: '#f1f5f9',
  },
  Dropdown: {
    colorBgElevated: '#334155',
  },
  Popover: {
    colorBgElevated: '#334155',
  },
  DatePicker: {
    controlHeight: 40,
    colorBgContainer: '#1e293b',
    colorBgElevated: '#334155',
  },
  Tooltip: {
    colorBgSpotlight: '#64748b',
    colorTextLightSolid: '#f1f5f9',
    borderRadius: 8,
    fontSize: 13,
  },
  Tag: {
    defaultBg: '#334155',
  },
};

export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or system preference
  const getInitialTheme = () => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme && Object.values(THEMES).includes(storedTheme)) {
      return storedTheme;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }
    return THEMES.LIGHT;
  };

  const [theme, setThemeState] = useState(getInitialTheme);

  // Update document attribute and localStorage when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    // Update body background for smooth transition
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      // Only auto-switch if user hasn't explicitly set a preference
      if (!storedTheme) {
        setThemeState(e.matches ? THEMES.DARK : THEMES.LIGHT);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setThemeState(newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT);
  }, []);

  const isDarkMode = theme === THEMES.DARK;

  // Generate Ant Design theme configuration
  const antThemeConfig = useMemo(() => ({
    token: isDarkMode ? darkThemeToken : lightThemeToken,
    components: isDarkMode ? darkComponentsToken : lightComponentsToken,
    algorithm: isDarkMode ? undefined : undefined, // Can use theme.darkAlgorithm if needed
  }), [isDarkMode]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
    isDarkMode,
    antThemeConfig,
    THEMES,
  }), [theme, setTheme, toggleTheme, isDarkMode, antThemeConfig]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 * @returns {Object} Theme context value
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
