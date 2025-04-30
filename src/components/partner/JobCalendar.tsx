import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  User,
  Clock,
  Download,
  Loader2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, addMonths, subMonths } from 'date-fns';

interface Trip {
  id: string;
  datetime: string;
  user_id: string;
  driver_id: string;
  pickup_zone_id: string;
  dropoff_zone_id: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  user?: {
    name: string;
    email: string;
    phone: string;
  };
  pickup_zone?: {
    name: string;
  };
  dropoff_zone?: {
    name: string;
  };
}

const JobCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsForSelectedDate, setTripsForSelectedDate] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const { toast } = useToast();
  const { userData } = useAuth();

  useEffect(() => {
    fetchTrips();
  }, [userData, currentDate]);

  useEffect(() => {
    if (selectedDate) {
      const selectedTrips = trips.filter(trip => 
        isSameDay(parseISO(trip.datetime), selectedDate)
      );
      setTripsForSelectedDate(selectedTrips);
    }
  }, [selectedDate, trips]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      
      // Get driver ID from the drivers table
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userData?.id)
        .single();

      if (driverError || !driverData) {
        console.error('Error fetching driver data:', driverError);
        throw new Error('Could not fetch your driver profile');
      }

      // Fetch trips for the entire month
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          user:users!trips_user_id_fkey(name, email, phone),
          pickup_zone:zones!trips_pickup_zone_id_fkey(name),
          dropoff_zone:zones!trips_dropoff_zone_id_fkey(name)
        `)
        .eq('driver_id', driverData.id)
        .gte('datetime', monthStart.toISOString())
        .lte('datetime', monthEnd.toISOString())
        .order('datetime', { ascending: true });

      if (error) throw error;

      setTrips(data || []);
    } catch (error: any) {
      console.error('Error fetching trips:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch your scheduled trips.",
      });
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const exportCalendar = async () => {
    try {
      setExporting(true);
      
      // Format trips for Google Calendar format
      const events = trips.map(trip => {
        const startTime = new Date(trip.datetime);
        const endTime = new Date(startTime);
        
        // Add estimated duration if available, otherwise default to 1 hour
        if (trip.estimated_duration_min) {
          endTime.setMinutes(endTime.getMinutes() + trip.estimated_duration_min);
        } else {
          endTime.setHours(endTime.getHours() + 1);
        }
        
        return {
          'Subject': `Transfer: ${trip.pickup_zone?.name || 'Pickup'} to ${trip.dropoff_zone?.name || 'Dropoff'}`,
          'Start Date': format(startTime, 'MM/dd/yyyy'),
          'Start Time': format(startTime, 'HH:mm'),
          'End Date': format(endTime, 'MM/dd/yyyy'),
          'End Time': format(endTime, 'HH:mm'),
          'Description': `Passenger: ${trip.user?.name || 'Unknown'}\nPhone: ${trip.user?.phone || 'N/A'}\nStatus: ${trip.status}`,
          'Location': trip.pickup_zone?.name || 'Unknown location',
        };
      });
      
      // Convert to CSV
      const header = Object.keys(events[0] || {}).join(',') + '\n';
      const csv = header + events.map(event => 
        Object.values(event).map(value => `"${value}"`).join(',')
      ).join('\n');
      
      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `trips-${format(currentDate, 'yyyy-MM')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Calendar Exported",
        description: "Your trips have been exported as a CSV file.",
      });
    } catch (error: any) {
      console.error('Error exporting calendar:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export calendar. Please try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold dark:text-white mb-4 sm:mb-0">Schedule Calendar</h1>
        
        <button 
          onClick={exportCalendar}
          disabled={exporting || trips.length === 0}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800"
        >
          {exporting ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 mr-2" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export Calendar
            </>
          )}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
        {/* Calendar header */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
          </div>
          <div className="space-x-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 border-b dark:border-gray-700">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div 
                key={day} 
                className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-r dark:border-gray-700 last:border-r-0"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day) => {
              const tripsOnDay = trips.filter(trip => 
                isSameDay(parseISO(trip.datetime), day)
              );

              return (
                <div 
                  key={day.toString()} 
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-24 p-2 border-t border-r dark:border-gray-700 last:border-r-0 
                    ${!isSameMonth(day, currentDate) ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500' : ''}
                    ${isSameDay(day, selectedDate || new Date()) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                    ${isToday(day) ? 'border-blue-300 dark:border-blue-700' : ''}
                    hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer
                  `}
                >
                  <div className="flex justify-between">
                    <span className={`
                      text-sm font-medium 
                      ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'} 
                      ${!isSameMonth(day, currentDate) ? 'text-gray-400 dark:text-gray-500' : ''}
                    `}>
                      {format(day, 'd')}
                    </span>
                    
                    {tripsOnDay.length > 0 && (
                      <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full px-1.5 py-0.5">
                        {tripsOnDay.length}
                      </span>
                    )}
                  </div>

                  {/* Show max 2 trip indicators per day */}
                  {tripsOnDay.slice(0, 2).map((trip, idx) => (
                    <div 
                      key={`${trip.id}-${idx}`}
                      className="mt-1 text-xs truncate"
                    >
                      <div className={`
                        px-1.5 py-0.5 rounded text-xs truncate
                        ${trip.status === 'cancelled' 
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' 
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}
                      `}>
                        {format(parseISO(trip.datetime), 'h:mm a')}
                      </div>
                    </div>
                  ))}
                  
                  {/* Indicator for more trips */}
                  {tripsOnDay.length > 2 && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                      +{tripsOnDay.length - 2} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Selected date details */}
      {selectedDate && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMMM d')}
            {' '}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({tripsForSelectedDate.length} {tripsForSelectedDate.length === 1 ? 'trip' : 'trips'})
            </span>
          </h3>

          {tripsForSelectedDate.length > 0 ? (
            <div className="space-y-4">
              {tripsForSelectedDate.map(trip => (
                <div
                  key={trip.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  <div className="px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center text-gray-900 dark:text-white">
                        <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-1" />
                        <span className="font-medium">{format(parseISO(trip.datetime), 'h:mm a')}</span>
                      </div>
                      
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        trip.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                        trip.status === 'accepted' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                        trip.status === 'in_progress' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                        trip.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      }`}>
                        {trip.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-start mb-3">
                      <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {trip.user?.name || 'Customer'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="ml-8 mb-3 space-y-2">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {trip.pickup_zone?.name || 'Pickup location'}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full mr-2"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {trip.dropoff_zone?.name || 'Dropoff location'}
                        </p>
                      </div>
                    </div>

                    <div className="border-t dark:border-gray-700 pt-3 mt-3 text-right">
                      <a
                        href={`https://maps.google.com/maps?q=${encodeURIComponent(trip.pickup_zone?.name || '')}`}
                        target="_blank"
                        rel="noopener noreferrer" 
                        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        View on map
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No trips scheduled for this date.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobCalendar;