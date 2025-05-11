import React, { useState, useEffect, useRef } from 'react';
import { Loader2, RefreshCw, Copy, Trash2, Download, Search, Filter, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';

// Define log entry interface
interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userAgent?: string;
  url?: string;
  sessionId?: string;
  service?: 'edge' | 'postgres' | 'postgrest' | 'pooler' | 'auth' | 'storage' | 'realtime' | 'edge-functions' | 'pgcron';
  additionalData?: object;
}

// Supabase log sources
const LOG_SOURCES = [
  { id: 'all', name: 'All Sources', description: 'Logs from all services' },
  { id: 'edge', name: 'API Gateway', description: 'API Gateway logs' },
  { id: 'postgres', name: 'Postgres', description: 'Database logs' },
  { id: 'postgrest', name: 'PostgREST', description: 'REST API logs' },
  { id: 'pooler', name: 'Connection Pooler', description: 'Connection pooling logs' },
  { id: 'auth', name: 'Auth', description: 'Authentication logs' },
  { id: 'storage', name: 'Storage', description: 'File storage logs' },
  { id: 'realtime', name: 'Realtime', description: 'Realtime subscription logs' },
  { id: 'edge-functions', name: 'Edge Functions', description: 'Serverless function logs' },
  { id: 'pgcron', name: 'Cron', description: 'Scheduled jobs logs' }
];

const ConsoleLogStream: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [isParsingLogs, setIsParsingLogs] = useState(false);
  const [uploadedLogs, setUploadedLogs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logCount, setLogCount] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h' | '24h' | '7d'>('1h');
  const [isSampleData, setIsSampleData] = useState(false);
  
  const liveModeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const { userData, refreshSession } = useAuth();

  useEffect(() => {
    // Initial load of logs
    fetchLogs();

    return () => {
      if (liveModeIntervalRef.current) {
        clearInterval(liveModeIntervalRef.current);
      }
    };
  }, [selectedSource, timeRange]);

  useEffect(() => {
    // Filter logs when search or level filter changes
    filterLogs();
  }, [logs, searchQuery, selectedLevel, selectedSource]);

  useEffect(() => {
    // Handle live mode
    if (liveMode) {
      if (liveModeIntervalRef.current) {
        clearInterval(liveModeIntervalRef.current);
      }
      
      // Fetch new logs every 5 seconds in live mode
      liveModeIntervalRef.current = setInterval(() => {
        fetchLogs(true); // true means it's a live update
        
        // Auto-scroll to top if container exists
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = 0;
        }
      }, 5000);
    } else if (liveModeIntervalRef.current) {
      clearInterval(liveModeIntervalRef.current);
    }
    
    return () => {
      if (liveModeIntervalRef.current) {
        clearInterval(liveModeIntervalRef.current);
      }
    };
  }, [liveMode, selectedSource]);

  const fetchLogs = async (isLiveUpdate = false) => {
    try {
      if (!isLiveUpdate) {
        setLoading(true);
      }
      setRefreshing(true);
      setError(null);
      
      // Verify that the user is an admin
      if (userData?.user_role !== 'admin') {
        throw new Error('Admin permissions required to view logs');
      }
      
      // Refresh the session to get a fresh JWT token
      await refreshSession();
      
      // Get current session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Call the fetch-logs edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      // Add a cachebuster query parameter to avoid any caching issues
      const cacheBuster = `cb=${Date.now()}`;
      const fetchUrl = `${supabaseUrl}/functions/v1/fetch-logs?${cacheBuster}`;
      
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({
          source: selectedSource,
          timeRange: timeRange,
          limit: 100
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 
          `Failed to fetch logs (Status ${response.status})`
        );
      }

      const result = await response.json();
      
      // If there's an error field in the response, throw it
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Check if logs exist in the response
      if (!result.logs || !Array.isArray(result.logs)) {
        throw new Error('Invalid response format from server');
      }
      
      setLogs(result.logs);
      setLogCount(result.total || result.logs.length);
      setIsSampleData(result.isSampleData || false);
      
      // Show success toast for initial load but not for live updates
      if (!isLiveUpdate) {
        toast({
          title: result.isSampleData ? "Sample Logs Loaded" : "Logs Loaded",
          description: `${result.isSampleData ? "Sample logs" : "Successfully"} loaded ${result.logs.length} logs`,
          variant: result.isSampleData ? "default" : "success",
        });
      }
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      setError(error.message || 'Failed to fetch logs. Please try again.');
      
      if (!isLiveUpdate) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to fetch logs. Please try again.",
        });
      }
      
      // If we're in live mode and hit an error, disable live mode
      if (isLiveUpdate && liveMode) {
        setLiveMode(false);
        toast({
          variant: "destructive",
          title: "Live Mode Disabled",
          description: "Encountered an error fetching logs. Live mode has been disabled.",
        });
      }
    } finally {
      if (!isLiveUpdate) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];
    
    // Apply level filter
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }
    
    // Apply source filter (if not 'all')
    if (selectedSource !== 'all') {
      filtered = filtered.filter(log => log.service === selectedSource);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        (log.userName?.toLowerCase() || '').includes(query) ||
        (log.userId?.toLowerCase() || '').includes(query) ||
        (log.url?.toLowerCase() || '').includes(query) ||
        (log.additionalData && JSON.stringify(log.additionalData).toLowerCase().includes(query))
      );
    }
    
    setFilteredLogs(filtered);
  };

  const clearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
    setIsSampleData(false);
    toast({
      title: "Logs Cleared",
      description: "All logs have been cleared from the view.",
    });
  };

  const toggleExpandLog = (id: string) => {
    if (expandedLogId === id) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(id);
    }
  };

  const handleCopyLog = async (log: LogEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      toast({
        title: "Copied to Clipboard",
        description: "Log entry copied to clipboard",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy log to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsParsingLogs(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setUploadedLogs(content);
        
        // Try to parse as JSON
        try {
          const parsedLogs = JSON.parse(content);
          if (Array.isArray(parsedLogs)) {
            // Validate and convert to our log format
            const validLogs = parsedLogs
              .filter((log) => log && typeof log === 'object' && log.message)
              .map((log) => ({
                id: log.id || `imported_${Math.random().toString(36).substring(2)}`,
                level: (log.level || 'info') as 'info' | 'warn' | 'error' | 'debug',
                message: log.message || 'Unknown message',
                timestamp: log.timestamp || new Date().toISOString(),
                userId: log.userId,
                userName: log.userName,
                userAgent: log.userAgent,
                url: log.url,
                sessionId: log.sessionId,
                service: log.service,
                additionalData: log
              }));
              
            if (validLogs.length > 0) {
              setLogs(validLogs);
              setIsSampleData(false);
              toast({
                title: "Logs Imported",
                description: `Successfully imported ${validLogs.length} log entries`,
                variant: "success",
              });
            } else {
              throw new Error("No valid logs found in the file");
            }
          } else {
            throw new Error("Uploaded file does not contain a valid array of logs");
          }
        } catch (jsonError) {
          // If not valid JSON, try to parse as console logs
          const lines = content.split('\n').filter(line => line.trim());
          
          if (lines.length > 0) {
            // Extract logs from console format (simple heuristics)
            const parsedLogs = lines.map((line, index) => {
              // Try to detect log level
              let level: 'info' | 'warn' | 'error' | 'debug' = 'info';
              if (line.includes('[ERROR]') || line.toLowerCase().includes('error')) level = 'error';
              else if (line.includes('[WARN]') || line.toLowerCase().includes('warn')) level = 'warn';
              else if (line.includes('[DEBUG]') || line.toLowerCase().includes('debug')) level = 'debug';
              
              // Try to detect service
              let service: LogEntry['service'] | undefined = undefined;
              if (line.includes('postgres')) service = 'postgres';
              else if (line.includes('auth')) service = 'auth';
              else if (line.includes('storage')) service = 'storage';
              else if (line.includes('edge function')) service = 'edge-functions';
              
              return {
                id: `imported_${index}_${Math.random().toString(36).substring(2)}`,
                level,
                message: line,
                timestamp: new Date().toISOString(),
                service,
                additionalData: { rawLog: line }
              };
            });
            
            setLogs(parsedLogs);
            setIsSampleData(false);
            toast({
              title: "Text Logs Imported",
              description: `Imported ${parsedLogs.length} log entries from text format`,
              variant: "success",
            });
          } else {
            throw new Error("No valid log lines found in the file");
          }
        }
      } catch (error: any) {
        toast({
          title: "Import Failed",
          description: error.message || "Failed to parse log file",
          variant: "destructive",
        });
      } finally {
        setIsParsingLogs(false);
      }
    };
    
    reader.onerror = () => {
      toast({
        title: "Import Failed",
        description: "Error reading the file",
        variant: "destructive",
      });
      setIsParsingLogs(false);
    };
    
    reader.readAsText(file);
  };

  const exportLogs = () => {
    const logsToExport = filteredLogs.length > 0 ? filteredLogs : logs;
    
    // Create JSON file
    const blob = new Blob([JSON.stringify(logsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Logs Exported",
      description: `Exported ${logsToExport.length} log entries to JSON file`,
      variant: "success",
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'debug':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      case 'info':
      default:
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    }
  };

  const getServiceColor = (service?: string) => {
    if (!service || service === 'all') return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    
    switch (service) {
      case 'edge':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'postgres':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'auth':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'storage':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case 'edge-functions':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300';
      case 'realtime':
        return 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300';
      case 'postgrest':
        return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300';
      case 'pgcron':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
      case 'pooler':
        return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getServiceName = (serviceId?: string) => {
    if (!serviceId) return 'Unknown';
    const source = LOG_SOURCES.find(s => s.id === serviceId);
    return source ? source.name : serviceId;
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm:ss.SSS');
    } catch {
      return 'Invalid date';
    }
  };

  const toggleLiveMode = () => {
    setLiveMode(!liveMode);
    
    if (!liveMode) {
      toast({
        title: "Live Mode Activated",
        description: "Logs will be updated automatically every 5 seconds",
        variant: "success",
      });
    } else {
      toast({
        title: "Live Mode Deactivated",
        description: "Automatic log updates stopped",
      });
    }
  };

  if (userData?.user_role !== 'admin') {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2" />
          <div>
            <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300">Admin Access Required</h3>
            <p className="mt-2 text-yellow-600 dark:text-yellow-400">
              You need administrator privileges to access the console logs. Please contact an administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white">Console Log Stream</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and analyze Supabase service logs
        </p>
        {isSampleData && (
          <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md">
            Note: Currently displaying sample data as real logs are not available
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Loading Logs</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center">
          <div className="relative flex-1 mr-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <select
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchLogs()}
            disabled={refreshing || loading}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={clearLogs}
            disabled={logs.length === 0 || loading}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Clear
          </button>
          
          <button
            onClick={toggleLiveMode}
            className={`px-3 py-2 rounded-md flex items-center ${
              liveMode 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <span className={`relative flex h-3 w-3 mr-2 ${liveMode ? 'opacity-100' : 'opacity-40'}`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${liveMode ? 'bg-green-400 opacity-75' : 'bg-gray-400 opacity-50'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${liveMode ? 'bg-green-500' : 'bg-gray-500'}`}></span>
            </span>
            {liveMode ? 'Live (On)' : 'Live Mode'}
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Log Source
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 dark:text-white"
              >
                {LOG_SOURCES.map(source => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="15m">Last 15 minutes</option>
                <option value="1h">Last hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </div>
          </div>
          
          <div>
            <div className="flex items-center space-x-2">
              <label className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Import Logs
                <input
                  type="file"
                  accept=".json,.txt,.log"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={exportLogs}
                disabled={logs.length === 0}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center disabled:opacity-50"
              >
                <Download className="w-5 h-5 mr-2" />
                Export Logs
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filteredLogs.length} logs displayed (of {logs.length} loaded, {logCount} total)
          </p>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedSource === 'all' ? 'All services' : getServiceName(selectedSource)}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
        <div className="overflow-x-auto" ref={logContainerRef} style={{ maxHeight: '600px' }}>
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Filter className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No logs found</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {logs.length > 0 
                  ? 'Try changing your search criteria or filters'
                  : 'Enable live mode or use the refresh button to fetch logs'}
              </p>
              {logs.length === 0 && (
                <button
                  onClick={() => fetchLogs()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Fetch Logs
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-16">
                    Level
                  </th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-28">
                    Time
                  </th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                    Service
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Message
                  </th>
                  <th scope="col" className="relative px-6 py-3 w-10">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => toggleExpandLog(log.id)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        expandedLogId === log.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="px-2 py-4 whitespace-nowrap">
                        <span className={`uppercase text-xs font-medium px-2 py-1 rounded-full ${getLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap">
                        {log.service && (
                          <span className={`inline-flex text-xs font-medium rounded-full px-2 py-1 ${getServiceColor(log.service)}`}>
                            {getServiceName(log.service).split(' ')[0]}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white break-all">
                        <div className="max-w-lg truncate">{log.message}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLog(log);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          <Copy className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded row */}
                    {expandedLogId === log.id && (
                      <tr className="bg-blue-50 dark:bg-blue-900/20">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-blue-100 dark:border-blue-800 overflow-hidden">
                            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800 flex justify-between">
                              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">Log Details</h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyLog(log);
                                }}
                                className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm"
                              >
                                <Copy className="h-4 w-4 inline-block mr-1" />
                                Copy JSON
                              </button>
                            </div>
                            <div className="p-4 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Timestamp (ISO)</p>
                                  <p className="text-sm text-gray-900 dark:text-white font-mono">{log.timestamp}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Service</p>
                                  <p className="text-sm text-gray-900 dark:text-white">{getServiceName(log.service || '')}</p>
                                </div>
                              </div>
                              
                              {log.sessionId && (
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Session ID</p>
                                  <p className="text-sm text-gray-900 dark:text-white font-mono">{log.sessionId}</p>
                                </div>
                              )}
                              
                              {log.userId && (
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                                  <p className="text-sm text-gray-900 dark:text-white font-mono">{log.userId}</p>
                                </div>
                              )}
                              
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Log Data</p>
                                <pre className="text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-2 rounded-md overflow-x-auto mt-1">
                                  {JSON.stringify(log.additionalData, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2" />
          <div>
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">About Supabase Logs</h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              This tool displays logs from your Supabase project's various services. Use the filters to narrow down logs 
              by service, level, or search text. Live mode automatically refreshes logs every 5 seconds. Logs are only 
              accessible to admin users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom Upload component that's missing in the imports
const Upload = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
};

const Info = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
};

export default ConsoleLogStream;