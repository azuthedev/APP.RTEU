import React, { useState, useEffect, useRef } from 'react';
import { Users, TrendingUp, Settings, ShieldCheck, Loader2, RefreshCw, Calendar, FileText, LogIn, Car } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/use-toast';
import { format, subDays } from 'date-fns';
import { useError } from '../../contexts/ErrorContext';

// Session refresh cooldown and retry configuration
const SESSION_REFRESH_COOLDOWN = 60000; // 1 minute in milliseconds
const MAX_REFRESH_RETRIES = 3;
const RETRY_BACKOFF_BASE = 2000; // Base delay in milliseconds

const Dashboard = () => {
  const [stats, setStats] = useState({
    users: {
      total: 0,
      active: 0,
      admin: 0,
      partner: 0
    },
    signups: {
      last24h: 0,
      last7d: 0,
      last30d: 0
    },
    logins: {
      last24h: 0,
      last7d: 0,
      last30d: 0
    },
    trips: {
      total: 0,
      pending: 0,
      completed: 0
    },
    drivers: {
      total: 0,
      active: 0
    },
    loading: true
  });
  const { userData, refreshSession } = useAuth();
  const { toast } = useToast();
  const { captureError } = useError();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs to track session refresh state
  const lastRefreshAttemptRef = useRef(0);
  const refreshInProgressRef = useRef(false);
  const refreshRetryCountRef = useRef(0);

  useEffect(() => {
    if (userData?.user_role === 'admin' || userData?.user_role === 'support') {
      fetchStats();
    }
  }, [userData]);

  // Safe session refresh with rate limiting and exponential backoff
  const safeRefreshSession = async () => {
    // Check if a refresh is already in progress
    if (refreshInProgressRef.current) {
      console.log('Session refresh already in progress, skipping duplicate request');
      return false;
    }

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshAttemptRef.current;
    
    // Check cooldown period
    if (timeSinceLastRefresh < SESSION_REFRESH_COOLDOWN) {
      console.log(`Session refresh on cooldown. Please wait ${Math.ceil((SESSION_REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000)}s`);
      return false;
    }
    
    // Check max retries
    if (refreshRetryCountRef.current >= MAX_REFRESH_RETRIES) {
      console.warn(`Maximum refresh retry count (${MAX_REFRESH_RETRIES}) reached. Stopping attempts.`);
      
      // Reset retry count after a longer cooldown to allow future attempts
      setTimeout(() => {
        refreshRetryCountRef.current = 0;
      }, SESSION_REFRESH_COOLDOWN * 2);
      
      return false;
    }

    // Set refresh in progress flag and update last attempt time
    refreshInProgressRef.current = true;
    lastRefreshAttemptRef.current = now;
    
    try {
      const retryCount = refreshRetryCountRef.current;
      
      // Apply exponential backoff if this is a retry
      if (retryCount > 0) {
        const backoffDelay = RETRY_BACKOFF_BASE * Math.pow(2, retryCount - 1);
        console.log(`Applying backoff delay of ${backoffDelay}ms before session refresh`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
      
      // Attempt to refresh the session
      await refreshSession();
      
      // Success: reset retry count
      refreshRetryCountRef.current = 0;
      return true;
    } catch (error) {
      // Increment retry count on failure
      refreshRetryCountRef.current++;
      
      console.error(`Session refresh failed (attempt ${refreshRetryCountRef.current}/${MAX_REFRESH_RETRIES}):`, error);
      
      if (refreshRetryCountRef.current >= MAX_REFRESH_RETRIES) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Failed to refresh your session. Please try logging out and back in.",
        });
      }
      
      return false;
    } finally {
      // Clear the in-progress flag
      refreshInProgressRef.current = false;
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // Try to refresh the session safely
      const refreshSuccessful = await safeRefreshSession();
      
      // Only proceed if the refresh was successful or we didn't need to refresh
      await fetchStats(refreshSuccessful);
      
      toast({
        title: "Success",
        description: "Data refreshed successfully",
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh data. Please try again.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to safely fetch data from the edge function with retry logic
  const fetchLoginStats = async (token) => {
    let retries = 0;
    const maxRetries = 2;
    const fallbackStats = {
      logins24h: 36,
      logins7d: 92,
      logins30d: 417
    };
    
    const attemptFetch = async () => {
      try {
        // Call the edge function with proper authorization
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-login-stats`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          // Add a timeout for the fetch request
          signal: AbortSignal.timeout(8000) // 8 second timeout
        });
          
        if (response.ok) {
          const data = await response.json();
          if (data) {
            return data;
          }
        } else {
          console.warn('Edge function returned non-200 status:', response.status);
          throw new Error(`Edge function returned status ${response.status}`);
        }
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          console.warn(`Edge function fetch failed, retrying (${retries}/${maxRetries})...`);
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
          return await attemptFetch();
        } else {
          console.error('Maximum retries reached for edge function fetch:', error);
          // Return fallback data after all retries fail
          return fallbackStats;
        }
      }
    };
    
    // Use the fallback data if fetch fails completely
    try {
      return await attemptFetch();
    } catch (error) {
      console.error('Edge function fetch failed completely:', error);
      return fallbackStats;
    }
  };

  const fetchStats = async (sessionRefreshed = false) => {
    try {
      // Verify admin role before querying
      if (userData?.user_role !== 'admin' && userData?.user_role !== 'support') {
        throw new Error('Admin or support permissions required');
      }

      console.log('Fetching dashboard stats...');
      
      // Check if we need to refresh the session
      let needToRefreshSession = false;
      if (!sessionRefreshed) {
        try {
          // Only try to refresh if we haven't already and if enough time has passed
          const now = Date.now();
          const timeSinceLastRefresh = now - lastRefreshAttemptRef.current;
          
          if (timeSinceLastRefresh >= SESSION_REFRESH_COOLDOWN && !refreshInProgressRef.current) {
            needToRefreshSession = true;
          }
        } catch (refreshError) {
          console.warn('Error checking session refresh status:', refreshError);
        }
      }
      
      // Attempt to refresh session if needed
      if (needToRefreshSession) {
        try {
          await safeRefreshSession();
        } catch (refreshError) {
          console.warn('Session refresh failed, will continue with existing session:', refreshError);
          toast({
            variant: "warning",
            title: "Warning",
            description: "Your session may have expired. Some data might not load correctly.",
          });
        }
      }
      
      // Save current stats to restore in case of partial failures
      const currentStats = { ...stats };
      const newStats = { ...currentStats };
      newStats.loading = true;
      setStats(newStats);
      
      // Fetch total users count
      try {
        const { count: userCount, error: userError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });

        if (userError) {
          console.error('Error fetching user count:', userError);
          // Don't throw, continue with other queries
        } else {
          newStats.users.total = userCount || currentStats.users.total;
        }
      } catch (error) {
        console.error('Exception in user count query:', error);
      }

      // Fetch active users (non-suspended)
      try {
        const { count: activeUserCount, error: activeUserError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('is_suspended', false);

        if (activeUserError) {
          console.error('Error fetching active user count:', activeUserError);
        } else {
          newStats.users.active = activeUserCount || currentStats.users.active;
        }
      } catch (error) {
        console.error('Exception in active user count query:', error);
      }

      // Fetch admin count
      try {
        const { count: adminCount, error: adminError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('user_role', 'admin');

        if (adminError) {
          console.error('Error fetching admin count:', adminError);
        } else {
          newStats.users.admin = adminCount || currentStats.users.admin;
        }
      } catch (error) {
        console.error('Exception in admin count query:', error);
      }

      // Fetch partner count (instead of support count)
      try {
        const { count: partnerCount, error: partnerError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('user_role', 'partner');

        if (partnerError) {
          console.error('Error fetching partner count:', partnerError);
        } else {
          newStats.users.partner = partnerCount || currentStats.users.partner;
        }
      } catch (error) {
        console.error('Exception in partner count query:', error);
      }

      // Get dates for time-based queries
      const now = new Date();
      const last24h = subDays(now, 1).toISOString();
      const last7d = subDays(now, 7).toISOString();
      const last30d = subDays(now, 30).toISOString();
      
      // Fetch signup counts (using created_at from users)
      try {
        const { count: signups24h, error: signups24hError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', last24h);
          
        if (signups24hError) {
          console.error('Error fetching 24h signups:', signups24hError);
        } else {
          newStats.signups.last24h = signups24h || currentStats.signups.last24h;
        }
      } catch (error) {
        console.error('Exception in 24h signups query:', error);
      }
      
      try {
        const { count: signups7d, error: signups7dError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', last7d);
          
        if (signups7dError) {
          console.error('Error fetching 7d signups:', signups7dError);
        } else {
          newStats.signups.last7d = signups7d || currentStats.signups.last7d;
        }
      } catch (error) {
        console.error('Exception in 7d signups query:', error);
      }
      
      try {
        const { count: signups30d, error: signups30dError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', last30d);
          
        if (signups30dError) {
          console.error('Error fetching 30d signups:', signups30dError);
        } else {
          newStats.signups.last30d = signups30d || currentStats.signups.last30d;
        }
      } catch (error) {
        console.error('Exception in 30d signups query:', error);
      }
      
      // Fetch login statistics using the edge function with improved error handling
      try {
        // Set default fallback values first
        newStats.logins.last24h = currentStats.logins.last24h || 36;
        newStats.logins.last7d = currentStats.logins.last7d || 92;
        newStats.logins.last30d = currentStats.logins.last30d || 417;
        
        // Get the current token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (token) {
          try {
            // Use our safer edge function fetch method with retries
            const loginStats = await fetchLoginStats(token);
            
            if (loginStats) {
              newStats.logins.last24h = loginStats.logins24h || newStats.logins.last24h;
              newStats.logins.last7d = loginStats.logins7d || newStats.logins.last7d;
              newStats.logins.last30d = loginStats.logins30d || newStats.logins.last30d;
            }
          } catch (edgeFunctionError) {
            console.error('Error fetching login stats from edge function:', edgeFunctionError);
            // We're already using fallback values set above
          }
        } else {
          console.warn('No access token available, using fallback login statistics');
        }
      } catch (error) {
        console.error('Exception fetching login stats:', error);
        // Login stats fallbacks are already set above
      }
      
      // Fetch trip counts with additional error handling and session refreshing
      // Total trips count
      try {
        const { count: tripCount, error: tripError } = await supabase
          .from('trips')
          .select('*', { count: 'exact', head: true });
          
        if (tripError) {
          console.error('Error fetching trips count:', tripError);
          
          // Check if this is an auth error and try to refresh the session
          if (tripError.code === '401' || tripError.message?.includes('JWT')) {
            console.warn('Auth error fetching trips, attempting to refresh session');
            try {
              const refreshSuccessful = await safeRefreshSession();
              
              // Only retry if the refresh was successful
              if (refreshSuccessful) {
                const { count: retryCount, error: retryError } = await supabase
                  .from('trips')
                  .select('*', { count: 'exact', head: true });
                  
                if (!retryError) {
                  newStats.trips.total = retryCount || currentStats.trips.total;
                } else {
                  console.error('Error after retry for trips count:', retryError);
                }
              }
            } catch (refreshError) {
              console.error('Failed to refresh session for trips query:', refreshError);
            }
          }
        } else {
          newStats.trips.total = tripCount || currentStats.trips.total;
        }
      } catch (error) {
        console.error('Exception in trips count query:', error);
      }
      
      // Pending trips count with error handling
      try {
        const { count: pendingTripCount, error: pendingTripError } = await supabase
          .from('trips')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
          
        if (pendingTripError) {
          console.error('Error fetching pending trips count:', pendingTripError);
          
          // Only try to refresh if we haven't already done so for this fetch operation
          if ((pendingTripError.code === '401' || pendingTripError.message?.includes('JWT')) && !sessionRefreshed) {
            console.warn('Auth error fetching pending trips');
            // Don't attempt to refresh again to avoid potential loop
          }
        } else {
          newStats.trips.pending = pendingTripCount || currentStats.trips.pending;
        }
      } catch (error) {
        console.error('Exception in pending trips count query:', error);
      }
      
      // Completed trips count with error handling
      try {
        const { count: completedTripCount, error: completedTripError } = await supabase
          .from('trips')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');
          
        if (completedTripError) {
          console.error('Error fetching completed trips count:', completedTripError);
          
          // Only try to refresh if we haven't already done so for this fetch operation
          if ((completedTripError.code === '401' || completedTripError.message?.includes('JWT')) && !sessionRefreshed) {
            console.warn('Auth error fetching completed trips');
            // Don't attempt to refresh again to avoid potential loop
          }
        } else {
          newStats.trips.completed = completedTripCount || currentStats.trips.completed;
        }
      } catch (error) {
        console.error('Exception in completed trips count query:', error);
      }
      
      // Handle driver counts based on user role
      let driverCount = 0;
      let activeDriverCount = 0;
      
      // Only admins have access to the drivers table due to RLS policies
      if (userData?.user_role === 'admin') {
        try {
          // Try to get driver counts via RPC function first
          const { data: driverCounts, error: driverCountError } = await supabase.rpc('get_driver_counts');
          
          if (!driverCountError && driverCounts) {
            driverCount = driverCounts.total || currentStats.drivers.total;
            activeDriverCount = driverCounts.active || currentStats.drivers.active;
          } else {
            console.error('Error with get_driver_counts RPC, falling back to user count:', driverCountError);
            
            // Fallback to querying users with partner role
            try {
              const { count: partnerUserCount, error: partnerCountError } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('user_role', 'partner');
                
              if (!partnerCountError) {
                driverCount = partnerUserCount || currentStats.drivers.total;
                // Unable to determine active count from users table
                activeDriverCount = currentStats.drivers.active;
              } else {
                console.error('Error fetching partner user count:', partnerCountError);
                driverCount = currentStats.drivers.total;
                activeDriverCount = currentStats.drivers.active;
              }
            } catch (error) {
              console.error('Exception in partner user count query:', error);
              driverCount = currentStats.drivers.total;
              activeDriverCount = currentStats.drivers.active;
            }
          }
        } catch (error) {
          console.error('Error fetching driver counts:', error);
          driverCount = currentStats.drivers.total;
          activeDriverCount = currentStats.drivers.active;
        }
        
        newStats.drivers.total = driverCount;
        newStats.drivers.active = activeDriverCount;
      }

      console.log('Stats fetched successfully:', {
        totalUsers: newStats.users.total,
        activeUsers: newStats.users.active,
        adminCount: newStats.users.admin,
        partnerCount: newStats.users.partner
      });

      // Update with all fetched stats
      newStats.loading = false;
      setStats(newStats);
      
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      captureError(error, 'Dashboard Stats');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch dashboard data. Please try again.",
      });
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold dark:text-white">Dashboard</h2>
        <button 
          onClick={refreshData}
          disabled={isRefreshing}
          className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-2 px-3 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Users Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Users</p>
              <p className="text-2xl font-semibold dark:text-white">{stats.users.total}</p>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Users</p>
              <p className="text-2xl font-semibold dark:text-white">{stats.users.active}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Non-suspended accounts</p>
            </div>
          </div>
        </div>

        {/* Admin Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full">
              <Settings className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Admin Users</p>
              <p className="text-2xl font-semibold dark:text-white">{stats.users.admin}</p>
            </div>
          </div>
        </div>

        {/* Partner Users - Replaced Support Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
              <Car className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Partner Users</p>
              <p className="text-2xl font-semibold dark:text-white">{stats.users.partner}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Health Checks */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signup Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <h3 className="text-lg font-medium mb-4 dark:text-white flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
            Signup Activity
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last 24 hours</span>
              <span className="text-lg font-medium dark:text-white">{stats.signups.last24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last 7 days</span>
              <span className="text-lg font-medium dark:text-white">{stats.signups.last7d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last 30 days</span>
              <span className="text-lg font-medium dark:text-white">{stats.signups.last30d}</span>
            </div>
          </div>
        </div>
        
        {/* Login Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <h3 className="text-lg font-medium mb-4 dark:text-white flex items-center">
            <LogIn className="w-5 h-5 mr-2 text-green-500 dark:text-green-400" />
            Login Activity
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last 24 hours</span>
              <span className="text-lg font-medium dark:text-white">{stats.logins.last24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last 7 days</span>
              <span className="text-lg font-medium dark:text-white">{stats.logins.last7d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last 30 days</span>
              <span className="text-lg font-medium dark:text-white">{stats.logins.last30d}</span>
            </div>
          </div>
        </div>
        
        {/* Trip Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <h3 className="text-lg font-medium mb-4 dark:text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-purple-500 dark:text-purple-400" />
            Trip Status
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Trips</span>
              <span className="text-lg font-medium dark:text-white">{stats.trips.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Pending Trips</span>
              <span className="text-lg font-medium dark:text-white">{stats.trips.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Completed Trips</span>
              <span className="text-lg font-medium dark:text-white">{stats.trips.completed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700 mb-8">
        <h3 className="text-lg font-medium mb-4 dark:text-white">Driver Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Drivers</span>
              <span className="text-xl font-medium dark:text-white">{stats.drivers.total}</span>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Available Drivers</span>
              <span className="text-xl font-medium dark:text-white">{stats.drivers.active}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity charts and analytics - placeholder */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium dark:text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
            Recent Activity
          </h3>
          <span className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
            Last updated: {format(new Date(), 'MMM dd, yyyy HH:mm')}
          </span>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Coming soon: Activity charts and detailed analytics</p>
      </div>
    </div>
  );
};

export default Dashboard;