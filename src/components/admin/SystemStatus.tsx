import React, { useState, useEffect } from 'react';
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
  Server,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { adminApi } from '../../lib/adminApi';

const SystemStatus: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemStats, setSystemStats] = useState({
    users: {
      total: 0,
      admin: 0,
      partner: 0,
      customer: 0,
      support: 0
    },
    recentActivity: [] as any[],
    serverTime: '',
    supabaseStatus: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
    authStatus: {
      status: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown'
    },
    storageStatus: {
      status: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
    },
    priceEngineStatus: {
      status: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
      timestamp: null as string | null
    }
  });
  
  const { toast } = useToast();
  const { userData } = useAuth();
  const isAdmin = userData?.user_role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchSystemStats();
    }
  }, [isAdmin]);

  const fetchSystemStats = async () => {
    try {
      setRefreshing(true);
      
      // Check price engine health
      const priceEngineStatus = await checkPriceEngineHealth();
      
      // Get user counts
      const { count: totalUsers = 0 } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      const { count: adminUsers = 0 } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('user_role', 'admin');
      
      const { count: partnerUsers = 0 } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('user_role', 'partner');
      
      const { count: customerUsers = 0 } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('user_role', 'customer');
      
      const { count: supportUsers = 0 } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('user_role', 'support');
      
      // Fetch recent users (avoid using user:users!)
      const { data: recentUsers } = await supabase
        .from('users')
        .select('name, user_role, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Fetch recent trips (use explicit joins to avoid ambiguity)
      const { data: recentTrips } = await supabase
        .from('trips')
        .select(`
          id,
          status,
          datetime,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Get user names for trips
      let tripActivity = [];
      if (recentTrips?.length) {
        const userIds = recentTrips.map(trip => trip.user_id).filter(id => id);
        const { data: tripUsers } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);
        
        const userMap = (tripUsers || []).reduce((map, user) => {
          map[user.id] = user.name;
          return map;
        }, {});
        
        tripActivity = recentTrips.map(trip => ({
          event_type: 'New trip',
          title: userMap[trip.user_id] || 'Unknown',
          description: `${trip.status} trip`,
          timestamp: trip.datetime
        }));
      }
      
      // Manually combine the activity data
      const recentActivity = [
        ...(recentUsers?.map(user => ({
          event_type: 'New user',
          title: user.name,
          description: user.user_role,
          timestamp: user.created_at
        })) || []),
        ...tripActivity
      ].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 10);

      // Update state with the fetched data
      setSystemStats({
        users: {
          total: totalUsers,
          admin: adminUsers,
          partner: partnerUsers,
          customer: customerUsers,
          support: supportUsers
        },
        recentActivity,
        serverTime: new Date().toISOString(),
        supabaseStatus: 'healthy',
        authStatus: {
          status: 'healthy'
        },
        storageStatus: {
          status: 'healthy'
        },
        priceEngineStatus
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

  const checkPriceEngineHealth = async () => {
    try {
      const controller = new AbortController();
      // Set a timeout to prevent hanging requests
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://get-price-941325580206.europe-southwest1.run.app/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          status: 'down' as const,
          timestamp: null
        };
      }

      const data = await response.json();
      
      if (data && data.status === 'healthy') {
        return {
          status: 'healthy' as const,
          timestamp: data.timestamp
        };
      }
      
      return {
        status: 'degraded' as const,
        timestamp: data.timestamp
      };
    } catch (error) {
      console.error('Error checking price engine health:', error);
      return {
        status: 'down' as const,
        timestamp: null
      };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'PPp');
    } catch {
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
        {/* Auth & Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
              Authentication
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
              <div className={`flex items-center px-3 py-1 rounded-full text-xs ${getStatusColorClass(systemStats.authStatus.status)}`}>
                {getStatusIcon(systemStats.authStatus.status)}
                <span className="ml-2 capitalize">{systemStats.authStatus.status}</span>
              </div>
            </div>
            
            <div className="mt-3">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Users</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{systemStats.users.total}</span>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-2">
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
        </div>

        {/* Storage Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
              <Server className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
              Supabase
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
              <div className={`flex items-center px-3 py-1 rounded-full text-xs ${getStatusColorClass(systemStats.supabaseStatus)}`}>
                {getStatusIcon(systemStats.supabaseStatus)}
                <span className="ml-2 capitalize">{systemStats.supabaseStatus}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Storage</div>
              <div className={`flex items-center px-3 py-1 rounded-full text-xs ${getStatusColorClass(systemStats.storageStatus.status)}`}>
                {getStatusIcon(systemStats.storageStatus.status)}
                <span className="ml-2 capitalize">{systemStats.storageStatus.status}</span>
              </div>
            </div>
            
            <div className="mt-6">
              <a 
                href="https://app.supabase.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Open Supabase Dashboard
              </a>
            </div>
          </div>
        </div>

        {/* Price Engine Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
              <Zap className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
              Price Engine
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
              <div className={`flex items-center px-3 py-1 rounded-full text-xs ${getStatusColorClass(systemStats.priceEngineStatus.status)}`}>
                {getStatusIcon(systemStats.priceEngineStatus.status)}
                <span className="ml-2 capitalize">{systemStats.priceEngineStatus.status}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-3 mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Last Check</div>
              <div className="text-sm text-gray-900 dark:text-white">
                {systemStats.priceEngineStatus.timestamp 
                  ? formatTimestamp(systemStats.priceEngineStatus.timestamp) 
                  : 'Unknown'}
              </div>
            </div>
            
            <div className="mt-6">
              <a 
                href="https://get-price-941325580206.europe-southwest1.run.app/health" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                <Zap className="h-4 w-4 mr-2" />
                Check Service Health
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700 mb-6">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <h3 className="font-medium text-gray-900 dark:text-white">Recent System Activity</h3>
        </div>
        
        <div className="overflow-hidden">
          {systemStats.recentActivity.length === 0 ? (
            <div className="p-6 text-center">
              <ActivitySquare className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No recent activity found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
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
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.title}
                      </p>
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
    </div>
  );
};

export default SystemStatus;
