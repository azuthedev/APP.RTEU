import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '../../ui/use-toast';
import PricingSimulator from './PricingSimulator';
import PricingChangeLogs from './PricingChangeLogs';

const PricingManagement: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-pricing-cache`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to refresh pricing cache');
      }

      toast({
        title: "Success",
        description: "Pricing cache refreshed successfully"
      });
    } catch (error) {
      console.error('Error refreshing cache:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh pricing cache"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold dark:text-white">Pricing Management</h2>
        <button
          onClick={handleRefreshCache}
          disabled={isRefreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {isRefreshing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5 mr-2" />
              Force Refresh Cache
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PricingSimulator />
        <PricingChangeLogs />
      </div>
    </div>
  );
};

export default PricingManagement;