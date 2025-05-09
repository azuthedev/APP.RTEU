import { supabase } from './supabase';

async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data.session?.access_token;
  } catch (error) {
    console.error("Failed to refresh session:", error);
    throw error;
  }
}

const callEdgeFunction = async (functionName, payload = {}, method = 'POST') => {
  try {
    // Explicitly refresh the session before every call to ensure token validity
    await refreshSession();
    
    // Get current session after refresh
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.access_token) {
      throw new Error('No active session found. Please log in again.');
    }
    
    // For GET requests, format query parameters
    let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
    if (method === 'GET' && Object.keys(payload).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      url += `?${queryParams.toString()}`;
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: method !== 'GET' ? JSON.stringify(payload) : undefined
    });
    
    // Check if response is ok
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Calling Supabase Edge Function failed:`, error);
    throw error;
  }
};

export const adminApi = {
  
  // Fetch all drivers 
  fetchDrivers: async () => {
    return callEdgeFunction('admin-fetch-drivers', {});
  },
  
  // Fetch pending drivers
  fetchPendingDrivers: async (status = 'pending') => {
    return callEdgeFunction('admin-fetch-pending-drivers', { verification_status: status }, 'GET');
  },
  
  // Fetch driver documents
  fetchDriverDocuments: async (driverId) => {
    return callEdgeFunction('admin-fetch-documents', { driverId });
  },
  
  // Fetch driver activity logs
  fetchDriverLogs: async (driverId) => {
    return callEdgeFunction('admin-fetch-logs', { driverId, type: 'driver' });
  },
  
  // Fetch bookings
  fetchBookings: async () => {
    return callEdgeFunction('admin-fetch-bookings', {});
  },
  
  // Fetch booking logs
  fetchBookingLogs: async (bookingId) => {
    return callEdgeFunction('admin-fetch-logs', { bookingId, type: 'booking' });
  },
  
  // Update booking
  updateBooking: async (bookingId, data) => {
    return callEdgeFunction('admin-update-booking', { bookingId, data });
  },
  
  // Assign driver to booking
  assignDriverToBooking: async (bookingId, driverId) => {
    return callEdgeFunction('admin-assign-driver', { bookingId, driverId });
  },
  
  // Log booking activity
  logBookingActivity: async (bookingId, action, details) => {
    return callEdgeFunction('admin-log-activity', { bookingId, action, details });
  },
  
  // Send booking reminder
  sendBookingReminder: async (bookingId) => {
    return callEdgeFunction('admin-send-reminder', { bookingId });
  },
  
  // Duplicate booking
  duplicateBooking: async (bookingId) => {
    return callEdgeFunction('admin-duplicate-booking', { bookingId });
  },
  
  // Approve driver
  approveDriver: async (driverId) => {
    return callEdgeFunction('admin-approve-driver', { driverId });
  },
  
  // Decline driver
  declineDriver: async (driverId, reason) => {
    return callEdgeFunction('admin-decline-driver', { 
      driverId, 
      reason 
    });
  },
  
  // Toggle driver availability
  toggleDriverAvailability: async (driverId, isAvailable) => {
    return callEdgeFunction('admin-toggle-availability', { 
      driverId, 
      isAvailable 
    });
  },
  
  // Create driver profile
  createDriverProfile: async (userId) => {
    return callEdgeFunction('driver-permissions-fix', { userId });
  },
  
  // Fetch platform settings
  fetchSettings: async () => {
    return callEdgeFunction('admin-fetch-settings', {});
  },
  
  // Update platform settings
  updateSettings: async (settings) => {
    return callEdgeFunction('admin-update-settings', { settings });
  },
  
  // Fetch payments
  fetchPayments: async (sinceDate, status) => {
    return callEdgeFunction('admin-fetch-payments', { 
      since_date: sinceDate, 
      status 
    }, 'GET');
  },
  
  // Fetch trip statistics
  fetchTripStats: async () => {
    return callEdgeFunction('admin-fetch-trip-stats', {});
  },
  
  // Fetch driver statistics
  fetchDriverStats: async () => {
    return callEdgeFunction('admin-fetch-driver-stats', {});
  }
};