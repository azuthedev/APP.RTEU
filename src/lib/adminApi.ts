import { supabase } from './supabase';

export const adminApi = {
  /**
   * Fetches drivers with admin permissions
   */
  async fetchDrivers(options = {}) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-fetch-drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(options)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      return {
        data,
        error: null
      };
    } catch (error) {
      console.error('Error in adminApi.fetchDrivers:', error);
      return {
        data: null,
        error
      };
    }
  },
  
  /**
   * Fetches driver documents with admin permissions
   */
  async fetchDriverDocuments(driverId: string) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-fetch-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ driverId })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in adminApi.fetchDriverDocuments:', error);
      throw error;
    }
  },
  
  /**
   * Fetches driver activity logs with admin permissions
   */
  async fetchDriverLogs(driverId: string) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-fetch-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ driverId })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in adminApi.fetchDriverLogs:', error);
      throw error;
    }
  },
  
  /**
   * Approves a driver verification with admin permissions
   */
  async approveDriver(driverId: string) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-approve-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ driverId })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in adminApi.approveDriver:', error);
      throw error;
    }
  },
  
  /**
   * Declines a driver verification with admin permissions
   */
  async declineDriver(driverId: string, declineReason: string) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-decline-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ driverId, declineReason })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in adminApi.declineDriver:', error);
      throw error;
    }
  },
  
  /**
   * Toggles driver availability with admin permissions
   */
  async toggleDriverAvailability(driverId: string, newStatus: boolean, adminNote?: string) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-toggle-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ driverId, newStatus, adminNote })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in adminApi.toggleDriverAvailability:', error);
      throw error;
    }
  },
  
  /**
   * Fetches platform settings with admin permissions
   */
  async fetchPlatformSettings() {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-fetch-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in adminApi.fetchPlatformSettings:', error);
      throw error;
    }
  },
  
  /**
   * Updates platform settings with admin permissions
   */
  async updatePlatformSettings(settings: any) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in adminApi.updatePlatformSettings:', error);
      throw error;
    }
  }
};