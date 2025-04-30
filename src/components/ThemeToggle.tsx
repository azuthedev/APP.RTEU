import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  const handleClick = (e: React.MouseEvent) => {
    // Prevent any parent handlers
    e.preventDefault();
    e.stopPropagation();
    
    // Debug log
    console.log('Toggle clicked, current theme:', theme);
    
    // Toggle theme
    toggleTheme();
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={`p-2 rounded-md transition-colors ${
        theme === 'dark' 
          ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' 
          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
      } ${className}`}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
    </button>
  );
};

export default ThemeToggle;