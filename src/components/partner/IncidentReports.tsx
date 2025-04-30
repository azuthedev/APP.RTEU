import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  AlertTriangle, 
  Loader2, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Clock, 
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import IncidentReportForm from './IncidentReportForm';

interface IncidentReport {
  id: string;
  trip_id: string;
  driver_id: string;
  incident_type: string;
  description: string;
  reported_at: string;
  location: string | null;
  resolved: boolean;
  admin_notes: string | null;
  created_at: string;
  trip?: {
    datetime: string;
    pickup_zone?: {
      name: string;
    };
    dropoff_zone?: {
      name: string;
    };
  };
}

const IncidentReports: React.FC = () => {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [showNewReportForm, setShowNewReportForm] = useState<boolean>(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const { toast } = useToast();
  const { userData } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    fetchDriverId().then(id => {
      if (id) {
        setDriverId(id);
        fetchIncidentReports(id);
        fetchTrips(id);
      }
    });
  }, [userData]);

  const fetchDriverId = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userData?.id)
        .single();

      if (error) {
        console.error('Error fetching driver ID:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not find your driver profile. Please contact support.",
        });
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  };

  const fetchIncidentReports = async (driverId: string) => {
    try {
      setIsRefreshing(true);
      
      const { data, error } = await supabase
        .from('incident_reports')
        .select(`
          *,
          trip:trips(
            datetime,
            pickup_zone:zones!trips_pickup_zone_id_fkey(name),
            dropoff_zone:zones!trips_dropoff_zone_id_fkey(name)
          )
        `)
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setReports(data || []);
    } catch (error: any) {
      console.error('Error fetching incident reports:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch incident reports.",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchTrips = async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          datetime,
          status,
          pickup_zone:zones!trips_pickup_zone_id_fkey(name),
          dropoff_zone:zones!trips_dropoff_zone_id_fkey(name)
        `)
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'in_progress', 'completed'])
        .order('datetime', { ascending: false });
        
      if (error) throw error;
      
      setTrips(data || []);
    } catch (error: any) {
      console.error('Error fetching trips:', error);
    }
  };

  const refreshData = async () => {
    if (!driverId) return;
    await fetchIncidentReports(driverId);
    await fetchTrips(driverId);
  };

  const toggleReportDetails = (reportId: string) => {
    if (expandedReport === reportId) {
      setExpandedReport(null);
    } else {
      setExpandedReport(reportId);
    }
  };

  const handleShowNewReportForm = (tripId: string | null = null) => {
    setSelectedTripId(tripId);
    setShowNewReportForm(true);
  };

  // Helper to format the incident type for display
  const formatIncidentType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Filter reports based on search query and filter selection
  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.incident_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.trip?.pickup_zone?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (report.trip?.dropoff_zone?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'resolved' && report.resolved) || 
      (filter === 'unresolved' && !report.resolved);
      
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold dark:text-white mb-4 sm:mb-0">Incident Reports</h1>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <div className="flex">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'resolved' | 'unresolved')}
              className="ml-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Reports</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={refreshData}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={() => handleShowNewReportForm()}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              New Report
            </button>
          </div>
        </div>
      </div>

      {/* Reports list */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No incident reports found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || filter !== 'all' 
              ? 'No reports match your search criteria. Try changing your filters.' 
              : 'You haven\'t submitted any incident reports yet.'}
          </p>
          <button
            onClick={() => handleShowNewReportForm()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center"
          >
            <AlertTriangle className="w-5 h-5 mr-2" />
            Report an Incident
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map(report => (
            <div
              key={report.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700"
            >
              {/* Report header */}
              <div
                className="px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => toggleReportDetails(report.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      report.resolved
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {formatIncidentType(report.incident_type)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {report.trip?.datetime 
                          ? format(parseISO(report.trip.datetime), 'PPp')
                          : format(parseISO(report.created_at), 'PPp')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className={`px-2 py-1 text-xs rounded-full mr-3 ${
                      report.resolved
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                    }`}>
                      {report.resolved ? 'Resolved' : 'Pending'}
                    </div>
                    {expandedReport === report.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expandedReport === report.id && (
                <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trip Information</h4>
                      {report.trip ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {report.trip.pickup_zone?.name || 'Unknown pickup'} to {report.trip.dropoff_zone?.name || 'Unknown destination'}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Trip details not available
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {report.description}
                      </p>
                    </div>
                    
                    {report.location && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {report.location}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 pt-2 border-t dark:border-gray-600">
                      <span>
                        <Clock className="inline-block w-4 h-4 mr-1 align-text-bottom" />
                        Reported: {format(parseISO(report.reported_at), 'PP')}
                      </span>
                      
                      {report.resolved && (
                        <span className="flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1 text-green-500 dark:text-green-400" />
                          Resolved
                        </span>
                      )}
                    </div>
                    
                    {report.admin_notes && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
                        <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Admin Notes</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          {report.admin_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Report Modal */}
      {showNewReportForm && (
        <IncidentReportForm 
          tripId={selectedTripId} 
          onClose={() => setShowNewReportForm(false)}
          onSuccess={refreshData}
        />
      )}

      {/* Trip selection modal (when creating a new report without a trip context) */}
      {showNewReportForm && !selectedTripId && trips.length > 0 && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Select Trip</h2>
              <button
                onClick={() => {
                  // Set a null trip ID but keep the form open
                  setSelectedTripId(null);
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Please select the trip this incident is related to:
              </p>
              
              {trips.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {trips.map(trip => (
                    <button
                      key={trip.id}
                      onClick={() => {
                        setSelectedTripId(trip.id);
                        // Don't close the form, just update the selected trip
                      }}
                      className="w-full text-left p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 border dark:border-gray-700"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {format(parseISO(trip.datetime), 'PP')} at {format(parseISO(trip.datetime), 'p')}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {trip.pickup_zone?.name || 'Unknown pickup'} to {trip.dropoff_zone?.name || 'Unknown destination'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Status: <span className="capitalize">{trip.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4">
                  <p className="text-gray-600 dark:text-gray-400">No recent trips found.</p>
                  <button
                    onClick={() => setSelectedTripId('no-trip')}
                    className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
                  >
                    Continue without selecting a trip
                  </button>
                </div>
              )}
              
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setShowNewReportForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                
                <button
                  onClick={() => setSelectedTripId('no-trip')}
                  className="px-4 py-2 border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  Continue Without Trip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentReports;