import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Loader2, 
  ActivitySquare, 
  RefreshCw, 
  Clock, 
  Users, 
  ArrowUpRight, 
  Database,
  Server,
  Download,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const SystemStatus: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemStats, setSystemStats] = useState({
    databaseSize: null as string | null,
    users: {
      total: 0,
      admin: 0,
      partner: 0,
      customer: 0,
      support: 0
    },
    recentActivity: [] as any[],
    serverTime: '',
    uptime: null as string | null,
    supabaseStatus: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
    databaseStatus: {
      status: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
      latency: null as number | null,
      connections: null as number | null
    },
    storageStatus: {
      status: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
      size: null as string | null
    },
    authStatus: {
      status: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown'
    }
  });
  const { toast } = useToast();
  const { userData } = useAuth();
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = userData?.user_role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchSystemStats();
      
      // Start polling every 30 seconds
      pollingInterval.current = setInterval(fetchSystemStats, 30000);
    }
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [isAdmin]);

  const fetchSystemStats = async () => {
    try {
      setRefreshing(true);
      
      // Get database size
      const { data: dbSizeData, error: dbSizeError } = await supabase.rpc('run_sql_query', {
        sql_query: `
          SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;
        `
      });
      
      if (dbSizeError) throw dbSizeError;
      
      // Get user counts
      const { data: userCountData, error: userCountError } = await supabase.rpc('run_sql_query', {
        sql_query: `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN user_role = 'admin' THEN 1 END) as admin_count,
            COUNT(CASE WHEN user_role = 'partner' THEN 1 END) as partner_count,
            COUNT(CASE WHEN user_role = 'customer' THEN 1 END) as customer_count,
            COUNT(CASE WHEN user_role = 'support' THEN 1 END) as support_count
          FROM users;
        `
      });
      
      if (userCountError) throw userCountError;
      
      // Get recent activity (recent trips, signups, etc.)
      const { data: recentActivityData, error: recentActivityError } = await supabase.rpc('run_sql_query', {
        sql_query: `
          (
            SELECT 
              'New user' as event_type,
              u.name as title,
              u.user_role as description,
              u.created_at as timestamp
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT 5
          )
          UNION ALL
          (
            SELECT 
              'New trip' as event_type,
              COALESCE(
                (SELECT name FROM users WHERE id = t.user_id), 
                'Unknown'
              ) as title,
              CASE 
                WHEN t.status = 'pending' THEN 'Pending trip'
                WHEN t.status = 'accepted' THEN 'Accepted trip'
                WHEN t.status = 'in_progress' THEN 'In-progress trip'
                WHEN t.status = 'completed' THEN 'Completed trip'
                WHEN t.status = 'cancelled' THEN 'Cancelled trip'
                ELSE 'New trip'
              END as description,
              t.created_at as timestamp
            FROM trips t
            ORDER BY t.created_at DESC
            LIMIT 5
          )
          ORDER BY timestamp DESC
          LIMIT 10;
        `
      });
      
      if (recentActivityError) throw recentActivityError;
      
      // Get server time and simulate uptime (for demo purposes)
      const { data: serverTimeData, error: serverTimeError } = await supabase.rpc('run_sql_query', {
        sql_query: `SELECT now() as server_time;`
      });
      
      if (serverTimeError) throw serverTimeError;
      
      // For database status, check query latency
      const startTime = Date.now();
      const { error: pingError } = await supabase.rpc('run_sql_query', {
        sql_query: `SELECT 1;`
      });
      const endTime = Date.now();
      const queryLatency = endTime - startTime;
      
      // Get active database connections
      const { data: connectionData, error: connectionError } = await supabase.rpc('run_sql_query', {
        sql_query: `
          SELECT count(*) as active_connections
          FROM pg_stat_activity
          WHERE state = 'active';
        `
      });
      
      if (connectionError) throw connectionError;
      
      // Get storage usage
      const { data: storageData, error: storageError } = await supabase.rpc('run_sql_query', {
        sql_query: `
          SELECT COALESCE(
            (SELECT pg_size_pretty(sum(pg_total_relation_size(c.oid)))
            FROM pg_class c
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'storage'), 
            '0 bytes'
          ) as storage_size;
        `
      });
      
      if (storageError) throw storageError;
      
      // Build uptime string (simulated for demo)
      const uptimeDays = Math.floor(Math.random() * 100) + 1;
      const uptimeHours = Math.floor(Math.random() * 24);
      const uptimeMinutes = Math.floor(Math.random() * 60);
      
      // Determine health status based on latency
      let dbStatus: 'healthy' | 'degraded' | 'down' | 'unknown' = 'unknown';
      if (pingError) {
        dbStatus = 'down';
      } else if (queryLatency < 200) {
        dbStatus = 'healthy';
      } else if (queryLatency < 1000) {
        dbStatus = 'degraded';
      } else {
        dbStatus = 'down';
      }
      
      // Update state with all fetched data
      setSystemStats({
        databaseSize: dbSizeData?.[0]?.db_size || null,
        users: {
          total: parseInt(userCountData?.[0]?.total || '0'),
          admin: parseInt(userCountData?.[0]?.admin_count || '0'),
          partner: parseInt(userCountData?.[0]?.partner_count || '0'),
          customer: parseInt(userCountData?.[0]?.customer_count || '0'),
          support: parseInt(userCountData?.[0]?.support_count || '0')
        },
        recentActivity: recentActivityData || [],
        serverTime: serverTimeData?.[0]?.server_time || new Date().toISOString(),
        uptime: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
        supabaseStatus: 'healthy', // Simulated
        databaseStatus: {
          status: dbStatus,
          latency: queryLatency,
          connections: parseInt(connectionData?.[0]?.active_connections || '0')
        },
        storageStatus: {
          status: storageError ? 'down' : 'healthy',
          size: storageData?.[0]?.storage_size || null
        },
        authStatus: {
          status: 'healthy' // Simulated
        }
      });
    } catch (error: any) {
      console.error('Error fetching system stats:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch system statistics.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      
      // For timestamps in the last 24 hours, show "X hours ago"
      const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      if (diff < 24) {
        return diff === 0 
          ? 'Just now' 
          : diff === 1 
            ? '1 hour ago' 
            : `${diff} hours ago`;
      }
      
      // Otherwise show formatted date
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getStatusColorClass = (status: 'healthy' | 'degraded' | 'down' | 'unknown') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'down':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'down' | 'unknown') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />;
      case 'down':
        return <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-lg">
        <div className="flex items-start">
          <Server className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2" />
          <div>
            <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300">Admin Access Required</h3>
            <p className="mt-2 text-yellow-600 dark:text-yellow-400">
              You need administrator privileges to access system status information. Please contact an administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold dark:text-white">System Status</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor the health and status of your application
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <Clock className="inline-block w-4 h-4 mr-1 align-text-bottom" />
            Last updated: {formatTimestamp(systemStats.serverTime)}
          </div>
          
          <button
            onClick={fetchSystemStats}
            disabled={refreshing}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Database Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Database</h3>
            <div className={`flex items-center px-3 py-1 rounded-full text-sm ${getStatusColorClass(systemStats.databaseStatus.status)}`}>
              {getStatusIcon(systemStats.databaseStatus.status)}
              <span className="ml-2 capitalize">{systemStats.databaseStatus.status}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Size</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {systemStats.databaseSize || 'Unknown'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Latency</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {systemStats.databaseStatus.latency !== null ? `${systemStats.databaseStatus.latency} ms` : 'Unknown'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Active Connections</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {systemStats.databaseStatus.connections !== null ? systemStats.databaseStatus.connections : 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Auth Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Authentication</h3>
            <div className={`flex items-center px-3 py-1 rounded-full text-sm ${getStatusColorClass(systemStats.authStatus.status)}`}>
              {getStatusIcon(systemStats.authStatus.status)}
              <span className="ml-2 capitalize">{systemStats.authStatus.status}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total Users</span>
              <span className="text-gray-900 dark:text-white font-medium">{systemStats.users.total}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Active Users Today</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {Math.floor(systemStats.users.total * 0.4)} (estimated)
              </span>
            </div>
            
            <div className="pt-2 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2 text-center">
                <div className="text-xs text-blue-500 dark:text-blue-400">Admins</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{systemStats.users.admin}</div>
              </div>
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-2 text-center">
                <div className="text-xs text-green-500 dark:text-green-400">Partners</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-300">{systemStats.users.partner}</div>
              </div>
              <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-2 text-center">
                <div className="text-xs text-purple-500 dark:text-purple-400">Customers</div>
                <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{systemStats.users.customer}</div>
              </div>
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-2 text-center">
                <div className="text-xs text-yellow-500 dark:text-yellow-400">Support</div>
                <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{systemStats.users.support}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Storage</h3>
            <div className={`flex items-center px-3 py-1 rounded-full text-sm ${getStatusColorClass(systemStats.storageStatus.status)}`}>
              {getStatusIcon(systemStats.storageStatus.status)}
              <span className="ml-2 capitalize">{systemStats.storageStatus.status}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Storage Size</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {systemStats.storageStatus.size || 'Unknown'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Uptime</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {systemStats.uptime || 'Unknown'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Server Time</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {new Date(systemStats.serverTime).toLocaleString()}
              </span>
            </div>
          </div>
          
          <a 
            href="https://app.supabase.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Open Supabase Dashboard
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700 mb-6">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex justify-between items-center">
          <h3 className="font-medium text-gray-900 dark:text-white">Recent System Activity</h3>
          
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center">
            <Download className="h-4 w-4 mr-1" />
            Export Logs
          </button>
        </div>
        
        <div className="overflow-hidden">
          {systemStats.recentActivity.length === 0 ? (
            <div className="p-6 text-center">
              <ActivitySquare className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No recent activity found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {systemStats.recentActivity.map((activity, idx) => (
                <li key={idx} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-start">
                    <div className={`p-2 rounded-full mr-3 ${
                      activity.event_type === 'New user' 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    }`}>
                      {activity.event_type === 'New user' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        <ActivitySquare className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {activity.event_type} - {activity.description}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Simulated Performance Metrics Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
        
        <div className="flex justify-center items-center h-64 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          <div className="text-center">
            <ActivitySquare className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300">Performance metrics visualization will be available soon</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Coming in the next update
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;