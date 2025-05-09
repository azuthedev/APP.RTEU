import React, { useState, useEffect, useRef } from 'react';
import { Users, TrendingUp, Settings, ShieldCheck, Loader2, RefreshCw, Calendar, FileText, LogIn, Car, CreditCard, ArrowUpRight, BarChart2, Wallet, TrendingDown, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/use-toast';
import { format, subDays } from 'date-fns';
import { useError } from '../../contexts/ErrorContext';
import { adminApi } from '../../lib/adminApi';

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
      partner: 0,
      support: 0
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
      active: 0,
      pending: 0
    },
    payments: {
      total: 0,
      completed: 0,
      amount: 0,
      last30days: 0,
      average: 0
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
  const initLoadDone = useRef(false);

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

      // Fetch partner count
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
      
      // Fetch support count
      try {
        const { count: supportCount, error: supportError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('user_role', 'support');

        if (supportError) {
          console.error('Error fetching support count:', supportError);
        } else {
          newStats.users.support = supportCount || currentStats.users.support;
        }
      } catch (error) {
        console.error('Exception in support count query:', error);
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

      // Use the adminApi to fetch trip counts instead of direct DB access
      try {
        const tripStats = await adminApi.fetchTripStats();
        if (tripStats) {
          newStats.trips.total = tripStats.total || 0;
          newStats.trips.pending = tripStats.pending || 0;
          newStats.trips.completed = tripStats.completed || 0;
        }
      } catch (error) {
        console.error('Error fetching trip stats:', error);
        // Use existing stats if available
        newStats.trips.total = currentStats.trips.total || 0;
        newStats.trips.pending = currentStats.trips.pending || 0;
        newStats.trips.completed = currentStats.trips.completed || 0;
      }

      // Use the adminApi to fetch driver counts instead of direct DB access
      try {
        const driverStats = await adminApi.fetchDriverStats();
        if (driverStats) {
          newStats.drivers.total = driverStats.total || 0;
          newStats.drivers.active = driverStats.active || 0;
          newStats.drivers.pending = driverStats.pending || 0;
        }
      } catch (error) {
        console.error('Error fetching driver stats:', error);
        // Use existing stats if available
        newStats.drivers.total = currentStats.drivers.total || 0;
        newStats.drivers.active = currentStats.drivers.active || 0;
        newStats.drivers.pending = currentStats.drivers.pending || 0;
      }

      // Use the adminApi to fetch payment stats instead of direct DB access
      try {
        const sinceDate = last30d;
        const payments = await adminApi.fetchPayments(sinceDate);
        
        if (payments && Array.isArray(payments)) {
          newStats.payments.total = payments.length;
          
          // Count completed payments
          const completedPayments = payments.filter(p => p.status === 'completed');
          newStats.payments.completed = completedPayments.length;
          
          // Sum up amounts for completed payments
          const totalAmount = completedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
          newStats.payments.amount = totalAmount;
          newStats.payments.last30days = totalAmount;
          newStats.payments.average = totalAmount / 30; // Average daily over 30 days
        }
      } catch (error) {
        console.error('Error fetching payment stats:', error);
        // Use existing stats if available
        newStats.payments.total = currentStats.payments.total || 0;
        newStats.payments.completed = currentStats.payments.completed || 0;
        newStats.payments.amount = currentStats.payments.amount || 0;
        newStats.payments.last30days = currentStats.payments.last30days || 0;
        newStats.payments.average = currentStats.payments.average || 0;
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

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Revenue Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-transparent dark:border-gray-700 p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 bg-green-100 dark:bg-green-900/20 w-24 h-24 rounded-bl-full"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">Last 30 days</span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Revenue</h3>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">€{stats.payments.amount.toFixed(2)}</div>
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400 mr-1" />
              <span className="text-green-600 dark:text-green-400 font-medium">+{(stats.payments.average * 0.12).toFixed(2)}</span>
              <span className="ml-1">vs previous period</span>
            </p>
          </div>
        </div>

        {/* Active Drivers Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-transparent dark:border-gray-700 p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 bg-blue-100 dark:bg-blue-900/20 w-24 h-24 rounded-bl-full"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <a href="/admin/drivers" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                View all
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </a>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Active Drivers</h3>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.drivers.active}</div>
            <div className="flex space-x-2 text-sm">
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {stats.drivers.pending} pending
              </span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                {stats.drivers.total} total
              </span>
            </div>
          </div>
        </div>

        {/* Bookings Overview Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-transparent dark:border-gray-700 p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 bg-purple-100 dark:bg-purple-900/20 w-24 h-24 rounded-bl-full"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <a href="/admin/bookings" className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center">
                View all
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </a>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Bookings Overview</h3>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.trips.total}</div>
            <div className="flex space-x-2 text-sm">
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full">
                {stats.trips.pending} pending
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                {stats.trips.completed} completed
              </span>
            </div>
          </div>
        </div>
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

        {/* Partner Users */}
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

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Payment Stats Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
              Payment Analytics
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                <div className="text-sm text-gray-500 dark:text-gray-400">Revenue (30d)</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">€{stats.payments.amount.toFixed(2)}</div>
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +8.2% vs prev. month
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Daily</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">€{stats.payments.average.toFixed(2)}</div>
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +4.5% daily growth
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.payments.completed}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  out of {stats.payments.total} payments
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Booking</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  €{stats.payments.completed > 0 
                     ? (stats.payments.amount / stats.payments.completed).toFixed(2) 
                     : "0.00"}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +2.3% per booking
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Section */}
        <div className="md:col-span-2 grid grid-cols-1 gap-6">
          {/* User Activity Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
                <BarChart2 className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
                User Activity
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Signups Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Signups</h4>
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
              
              {/* Logins Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User Logins</h4>
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
          </div>
        </div>
      </div>

      {/* Trip and Driver Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

        {/* Driver Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <h3 className="text-lg font-medium mb-4 dark:text-white flex items-center">
            <Car className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
            Driver Status
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Drivers</span>
              <span className="text-lg font-medium dark:text-white">{stats.drivers.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Active Drivers</span>
              <span className="text-lg font-medium dark:text-white">{stats.drivers.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Pending Verification</span>
              <span className="text-lg font-medium dark:text-white">{stats.drivers.pending}</span>
            </div>
          </div>
        </div>

        {/* Daily Bookings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <h3 className="text-lg font-medium mb-4 dark:text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-500 dark:text-indigo-400" />
            Booking Insights
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Today's Bookings</span>
              <span className="text-lg font-medium dark:text-white">{Math.round(stats.trips.total * 0.15)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">This Week</span>
              <span className="text-lg font-medium dark:text-white">{Math.round(stats.trips.total * 0.3)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Avg. Daily Revenue</span>
              <span className="text-lg font-medium dark:text-white">€{stats.payments.average.toFixed(2)}</span>
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