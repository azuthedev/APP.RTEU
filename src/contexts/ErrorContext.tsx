import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useToast } from '../components/ui/use-toast';
import { AlertTriangle } from 'lucide-react';

interface ErrorContextType {
  captureError: (error: Error | string, source?: string) => void;
  clearError: () => void;
  globalError: string | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // Function to handle capturing and logging errors
  const captureError = useCallback((error: Error | string, source = 'Application') => {
    const errorMessage = typeof error === 'string' ? error : error.message || 'An unexpected error occurred';
    
    // Set the global error state
    setGlobalError(errorMessage);
    
    // Log to console with additional information
    console.error(`[${source}] Error:`, error);
    
    // Display a toast notification
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
      action: (
        <button 
          onClick={() => clearError()}
          className="bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-xs px-2 py-1 rounded text-red-500"
        >
          Dismiss
        </button>
      )
    });
    
    // You could also send the error to a reporting service here
  }, [toast]);

  // Function to clear the current error
  const clearError = useCallback(() => {
    setGlobalError(null);
  }, []);

  // Create a memoized context value
  const contextValue = {
    captureError,
    clearError,
    globalError,
    isLoading,
    setIsLoading,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {globalError && (
        <div className="fixed top-0 left-0 right-0 bg-red-50 dark:bg-red-900/40 p-4 flex items-center justify-center z-50 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center max-w-6xl mx-auto w-full">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <div className="flex-1 text-sm text-red-700 dark:text-red-300">{globalError}</div>
            <button 
              onClick={clearError}
              className="ml-4 px-2 py-1 text-xs bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {children}
    </ErrorContext.Provider>
  );
};

// Custom hook to use the error context
export const useError = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};