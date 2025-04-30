import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Settings, ShieldCheck, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/use-toast';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminCount: 0,
    supportCount: 0,
    loading: true
  });
  const { userData, refreshSession } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (userData?.user_role === 'admin' || userData?.user_role === 'support') {
      fetchStats();
    }
  }, [userData]);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // Refresh the session to update JWT claims
      await refreshSession();
      // Then fetch stats with updated JWT
      await fetchStats();
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

  const fetchStats = async () => {
    try {
      // Verify admin role before querying
      if (userData?.user_role !== 'admin' && userData?.user_role !== 'support') {
        throw new Error('Admin or support permissions required');
      }

      console.log('Fetching dashboard stats...');
      
      // Fetch total users
      const { count: userCount, error: userError } = await supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (userError) {
        console.error('Error fetching user count:', userError);
        throw userError;
      }

      // Fetch active users (non-suspended)
      const { count: activeUserCount, error: activeUserError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('is_suspended', false);

      if (activeUserError) {
        console.error('Error fetching active user count:', activeUserError);
        throw activeUserError;
      }

      // Fetch admin count
      const { count: adminCount, error: adminError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('user_role', 'admin');

      if (adminError) {
        console.error('Error fetching admin count:', adminError);
        throw adminError;
      }

      // Fetch support count
      const { count: supportCount, error: supportError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('user_role', 'support');

      if (supportError) {
        console.error('Error fetching support count:', supportError);
        throw supportError;
      }

      console.log('Stats fetched successfully:', {
        totalUsers: userCount || 0,
        activeUsers: activeUserCount || 0,
        adminCount: adminCount || 0,
        supportCount: supportCount || 0
      });

      setStats({
        totalUsers: userCount || 0,
        activeUsers: activeUserCount || 0,
        adminCount: adminCount || 0,
        supportCount: supportCount || 0,
        loading: false
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Users</p>
              <p className="text-2xl font-semibold dark:text-white">{stats.totalUsers}</p>
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
              <p className="text-2xl font-semibold dark:text-white">{stats.activeUsers}</p>
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
              <p className="text-2xl font-semibold dark:text-white">{stats.adminCount}</p>
            </div>
          </div>
        </div>

        {/* Support Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
              <ShieldCheck className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Support Users</p>
              <p className="text-2xl font-semibold dark:text-white">{stats.supportCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional charts and analytics can be added here */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
        <h3 className="text-lg font-medium mb-4 dark:text-white">Recent Activity</h3>
        <p className="text-gray-500 dark:text-gray-400">Coming soon: Activity charts and detailed analytics</p>
      </div>
    </div>
  );
};

export default Dashboard;