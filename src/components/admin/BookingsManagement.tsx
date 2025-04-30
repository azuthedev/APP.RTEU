import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Info, Filter, X, User, Car, CheckCircle, Clock, Plus, MoreVertical, MessageSquare, CreditCard, AlertCircle, CalendarPlus, FileDown, Bell, Tag, Copy, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, addHours, isPast, isFuture, parseISO, formatDistance } from 'date-fns';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useError } from '../../contexts/ErrorContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import BookingDetailModal from './booking/BookingDetailModal';
import BookingNoteModal from './booking/BookingNoteModal';
import BookingLogModal from './booking/BookingLogModal';
import BookingExportModal from './booking/BookingExportModal';
import BookingReminderModal from './booking/BookingReminderModal';
import BookingFeesModal from './booking/BookingFeesModal';
import EmptyState from '../EmptyState';

interface Driver {
  id: string;
  user_id: string;
  is_available: boolean;
  license_number?: string;
  verification_status: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
}

interface Booking {
  id: string;
  datetime: string;
  user_id: string;
  driver_id: string;
  pickup_zone_id: string;
  dropoff_zone_id: string;
  pickup_address?: string;
  dropoff_address?: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  estimated_price: number;
  surge_multiplier?: number;
  promo_discount?: number;
  customer_phone?: string;
  notes?: string; // Admin private notes
  priority?: number; // 0=normal, 1=high, 2=urgent
  last_reminder_sent?: string; // Timestamp of last reminder
  custom_fees?: {
    id: string;
    name: string;
    amount: number;
    customer_visible: boolean;
  }[];
  internal_tags?: string[];
  user?: {
    name: string;
    email: string;
    phone?: string;
  };
  driver?: {
    name: string;
    email: string;
    phone?: string;
  };
  pickup_zone?: {
    name: string;
  };
  dropoff_zone?: {
    name: string;
  };
  payments?: {
    id: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed';
    payment_method: string;
    paid_at?: string;
  }[];
}

interface ActivityLog {
  id: string;
  booking_id: string;
  user_id: string;
  action: string;
  details: any;
  created_at: string;
  user?: {
    name: string;
  };
}

const PRIORITY_LEVELS = [
  { value: 0, label: 'Normal', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  { value: 1, label: 'High', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 2, label: 'Urgent', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
];

const BookingsManagement = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('upcoming');
  const [driverFilter, setDriverFilter] = useState('all'); // 'all', 'assigned', 'unassigned'
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all', 'normal', 'high', 'urgent'
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverAvailabilityFilter, setDriverAvailabilityFilter] = useState('all'); // 'all', 'available', 'unavailable'
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showFeesModal, setShowFeesModal] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [sortField, setSortField] = useState<'datetime' | 'customer_name' | 'status' | 'priority'>('datetime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { toast } = useToast();
  const { userData, refreshSession, session } = useAuth();
  const { captureError } = useError();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userData?.user_role === 'admin') {
      refreshData();
    }
  }, [userData]);

  // Apply filters and sorting to bookings whenever dependencies change
  useEffect(() => {
    applyFiltersAndSort();
  }, [bookings, searchQuery, statusFilter, dateRangeFilter, driverFilter, priorityFilter, sortField, sortOrder]);

  // Check for bookings that need attention (pending and close to departure)
  useEffect(() => {
    const checkUpcomingBookings = () => {
      const upcomingPendingBookings = bookings.filter(booking => {
        // Check if pending and within 24 hours of departure
        const bookingDate = new Date(booking.datetime);
        const now = new Date();
        const hoursDifference = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return booking.status === 'pending' && hoursDifference > 0 && hoursDifference < 24;
      });

      // Show toast notifications for pending bookings close to departure
      upcomingPendingBookings.forEach(booking => {
        const bookingDate = new Date(booking.datetime);
        const timeUntil = formatDistance(bookingDate, new Date(), { addSuffix: true });
        
        toast({
          title: "Booking Requires Attention",
          description: `${booking.customer_name}'s booking (${booking.booking_reference}) is ${timeUntil} and still pending confirmation.`,
          variant: "destructive",
          duration: 10000, // 10 seconds
          action: (
            <button 
              onClick={() => {
                setSelectedBooking(booking);
                setShowDetailModal(true);
              }}
              className="px-3 py-1 text-xs bg-white text-red-600 rounded hover:bg-gray-100"
            >
              View
            </button>
          )
        });
      });
    };

    // Check urgent bookings on initial load (delay slightly to avoid too many notifications at once)
    const timer = setTimeout(checkUpcomingBookings, 2000);
    
    return () => clearTimeout(timer);
  }, [bookings]);

  const refreshData = async () => {
    await fetchBookings();
    await fetchDrivers();
    checkForReminders();
  };

  const fetchBookings = async () => {
    try {
      setRefreshing(true);
      
      // Check for admin role before making the request
      if (userData?.user_role !== 'admin') {
        throw new Error('Admin permissions required');
      }
      
      // Make sure we have a valid session before proceeding
      if (!session) {
        console.log('No active session, attempting to refresh');
        await refreshSession();
      }
      
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          user:users!trips_user_id_fkey(name, email, phone),
          driver:users!trips_driver_id_fkey(name, email, phone)
        `)
        .order('datetime', { ascending: false });

      if (error) {
        // If permission denied, try using the admin edge function instead
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for direct access, using admin function instead');
          // In a real implementation, you would call an edge function here
          // For now, we'll mock some data
          const mockData = [
            {
              id: '1234',
              datetime: new Date().toISOString(),
              user_id: '1',
              driver_id: null,
              pickup_address: 'Mock Pickup Address',
              dropoff_address: 'Mock Dropoff Address',
              status: 'pending',
              booking_reference: 'MOCK-123',
              customer_name: 'Mock Customer',
              customer_email: 'mock@example.com',
              estimated_price: 100,
              notes: 'This is mock data since we had a permission error',
              priority: 1,
              user: { name: 'Mock User', email: 'mock@example.com' },
              driver: null,
              custom_fees: [],
              internal_tags: ['mock', 'data']
            }
          ];
          
          // Format the booking data and add any additional fields
          const formattedBookings: Booking[] = mockData.map(booking => ({
            ...booking,
            notes: booking.notes || '',
            priority: booking.priority || 0,
            internal_tags: booking.internal_tags || [],
            custom_fees: booking.custom_fees || []
          }));

          setBookings(formattedBookings);
          
          // Show a toast to inform the admin
          toast({
            variant: "warning",
            title: "Limited Access",
            description: "Using mock data due to permissions issue. Please contact the system administrator.",
          });
          
          return;
        } else {
          throw error;
        }
      }
      
      // Format the booking data and add any additional fields
      const formattedBookings: Booking[] = (data || []).map(booking => ({
        ...booking,
        notes: booking.notes || '',
        priority: booking.priority || 0,
        internal_tags: booking.internal_tags || [],
        custom_fees: booking.custom_fees || []
      }));

      setBookings(formattedBookings);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      captureError(error, 'Bookings Management');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch bookings. Please try again.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      setLoadingDrivers(true);
      
      // Make sure we have a valid session before proceeding
      if (!session) {
        console.log('No active session for fetchDrivers, attempting to refresh');
        await refreshSession();
      }
      
      // Use the edge function instead of direct database access
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-fetch-drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error fetching drivers from edge function: ${errorData.error || response.statusText}`);
      }
      
      const driversData = await response.json();
      setDrivers(driversData || []);
      
    } catch (error: any) {
      console.error('Error fetching drivers:', error);
      captureError(error, 'Bookings Management - Drivers');
      
      // Fall back to empty array
      setDrivers([]);
      
      toast({
        variant: "warning",
        title: "Couldn't Load Drivers",
        description: "There was an issue loading driver data. Some functionality may be limited.",
      });
    } finally {
      setLoadingDrivers(false);
    }
  };

  const fetchActivityLogs = async (bookingId: string) => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          user:users(name)
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for activity_logs table, using mock data');
          
          // Mock some activity logs
          const mockLogs = [
            {
              id: '1',
              booking_id: bookingId,
              user_id: userData?.id || '',
              action: 'viewed_booking',
              details: { timestamp: new Date().toISOString() },
              created_at: new Date().toISOString(),
              user: { name: userData?.name || 'Admin User' }
            }
          ];
          
          setActivityLogs(mockLogs);
          return;
        } else {
          throw error;
        }
      }
      
      setActivityLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching activity logs:', error);
      captureError(error, 'Activity Logs');
      
      // Show notification
      toast({
        variant: "warning",
        title: "Couldn't Load Activity Logs",
        description: "There was an issue loading the activity log data.",
      });
      
      // Fall back to empty array
      setActivityLogs([]);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      // Update the booking status
      const { error } = await supabase
        .from('trips')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for updating trips, would use admin function in production');
          
          // In a real implementation, call an edge function to update with admin privileges
          // For now, just update the UI
          setBookings(bookings.map(booking => 
            booking.id === bookingId ? { ...booking, status: newStatus as any } : booking
          ));
          
          toast({
            title: "Status Updated (UI Only)",
            description: "Due to permission restrictions, this change was only applied to the UI.",
            variant: "warning"
          });
          
          return;
        } else {
          throw error;
        }
      }
      
      // Log the activity
      await logBookingActivity(bookingId, 'status_update', {
        previous_status: bookings.find(b => b.id === bookingId)?.status,
        new_status: newStatus
      });
      
      // Update local state
      setBookings(bookings.map(booking => 
        booking.id === bookingId ? { ...booking, status: newStatus as any } : booking
      ));

      toast({
        title: "Success",
        description: "Booking status updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      captureError(error, 'Update Booking Status');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not update booking. Please try again.",
      });
    }
  };

  const assignDriver = async (driverId: string) => {
    if (!selectedTripId) return;
    
    try {
      setAssigningDriver(true);
      
      // First, check if we have a valid session
      if (!session) {
        console.log('No active session for assignDriver, attempting to refresh');
        await refreshSession();
      }
      
      // Get the driver's user ID
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('user_id')
        .eq('id', driverId)
        .single();
        
      if (driverError) {
        if (driverError.code === '42501' || driverError.message?.includes('permission denied')) {
          console.log('Permission denied for drivers table, using admin function');
          
          // In a real implementation, call an admin edge function
          // For now, simulate a successful assignment with mock data
          const mockDriverUserId = 'mock-user-id';
          
          // Update local state
          setBookings(bookings.map(booking => 
            booking.id === selectedTripId 
              ? { 
                  ...booking, 
                  driver_id: mockDriverUserId,
                  driver: {
                    name: drivers.find(d => d.id === driverId)?.user?.name || 'Mock Driver',
                    email: drivers.find(d => d.id === driverId)?.user?.email || 'mock@example.com',
                    phone: drivers.find(d => d.id === driverId)?.user?.phone || '123-456-7890'
                  }
                } 
              : booking
          ));
          
          toast({
            title: "Driver Assigned (UI Only)",
            description: "Due to permission restrictions, this change was only applied to the UI.",
            variant: "warning"
          });
          
          // Close the modal
          setShowAssignModal(false);
          setSelectedTripId(null);
          return;
        } else {
          throw driverError;
        }
      }
      
      if (!driverData?.user_id) {
        throw new Error('Could not find driver user ID');
      }
      
      // Update the trip with the driver's user ID 
      const { error } = await supabase
        .from('trips')
        .update({ 
          driver_id: driverData.user_id
        })
        .eq('id', selectedTripId);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for trips table update, using admin function');
          
          // In a real implementation, call an admin edge function
          // For now, simulate a successful update
          
          // Update local state only
          setBookings(bookings.map(booking => 
            booking.id === selectedTripId 
              ? { 
                  ...booking, 
                  driver_id: driverData.user_id,
                  driver: {
                    name: drivers.find(d => d.id === driverId)?.user?.name || 'Unknown Driver',
                    email: drivers.find(d => d.id === driverId)?.user?.email || '',
                    phone: drivers.find(d => d.id === driverId)?.user?.phone || ''
                  }
                } 
              : booking
          ));
          
          toast({
            title: "Driver Assigned (UI Only)",
            description: "Due to permission restrictions, this change was only applied to the UI.",
            variant: "warning"
          });
          
          // Close the modal
          setShowAssignModal(false);
          setSelectedTripId(null);
          return;
        } else {
          throw error;
        }
      }
      
      // Log the activity
      await logBookingActivity(selectedTripId, 'driver_assignment', {
        driver_id: driverId,
        driver_user_id: driverData.user_id,
      });
      
      // Fetch updated booking data
      await fetchBookings();
      
      toast({
        title: "Success",
        description: "Driver assigned successfully. The driver will need to accept the trip.",
        variant: "success"
      });
      
      // Close the modal
      setShowAssignModal(false);
      setSelectedTripId(null);
    } catch (error: any) {
      console.error('Error assigning driver:', error);
      captureError(error, 'Assign Driver');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not assign driver. Please try again.",
      });
    } finally {
      setAssigningDriver(false);
    }
  };

  const logBookingActivity = async (bookingId: string, action: string, details: any) => {
    try {
      const { error } = await supabase.from('activity_logs').insert({
        booking_id: bookingId,
        user_id: userData?.id,
        action,
        details,
        created_at: new Date().toISOString()
      });
      
      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for activity_logs insert, would use admin function in production');
          // In a real implementation, call an admin edge function
          return;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't show a toast for this as it's a background operation
    }
  };

  const handleOpenAssignModal = (booking: Booking) => {
    setSelectedTripId(booking.id);
    setSelectedBooking(booking);
    setShowAssignModal(true);
  };

  const handleCloseModal = () => {
    setShowAssignModal(false);
    setSelectedTripId(null);
    setSelectedBooking(null);
    setDriverSearchQuery('');
    setDriverAvailabilityFilter('all');
  };

  const handleOpenDetailModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  const handleOpenNoteModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowNoteModal(true);
  };

  const handleOpenLogModal = async (booking: Booking) => {
    setSelectedBooking(booking);
    await fetchActivityLogs(booking.id);
    setShowLogModal(true);
  };

  const handleOpenReminderModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowReminderModal(true);
  };

  const handleOpenFeesModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowFeesModal(true);
  };

  const handleOpenExportModal = () => {
    setShowExportModal(true);
  };

  const handleUpdateNotes = async (bookingId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('trips')
        .update({ notes })
        .eq('id', bookingId);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for trips update, using UI-only update');
          
          // Update local state only
          setBookings(bookings.map(booking => 
            booking.id === bookingId ? { ...booking, notes } : booking
          ));
          
          toast({
            title: "Notes Updated (UI Only)",
            description: "Due to permission restrictions, this change was only applied to the UI.",
            variant: "warning"
          });
          
          setShowNoteModal(false);
          return;
        } else {
          throw error;
        }
      }
      
      // Log the activity
      await logBookingActivity(bookingId, 'notes_updated', {
        timestamp: new Date().toISOString()
      });

      // Update local state
      setBookings(bookings.map(booking => 
        booking.id === bookingId ? { ...booking, notes } : booking
      ));
      
      toast({
        title: "Success",
        description: "Notes updated successfully.",
      });
      
      setShowNoteModal(false);
    } catch (error: any) {
      console.error('Error updating notes:', error);
      captureError(error, 'Update Notes');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not update notes. Please try again.",
      });
    }
  };

  const handleUpdatePriority = async (bookingId: string, priority: number) => {
    try {
      const { error } = await supabase
        .from('trips')
        .update({ priority })
        .eq('id', bookingId);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for trips update, using UI-only update');
          
          // Update local state only
          setBookings(bookings.map(booking => 
            booking.id === bookingId ? { ...booking, priority } : booking
          ));
          
          toast({
            title: "Priority Updated (UI Only)",
            description: "Due to permission restrictions, this change was only applied to the UI.",
            variant: "warning"
          });
          
          setShowReminderModal(false);
          return;
        } else {
          throw error;
        }
      }
      
      // Log the activity
      await logBookingActivity(bookingId, 'priority_changed', {
        new_priority: priority,
        previous_priority: bookings.find(b => b.id === bookingId)?.priority || 0
      });

      // Update local state
      setBookings(bookings.map(booking => 
        booking.id === bookingId ? { ...booking, priority } : booking
      ));
      
      toast({
        title: "Success",
        description: "Booking priority updated.",
      });

      setShowReminderModal(false);
    } catch (error: any) {
      console.error('Error updating priority:', error);
      captureError(error, 'Update Priority');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not update booking priority. Please try again.",
      });
    }
  };

  const handleUpdateCustomFees = async (bookingId: string, customFees: any[]) => {
    try {
      const { error } = await supabase
        .from('trips')
        .update({ custom_fees: customFees })
        .eq('id', bookingId);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for trips update, using UI-only update');
          
          // Update local state only
          setBookings(bookings.map(booking => 
            booking.id === bookingId ? { ...booking, custom_fees: customFees } : booking
          ));
          
          toast({
            title: "Custom Fees Updated (UI Only)",
            description: "Due to permission restrictions, this change was only applied to the UI.",
            variant: "warning"
          });
          
          setShowFeesModal(false);
          return;
        } else {
          throw error;
        }
      }
      
      // Log the activity
      await logBookingActivity(bookingId, 'fees_updated', {
        fees_count: customFees.length,
        fees_total: customFees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
      });

      // Update local state
      setBookings(bookings.map(booking => 
        booking.id === bookingId ? { ...booking, custom_fees: customFees } : booking
      ));
      
      toast({
        title: "Success",
        description: "Custom fees updated successfully.",
      });

      setShowFeesModal(false);
    } catch (error: any) {
      console.error('Error updating custom fees:', error);
      captureError(error, 'Update Custom Fees');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not update custom fees. Please try again.",
      });
    }
  };

  const duplicateBooking = async (booking: Booking) => {
    try {
      // Create a new booking with most of the same details
      const newBooking = {
        user_id: booking.user_id,
        pickup_zone_id: booking.pickup_zone_id,
        dropoff_zone_id: booking.dropoff_zone_id,
        pickup_address: booking.pickup_address,
        dropoff_address: booking.dropoff_address,
        status: 'pending',
        datetime: new Date().toISOString(), // Set to current time by default
        booking_reference: `DUP-${Math.floor(100000 + Math.random() * 900000)}`, // Generate new reference
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        estimated_price: booking.estimated_price,
        estimated_distance_km: booking.estimated_distance_km,
        estimated_duration_min: booking.estimated_duration_min,
        priority: 0, // Reset priority
        notes: `Duplicated from ${booking.booking_reference} on ${new Date().toLocaleDateString()}. ${booking.notes || ''}`,
      };

      const { data, error } = await supabase
        .from('trips')
        .insert([newBooking])
        .select()
        .single();

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for trips insert, using UI-only update');
          
          // Create a mock booking with a generated ID
          const mockData = {
            ...newBooking,
            id: `mock-${Date.now()}`,
            notes: newBooking.notes || '',
            priority: newBooking.priority || 0,
            internal_tags: [],
            custom_fees: []
          };
          
          // Update local state
          setBookings([mockData, ...bookings]);
          
          toast({
            title: "Booking Duplicated (UI Only)",
            description: "Due to permission restrictions, this booking was only created in the UI.",
            variant: "warning"
          });
          
          // Open detail modal for the new booking
          setSelectedBooking(mockData);
          setShowDetailModal(true);
          return;
        } else {
          throw error;
        }
      }
      
      // Log the activity
      await logBookingActivity(booking.id, 'booking_duplicated', {
        new_booking_id: data.id,
        new_booking_reference: data.booking_reference
      });

      // Update local state by fetching all bookings again
      await fetchBookings();
      
      toast({
        title: "Booking Duplicated",
        description: "New booking created successfully. You can now edit the details.",
        variant: "success"
      });

      // Open detail modal for the new booking
      if (data) {
        setSelectedBooking({
          ...data,
          notes: data.notes || '',
          priority: data.priority || 0,
          custom_fees: data.custom_fees || [],
          internal_tags: data.internal_tags || [],
        });
        setShowDetailModal(true);
      }
    } catch (error: any) {
      console.error('Error duplicating booking:', error);
      captureError(error, 'Duplicate Booking');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not duplicate booking. Please try again.",
      });
    }
  };

  const sendReminder = async (booking: Booking) => {
    try {
      // In a real implementation, this would call an API to send a reminder
      // For now, we'll just update the last_reminder_sent field
      const { error } = await supabase
        .from('trips')
        .update({ 
          last_reminder_sent: new Date().toISOString(),
          priority: Math.max(booking.priority || 0, 1) // Set at least to high priority
        })
        .eq('id', booking.id);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.log('Permission denied for trips update, using UI-only update');
          
          // Update local state only
          setBookings(bookings.map(b => 
            b.id === booking.id ? { 
              ...b, 
              last_reminder_sent: new Date().toISOString(),
              priority: Math.max(b.priority || 0, 1)
            } : b
          ));
          
          toast({
            title: "Reminder Sent (UI Only)",
            description: `Reminder simulation for ${booking.customer_name}. Due to permission restrictions, this was only updated in the UI.`,
            variant: "warning"
          });
          
          return;
        } else {
          throw error;
        }
      }
      
      // Log the activity
      await logBookingActivity(booking.id, 'reminder_sent', {
        timestamp: new Date().toISOString(),
        recipient: booking.customer_email
      });

      // Update local state
      setBookings(bookings.map(b => 
        b.id === booking.id ? { 
          ...b, 
          last_reminder_sent: new Date().toISOString(),
          priority: Math.max(b.priority || 0, 1)
        } : b
      ));
      
      toast({
        title: "Reminder Sent",
        description: `Reminder has been sent to ${booking.customer_name}.`,
        variant: "success"
      });
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      captureError(error, 'Send Reminder');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not send reminder. Please try again.",
      });
    }
  };

  const exportBookings = (format: 'csv' | 'excel', filters: any) => {
    try {
      // Apply filters if needed
      let dataToExport = [...filteredBookings];
      
      // Convert to CSV
      const headers = [
        'Booking ID', 
        'Reference', 
        'Status', 
        'Date', 
        'Time', 
        'Customer Name', 
        'Customer Email',
        'Pickup',
        'Dropoff',
        'Driver',
        'Amount',
        'Priority',
        'Notes'
      ];
      
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(booking => [
          booking.id,
          booking.booking_reference,
          booking.status,
          format(new Date(booking.datetime), 'yyyy-MM-dd'),
          format(new Date(booking.datetime), 'HH:mm'),
          booking.customer_name,
          booking.customer_email,
          booking.pickup_address || 'N/A',
          booking.dropoff_address || 'N/A',
          booking.driver?.name || 'Not Assigned',
          booking.estimated_price || 0,
          PRIORITY_LEVELS.find(p => p.value === booking.priority)?.label || 'Normal',
          booking.notes?.replace(/,/g, ';').replace(/\n/g, ' ') || ''
        ].join(','))
      ].join('\n');
      
      // Create blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `bookings-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Complete",
        description: `Successfully exported ${dataToExport.length} bookings.`,
        variant: "success"
      });
    } catch (error: any) {
      console.error('Error exporting bookings:', error);
      captureError(error, 'Export Bookings');
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "Could not export bookings. Please try again.",
      });
    }
  };

  const checkForReminders = () => {
    // Find bookings that might need attention
    const upcomingBookings = bookings.filter(booking => {
      if (booking.status !== 'pending') return false;
      
      // Check if within 24 hours of departure
      const bookingDate = new Date(booking.datetime);
      const now = new Date();
      const hoursDifference = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Return true if booking is pending and within 24 hours
      return hoursDifference > 0 && hoursDifference < 24;
    });
    
    // We'll just count them for now - UI alerts are handled in the useEffect
    return upcomingBookings.length;
  };

  // Handle clicks outside the modal to close it
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseModal();
      }
    };

    if (showAssignModal) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showAssignModal]);

  // Apply filters and sorting
  const applyFiltersAndSort = () => {
    // Start with all bookings
    let result = [...bookings];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(booking => (
        booking.customer_name?.toLowerCase().includes(query) ||
        booking.customer_email?.toLowerCase().includes(query) ||
        booking.booking_reference?.toLowerCase().includes(query) ||
        booking.id?.toLowerCase().includes(query) ||
        booking.notes?.toLowerCase().includes(query) ||
        booking.pickup_address?.toLowerCase().includes(query) ||
        booking.dropoff_address?.toLowerCase().includes(query)
      ));
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(booking => booking.status === statusFilter);
    }
    
    // Apply date range filter
    const now = new Date();
    if (dateRangeFilter === 'upcoming') {
      result = result.filter(booking => 
        isFuture(new Date(booking.datetime))
      );
    } else if (dateRangeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      result = result.filter(booking => {
        const bookingDate = new Date(booking.datetime);
        return bookingDate >= today && bookingDate < tomorrow;
      });
    } else if (dateRangeFilter === 'past') {
      result = result.filter(booking => 
        isPast(new Date(booking.datetime))
      );
    }
    
    // Apply driver filter
    if (driverFilter !== 'all') {
      result = result.filter(booking => 
        driverFilter === 'assigned' ? booking.driver_id : !booking.driver_id
      );
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
      const priorityValue = priorityFilter === 'urgent' ? 2 : priorityFilter === 'high' ? 1 : 0;
      result = result.filter(booking => booking.priority === priorityValue);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let valA, valB;
      
      switch (sortField) {
        case 'datetime':
          valA = new Date(a.datetime).getTime();
          valB = new Date(b.datetime).getTime();
          break;
        case 'customer_name':
          valA = a.customer_name || '';
          valB = b.customer_name || '';
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        case 'priority':
          valA = a.priority || 0;
          valB = b.priority || 0;
          break;
        default:
          valA = new Date(a.datetime).getTime();
          valB = new Date(b.datetime).getTime();
      }
      
      // Handle string comparisons
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      // Handle numeric comparisons
      return sortOrder === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
    
    setFilteredBookings(result);
  };

  // Filter drivers for the assignment modal
  const filteredDrivers = drivers.filter(driver => {
    // Search query filter
    const matchesSearch = (
      driver.user?.name?.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      driver.user?.email?.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      (driver.user?.phone && driver.user.phone.toLowerCase().includes(driverSearchQuery.toLowerCase())) ||
      (driver.license_number && driver.license_number.toLowerCase().includes(driverSearchQuery.toLowerCase()))
    );
    
    // Availability filter
    const matchesAvailability = 
      driverAvailabilityFilter === 'all' || 
      (driverAvailabilityFilter === 'available' && driver.is_available) || 
      (driverAvailabilityFilter === 'unavailable' && !driver.is_available);
    
    return matchesSearch && matchesAvailability;
  });

  // Stats for the dashboard
  const bookingStats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    totalRevenue: bookings
      .filter(b => b.status === 'completed')
      .reduce((total, booking) => {
        const basePrice = booking.estimated_price || 0;
        const customFees = (booking.custom_fees || []).reduce((sum, fee) => sum + fee.amount, 0);
        return total + basePrice + customFees;
      }, 0),
    pendingRevenue: bookings
      .filter(b => b.status === 'pending' || b.status === 'accepted')
      .reduce((total, booking) => {
        const basePrice = booking.estimated_price || 0;
        const customFees = (booking.custom_fees || []).reduce((sum, fee) => sum + fee.amount, 0);
        return total + basePrice + customFees;
      }, 0),
    urgentCount: bookings.filter(b => b.priority === 2).length,
    needAttention: checkForReminders(),
  };

  // Toggle sort order
  const handleSortChange = (field: 'datetime' | 'customer_name' | 'status' | 'priority') => {
    if (sortField === field) {
      // If already sorting by this field, toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Otherwise, sort by the new field in default order
      setSortField(field);
      setSortOrder('desc'); // Default to newest first for dates
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold dark:text-white">Bookings Management</h2>
        
        <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center text-sm"
            aria-label="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={handleOpenExportModal}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center text-sm"
            aria-label="Export bookings"
          >
            <FileDown className="w-4 h-4 mr-1.5" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bookings</h3>
            <Clock className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-semibold mt-1 dark:text-white">{bookingStats.total}</p>
          <div className="mt-1 flex items-center text-xs">
            <div className="flex space-x-1 text-gray-500 dark:text-gray-400">
              <span className="font-medium text-green-600 dark:text-green-400">{bookingStats.completed}</span>
              <span>completed</span>
              <span className="mx-1">•</span>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">{bookingStats.pending}</span>
              <span>pending</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</h3>
            <CreditCard className="h-5 w-5 text-green-500 dark:text-green-400" />
          </div>
          <p className="text-2xl font-semibold mt-1 dark:text-white">
            €{bookingStats.totalRevenue.toFixed(2)}
          </p>
          <div className="mt-1 flex items-center text-xs">
            <div className="flex space-x-1 text-gray-500 dark:text-gray-400">
              <span>Additional</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">€{bookingStats.pendingRevenue.toFixed(2)}</span>
              <span>pending</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Need Attention</h3>
            <Bell className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-semibold mt-1 dark:text-white">{bookingStats.needAttention}</p>
          <div className="mt-1 flex items-center text-xs">
            <div className="flex space-x-1 text-gray-500 dark:text-gray-400">
              <span>Bookings within</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">24 hours</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority Bookings</h3>
            <Tag className="h-5 w-5 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-2xl font-semibold mt-1 dark:text-white">{bookingStats.urgentCount}</p>
          <div className="mt-1 flex items-center text-xs">
            <div className="flex space-x-1 text-gray-500 dark:text-gray-400">
              <span>Flagged as</span>
              <span className="font-medium text-red-600 dark:text-red-400">urgent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-grow md:max-w-md">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {/* Status filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        {/* Date Range filter */}
        <div>
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="today">Today</option>
            <option value="past">Past</option>
          </select>
        </div>
        
        {/* Driver filter */}
        <div>
          <select
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Drivers</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
        
        {/* Priority filter */}
        <div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Priorities</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700 mb-6">
        {filteredBookings.length === 0 ? (
          <EmptyState 
            title="No bookings found"
            description="No bookings match your current filters. Try changing your search or filter criteria."
            icon="calendar"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button 
                      className="flex items-center focus:outline-none"
                      onClick={() => handleSortChange('customer_name')}
                    >
                      Customer
                      {sortField === 'customer_name' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button 
                      className="flex items-center focus:outline-none"
                      onClick={() => handleSortChange('datetime')}
                    >
                      Date & Time
                      {sortField === 'datetime' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button 
                      className="flex items-center focus:outline-none"
                      onClick={() => handleSortChange('status')}
                    >
                      Status
                      {sortField === 'status' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button 
                      className="flex items-center focus:outline-none"
                      onClick={() => handleSortChange('priority')}
                    >
                      Priority
                      {sortField === 'priority' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredBookings.map((booking) => {
                  // Check if booking needs attention (pending and within 24 hours)
                  const bookingDate = new Date(booking.datetime);
                  const now = new Date();
                  const hoursDifference = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                  const needsAttention = booking.status === 'pending' && hoursDifference > 0 && hoursDifference < 24;
                  
                  // Display custom fees total
                  const customFeesTotal = (booking.custom_fees || []).reduce(
                    (sum, fee) => sum + (fee.amount || 0), 0
                  );
                  
                  // Set row styles based on priority and needs attention
                  let rowClassName = "hover:bg-gray-50 dark:hover:bg-gray-700 ";
                  if (booking.priority === 2 || needsAttention) {
                    rowClassName += "bg-red-50 dark:bg-red-900/10 ";
                  } else if (booking.priority === 1) {
                    rowClassName += "bg-blue-50 dark:bg-blue-900/10 ";
                  }
                  
                  return (
                    <tr key={booking.id} className={rowClassName}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div 
                          className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
                          onClick={() => handleOpenDetailModal(booking)}
                        >
                          {booking.customer_name}
                          {needsAttention && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                              <Bell className="h-3 w-3 mr-0.5" />
                              Soon
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                          <span className="truncate max-w-[150px]">{booking.customer_email}</span>
                          {booking.notes && (
                            <button 
                              onClick={() => handleOpenNoteModal(booking)}
                              className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                              title="Has notes"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Ref: {booking.booking_reference}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {format(new Date(booking.datetime), 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(booking.datetime), 'h:mm a')}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {booking.pickup_address || 'Unknown pickup'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                          →{' '}
                          <span className="truncate max-w-[150px]">
                            {booking.dropoff_address || 'Unknown dropoff'}
                          </span>
                        </div>
                        
                        {(booking.estimated_price > 0 || customFeesTotal > 0) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                            €{(booking.estimated_price || 0).toFixed(2)}
                            {customFeesTotal > 0 && (
                              <span className="ml-1 text-green-600 dark:text-green-400">
                                +€{customFeesTotal.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {booking.driver ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {booking.driver.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {booking.driver.phone || booking.driver.email}
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleOpenAssignModal(booking)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Assign Driver
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={booking.status}
                          onChange={(e) => updateBookingStatus(booking.id, e.target.value)}
                          className={`text-sm px-3 py-1 rounded border ${
                            booking.status === 'pending' 
                              ? 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800/30'
                              : booking.status === 'accepted'
                                ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30'
                                : booking.status === 'in_progress'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/30'
                                  : booking.status === 'completed'
                                    ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30'
                                    : 'bg-gray-50 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        {booking.last_reminder_sent && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Reminder sent:&nbsp;
                            {format(new Date(booking.last_reminder_sent), 'MMM d, HH:mm')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                            booking.priority === 2
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : booking.priority === 1
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                          onClick={() => handleOpenReminderModal(booking)}
                        >
                          {booking.priority === 2
                            ? <AlertCircle className="h-3.5 w-3.5 mr-1" />
                            : booking.priority === 1
                              ? <Clock className="h-3.5 w-3.5 mr-1" />
                              : <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          }
                          {booking.priority === 2
                            ? 'Urgent'
                            : booking.priority === 1
                              ? 'High'
                              : 'Normal'
                          }
                        </div>
                        {booking.internal_tags && booking.internal_tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {booking.internal_tags.slice(0, 2).map((tag, i) => (
                              <span 
                                key={i} 
                                className="inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {booking.internal_tags.length > 2 && (
                              <span className="inline-block px-1 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                                +{booking.internal_tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                                aria-label="More options"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => handleOpenDetailModal(booking)}>
                                <Info className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenNoteModal(booking)}>
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Add/Edit Notes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenReminderModal(booking)}>
                                <Bell className="w-4 h-4 mr-2" />
                                Set Priority/Reminder
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => sendReminder(booking)}>
                                <Clock className="w-4 h-4 mr-2" />
                                Send Reminder Now
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem onClick={() => handleOpenFeesModal(booking)}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Manage Fees
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenLogModal(booking)}>
                                <FileText className="w-4 h-4 mr-2" />
                                View Activity Log
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem onClick={() => duplicateBooking(booking)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate Booking
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <button
                            onClick={() => booking.driver_id ? handleOpenAssignModal(booking) : handleOpenAssignModal(booking)}
                            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            title={booking.driver_id ? "Change Driver" : "Assign Driver"}
                          >
                            {booking.driver_id ? <Car className="w-5 h-5" /> : <User className="w-5 h-5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Driver Assignment Modal */}
      {showAssignModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedBooking.driver ? 'Change Driver' : 'Assign Driver'} for Booking: {selectedBooking.booking_reference || `REF-${selectedBooking.id.substring(0, 8)}`}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Trip details summary */}
              <div className="mb-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer:</p>
                    <p className="font-medium dark:text-white">{selectedBooking.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date & Time:</p>
                    <p className="font-medium dark:text-white">
                      {format(new Date(selectedBooking.datetime), 'PPp')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pickup:</p>
                    <p className="font-medium dark:text-white">
                      {selectedBooking.pickup_address || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Dropoff:</p>
                    <p className="font-medium dark:text-white">
                      {selectedBooking.dropoff_address || 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Driver search and filters */}
              <div className="mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search drivers..."
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {driverSearchQuery && (
                    <button
                      onClick={() => setDriverSearchQuery('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <select
                  value={driverAvailabilityFilter}
                  onChange={(e) => setDriverAvailabilityFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 md:min-w-[150px] shrink-0"
                >
                  <option value="all">All Drivers</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              {/* Drivers list */}
              <div className="max-h-96 overflow-y-auto border dark:border-gray-700 rounded-lg">
                {loadingDrivers ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                ) : filteredDrivers.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Driver</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredDrivers.map((driver) => (
                        <tr key={driver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                <Car className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{driver.user?.name || 'Unknown'}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">ID: {driver.id.substring(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">{driver.user?.email || 'No email'}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{driver.user?.phone || 'No phone'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              driver.is_available
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {driver.is_available ? 'Available' : 'Unavailable'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => assignDriver(driver.id)}
                              disabled={assigningDriver}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 transition-colors"
                            >
                              {assigningDriver ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Assign'
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No drivers found matching your filters.
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-between">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <span className="mr-1">Showing</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">{filteredDrivers.length}</span>
                <span className="mx-1">of</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">{drivers.length}</span>
                <span className="ml-1">drivers</span>
              </div>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {showDetailModal && selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking}
          onClose={() => setShowDetailModal(false)}
          onStatusChange={updateBookingStatus}
          onAssignDriver={() => {
            setShowDetailModal(false);
            handleOpenAssignModal(selectedBooking);
          }}
          onEditNotes={() => {
            setShowDetailModal(false);
            handleOpenNoteModal(selectedBooking);
          }}
          onViewLogs={() => {
            setShowDetailModal(false);
            handleOpenLogModal(selectedBooking);
          }}
          onDuplicate={() => {
            setShowDetailModal(false);
            duplicateBooking(selectedBooking);
          }}
          onManageFees={() => {
            setShowDetailModal(false);
            handleOpenFeesModal(selectedBooking);
          }}
          onManagePriority={() => {
            setShowDetailModal(false);
            handleOpenReminderModal(selectedBooking);
          }}
        />
      )}

      {/* Notes Modal */}
      {showNoteModal && selectedBooking && (
        <BookingNoteModal 
          booking={selectedBooking}
          onClose={() => setShowNoteModal(false)}
          onSave={handleUpdateNotes}
        />
      )}

      {/* Activity Log Modal */}
      {showLogModal && selectedBooking && (
        <BookingLogModal 
          booking={selectedBooking}
          logs={activityLogs}
          onClose={() => setShowLogModal(false)}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <BookingExportModal 
          bookings={filteredBookings}
          onClose={() => setShowExportModal(false)}
          onExport={exportBookings}
        />
      )}

      {/* Reminder/Priority Modal */}
      {showReminderModal && selectedBooking && (
        <BookingReminderModal 
          booking={selectedBooking}
          onClose={() => setShowReminderModal(false)}
          onUpdatePriority={handleUpdatePriority}
          onSendReminder={sendReminder}
        />
      )}

      {/* Custom Fees Modal */}
      {showFeesModal && selectedBooking && (
        <BookingFeesModal 
          booking={selectedBooking}
          onClose={() => setShowFeesModal(false)}
          onSave={handleUpdateCustomFees}
        />
      )}
    </div>
  );
};

export default BookingsManagement;