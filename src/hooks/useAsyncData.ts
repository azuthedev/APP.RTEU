import { useState, useEffect, useCallback } from 'react';
import { useError } from '../contexts/ErrorContext';

/**
 * Custom hook for handling asynchronous data fetching with loading, error states and automatic error handling
 */
export function useAsyncData<T>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = [],
  options: {
    lazy?: boolean;
    errorMessage?: string;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!options.lazy);
  const [error, setError] = useState<Error | null>(null);
  const [refreshIndex, setRefreshIndex] = useState<number>(0);
  const { captureError } = useError();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFunction();
      setData(result);
    } catch (err) {
      console.error('Error in useAsyncData:', err);
      const errorObject = err instanceof Error 
        ? err 
        : new Error(options.errorMessage || 'An error occurred while fetching data');
      
      setError(errorObject);
      captureError(errorObject, asyncFunction.name);
    } finally {
      setLoading(false);
    }
  }, [asyncFunction, captureError, options.errorMessage, ...dependencies, refreshIndex]);

  // Function to manually trigger a refresh
  const refresh = useCallback(() => {
    setRefreshIndex(prev => prev + 1);
  }, []);
  
  // Function to reset the data
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!options.lazy) {
      fetchData();
    }
  }, [fetchData, options.lazy]);

  return {
    data,
    loading,
    error,
    refresh,
    fetchData,  // Exposed for lazy loading
    reset
  };
}