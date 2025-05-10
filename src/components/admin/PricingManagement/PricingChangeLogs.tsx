import React, { useState, useEffect } from 'react';
import { Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/use-toast';

interface PricingChangeLog {
  id: string;
  changed_by: string;
  change_type: 'base_price' | 'zone_multiplier' | 'fixed_route';
  previous_value: any;
  new_value: any;
  notes: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
}

const PricingChangeLogs: React.FC = () => {
  const [logs, setLogs] = useState<PricingChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pricing_change_logs')
        .select(`
          *,
          user:users!pricing_change_logs_changed_by_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching pricing logs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch pricing change logs"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatChangeType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const renderValueDiff = (prev: any, next: any) => {
    const changes = [];
    for (const key in next) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        changes.push(
          <div key={key} className="text-sm">
            <span className="font-medium">{key}:</span>{' '}
            <span className="text-red-600 dark:text-red-400 line-through">{prev[key]}</span>
            {' → '}
            <span className="text-green-600 dark:text-green-400">{next[key]}</span>
          </div>
        );
      }
    }
    return changes;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      log.change_type.toLowerCase().includes(query) ||
      log.user?.name?.toLowerCase().includes(query) ||
      log.user?.email?.toLowerCase().includes(query) ||
      JSON.stringify(log.previous_value).toLowerCase().includes(query) ||
      JSON.stringify(log.new_value).toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
      <h3 className="text-lg font-medium mb-4 flex items-center dark:text-white">
        <Clock className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
        Pricing Change History
      </h3>

      <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search changes..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading changes...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <p className="text-center py-8 text-gray-600 dark:text-gray-400">
          No pricing changes found
        </p>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <div 
              key={log.id} 
              className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium dark:text-white">
                    {log.user?.name || 'Unknown User'}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 text-sm ml-2">
                    ({log.user?.email})
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {format(new Date(log.created_at), 'PPp')}
                </span>
              </div>

              <div className="mb-2">
                <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  {formatChangeType(log.change_type)}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 text-sm">
                {renderValueDiff(log.previous_value, log.new_value)}
              </div>

              {log.notes && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Note: {log.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PricingChangeLogs;