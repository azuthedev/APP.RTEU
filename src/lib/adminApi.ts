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

const callEdgeFunction = async (functionName, payload) => {
  try {
    // Explicitly refresh the session before every call to ensure token validity
    await refreshSession();
    
    // Get current session after refresh
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.access_token) {
      throw new Error('No active session found. Please log in again.');
    }
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
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
  
  // Fetch driver documents
  fetchDriverDocuments: async (driverId) => {
    return callEdgeFunction('admin-fetch-documents', { driverId });
  },
  
  // Fetch driver activity logs
  fetchDriverLogs: async (driverId) => {
    return callEdgeFunction('admin-fetch-logs', { driverId });
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
  
  // Fetch platform settings
  fetchSettings: async () => {
    return callEdgeFunction('admin-fetch-settings', {});
  },
  
  // Update platform settings
  updateSettings: async (settings) => {
    return callEdgeFunction('admin-update-settings', { settings });
  }
};