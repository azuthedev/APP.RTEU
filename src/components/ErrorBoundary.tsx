import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
    
    // You could also log to a service like Sentry here
  }
  
  handleReset = (): void => {
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700">
          <AlertTriangle className="h-16 w-16 text-red-500 dark:text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something Went Wrong</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4 text-center max-w-md">
            We're sorry, but something went wrong. Please try refreshing the page or contact support if the issue persists.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </button>
            <button 
              onClick={this.handleReset}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Try Again
            </button>
          </div>
          
          {this.state.error && import.meta.env.DEV && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-md overflow-auto max-w-full text-left w-full">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Error Details (Dev Only):</h3>
              <p className="font-mono text-sm text-red-800 dark:text-red-300 mb-2">{this.state.error.toString()}</p>
              {this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="text-sm font-medium text-red-800 dark:text-red-300 cursor-pointer">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-800 dark:text-red-300 overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;