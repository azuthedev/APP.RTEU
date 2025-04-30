import { useState, useCallback } from 'react';
import { useError } from '../contexts/ErrorContext';

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  errorMessage?: string;
  autoReset?: boolean;
  resetTime?: number;
}

export function useApi<T = any>(
  apiFunc: (...args: any[]) => Promise<T>,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<ApiStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const { captureError } = useError();
  
  const {
    onSuccess,
    onError,
    errorMessage = 'An error occurred while fetching data.',
    autoReset = false,
    resetTime = 3000
  } = options;

  const execute = useCallback(async (...args: any[]) => {
    setStatus('loading');
    setError(null);
    
    try {
      const result = await apiFunc(...args);
      setData(result);
      setStatus('success');
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return { data: result, error: null };
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(errorMessage);
      setError(errorObj);
      setStatus('error');
      
      // Use the error service to handle this error
      captureError(errorObj, apiFunc.name || 'API Call');
      
      if (onError) {
        onError(errorObj);
      }
      
      // Auto-reset status after specified time if enabled
      if (autoReset) {
        setTimeout(() => {
          setStatus('idle');
        }, resetTime);
      }
      
      return { data: null, error: errorObj };
    }
  }, [apiFunc, onSuccess, onError, errorMessage, autoReset, resetTime, captureError]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setData(null);
  }, []);

  return {
    data,
    status,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    execute,
    reset
  };
}