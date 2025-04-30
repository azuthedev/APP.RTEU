import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
  height?: string;
  fullscreen?: boolean;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'Loading...',
  height = 'h-64',
  fullscreen = false
}) => {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-300">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${height} flex flex-col items-center justify-center`}>
      <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
      <p className="text-gray-600 dark:text-gray-300 text-sm">{message}</p>
    </div>
  );
};

export default LoadingFallback;