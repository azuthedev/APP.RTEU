import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize theme from localStorage or system preferences
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    
    // First check localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme as Theme;
    }
    
    // Then check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    // Default to light theme
    return 'light';
  });

  // Effect to update document class and localStorage when theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    // Update document class for Tailwind
    const root = document.documentElement;
    
    // Force clear existing classes
    root.classList.remove('light', 'dark');
    
    // Then add the current theme
    if (theme === 'dark') {
      root.classList.add('dark');
    }
    
    console.log('Theme updated to:', theme, 'Dark class present:', root.classList.contains('dark'));
  }, [theme]);

  // Toggle between light and dark themes with direct DOM manipulation for immediate effect
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Update state
    setTheme(newTheme);
    
    // Update localStorage immediately
    localStorage.setItem('theme', newTheme);
    
    // Update DOM immediately for instant feedback
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (newTheme === 'dark') {
      root.classList.add('dark');
    }
    
    console.log('Theme toggled to:', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};