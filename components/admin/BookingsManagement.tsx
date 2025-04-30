import React, { useState, useEffect } from 'react';
import { Search, Loader2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';

const BookingsManagement = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();
  const { userData } = useAuth();

  useEffect(() => {
    if (userData?.user_role === 'admin') {
      fetchBookings();
    }
  }, [userData]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // Check for admin role before making the request
      if (userData?.user_role !== 'admin') {
        throw new Error('Admin permissions required');
      }
      
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          user:users!trips_user_id_fkey(name, email),
          driver:users!trips_driver_id_fkey(name, email)
        `)
        .order('datetime', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch bookings. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('trips')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;
      
      // Update local state
      setBookings(bookings.map(booking => 
        booking.id === bookingId ? { ...booking, status: newStatus } : booking
      ));

      toast({
        title: "Success",
        description: "Booking status updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not update booking. Please try again.",
      });
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = (
      booking.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold dark:text-white">Bookings Management</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Booking ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Driver</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredBookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{booking.id.slice(0, 8)}...</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{booking.user?.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{booking.user?.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {booking.driver ? (
                    <>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{booking.driver.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{booking.driver.email}</div>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">Not assigned</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {format(new Date(booking.datetime), 'PPP')}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(booking.datetime), 'p')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={booking.status}
                    onChange={(e) => updateBookingStatus(booking.id, e.target.value)}
                    className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    title="View Details"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BookingsManagement;