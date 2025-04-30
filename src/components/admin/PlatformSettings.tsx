import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Globe, 
  DollarSign, 
  Clock, 
  Mail, 
  Bell,
  Lock,
  Loader2,
  Save,
  AlertTriangle,
  Info,
  X
} from 'lucide-react';

interface SystemSettings {
  id?: string;
  default_currency: string;
  default_timezone: string;
  booking_auto_assign: boolean;
  driver_verification_required: boolean;
  admin_email_notifications: boolean;
  email_from_name: string;
  email_contact_address: string;
  privacy_policy_url: string;
  terms_url: string;
  max_failed_login_attempts: number;
  maintenance_mode: boolean;
  api_rate_limit: number;
  min_password_length: number;
  auto_archive_days: number;
  last_updated_by?: string;
  last_updated_at?: string;
}

const PlatformSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    default_currency: 'EUR',
    default_timezone: 'Europe/Berlin',
    booking_auto_assign: false,
    driver_verification_required: true,
    admin_email_notifications: true,
    email_from_name: 'Royal Transfer',
    email_contact_address: 'support@royaltransfer.eu',
    privacy_policy_url: 'https://royaltransfer.eu/privacy',
    terms_url: 'https://royaltransfer.eu/terms',
    max_failed_login_attempts: 5,
    maintenance_mode: false,
    api_rate_limit: 60,
    min_password_length: 8,
    auto_archive_days: 90
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'security' | 'advanced'>('general');
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const { toast } = useToast();
  const { userData, refreshSession } = useAuth();
  
  // Original settings reference for change detection
  const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);
  
  useEffect(() => {
    if (userData?.user_role === 'admin') {
      fetchSettings();
    } else {
      setLoading(false);
      setAccessError("You don't have permission to access platform settings. This section is restricted to administrators only.");
    }
  }, [userData]);

  // Track changes
  useEffect(() => {
    if (originalSettings) {
      setHasChanges(JSON.stringify(originalSettings) !== JSON.stringify(settings));
    }
  }, [settings, originalSettings]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setFetchAttempted(true);
      
      // Check for admin role
      if (userData?.user_role !== 'admin') {
        setAccessError("You don't have permission to access platform settings. This section is restricted to administrators only.");
        return;
      }
      
      // Get the current session for the JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Use the Supabase Edge Function to fetch settings
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-fetch-settings`, {
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

      const data = await response.json();
      
      if (data) {
        setSettings(data);
        setOriginalSettings(data);
      } else {
        // No settings record exists yet, create a default one
        await saveSettings(settings);
        setOriginalSettings(settings);
      }
    } catch (error: any) {
      console.error('Error fetching platform settings:', error);
      
      // Check if this is a permission error
      if (error.message?.includes('permission denied') || error.message?.includes('not authorized')) {
        setAccessError("You don't have permission to access platform settings. This section is restricted to administrators only.");
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to load platform settings."
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settingsData: SystemSettings) => {
    try {
      setSaving(true);

      // Check for admin role
      if (userData?.user_role !== 'admin') {
        throw new Error('Admin permissions required');
      }
      
      // Get the current session for the JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Use the Supabase Edge Function to update settings
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-update-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ...settingsData,
          last_updated_by: userData.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      
      if (result) {
        setSettings(result);
        setOriginalSettings(result);
      }
      
      toast({
        title: "Settings Saved",
        description: "Platform settings have been updated successfully.",
        variant: "success"
      });
      
      // Update original settings to reset change detection
      setOriginalSettings(settingsData);
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save settings."
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setSettings(prev => ({ ...prev, [name]: Number(value) }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCancel = () => {
    // Reset to original settings
    if (originalSettings) {
      setSettings(originalSettings);
    }
  };

  // Enable or disable maintenance mode
  const toggleMaintenanceMode = async (enable: boolean) => {
    try {
      const updatedSettings = {
        ...settings,
        maintenance_mode: enable
      };
      
      await saveSettings(updatedSettings);
      setShowMaintenance(false);
      
      // Show appropriate toast
      toast({
        title: enable ? "Maintenance Mode Enabled" : "Maintenance Mode Disabled",
        description: enable
          ? "The system is now in maintenance mode. Only admins can access it."
          : "The system is now back online for all users.",
        variant: enable ? "destructive" : "success"
      });
    } catch (error: any) {
      console.error('Error toggling maintenance mode:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to change maintenance mode setting."
      });
    }
  };

  // If there's an access error, show the restricted access message
  if (accessError) {
    return (
      <div className="space-y-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold dark:text-white mb-2">Platform Settings</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Configure global settings for the Royal Transfer EU platform.
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-lg text-center border border-red-100 dark:border-red-800">
          <div className="inline-flex items-center justify-center p-2 bg-red-100 dark:bg-red-800 rounded-full mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Access Restricted</h3>
          <p className="text-red-600 dark:text-red-400 max-w-md mx-auto">
            {accessError}
          </p>
          <p className="text-sm text-red-500 dark:text-red-400 mt-4">
            Please contact a system administrator if you believe you should have access.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !fetchAttempted) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white mb-2">Platform Settings</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Configure global settings for the Royal Transfer EU platform.
        </p>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="flex border-b dark:border-gray-700 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === 'general'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            General Settings
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === 'email'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Email Settings
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === 'security'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Security Settings
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === 'advanced'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Advanced Settings
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit}>
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Currency */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <DollarSign className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Default Currency
                    </label>
                    <select
                      name="default_currency"
                      value={settings.default_currency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="EUR">Euro (€)</option>
                      <option value="USD">US Dollar ($)</option>
                      <option value="GBP">British Pound (£)</option>
                      <option value="CHF">Swiss Franc (CHF)</option>
                      <option value="PLN">Polish Złoty (zł)</option>
                      <option value="CZK">Czech Koruna (Kč)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Currency used for displaying prices and processing payments
                    </p>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Default Timezone
                    </label>
                    <select
                      name="default_timezone"
                      value={settings.default_timezone}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Europe/Berlin">Central European Time (Berlin)</option>
                      <option value="Europe/London">GMT (London)</option>
                      <option value="Europe/Warsaw">Central European Time (Warsaw)</option>
                      <option value="Europe/Prague">Central European Time (Prague)</option>
                      <option value="Europe/Zurich">Central European Time (Zurich)</option>
                      <option value="Europe/Paris">Central European Time (Paris)</option>
                      <option value="America/New_York">Eastern Time (New York)</option>
                      <option value="UTC">UTC</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Timezone for displaying dates and times throughout the platform
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Auto Assign */}
                  <div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="booking_auto_assign"
                        name="booking_auto_assign"
                        checked={settings.booking_auto_assign}
                        onChange={(e) => setSettings(prev => ({ ...prev, booking_auto_assign: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:checked:bg-blue-600"
                      />
                      <label htmlFor="booking_auto_assign" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enable Automatic Driver Assignment
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                      When enabled, the system will automatically assign the nearest available driver to new bookings
                    </p>
                  </div>

                  {/* Driver Verification Requirement */}
                  <div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="driver_verification_required"
                        name="driver_verification_required"
                        checked={settings.driver_verification_required}
                        onChange={(e) => setSettings(prev => ({ ...prev, driver_verification_required: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:checked:bg-blue-600"
                      />
                      <label htmlFor="driver_verification_required" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Require Driver Verification
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                      When enabled, drivers must be verified before they can accept trips
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Privacy Policy URL */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Globe className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Privacy Policy URL
                    </label>
                    <input
                      type="url"
                      name="privacy_policy_url"
                      value={settings.privacy_policy_url}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/privacy"
                    />
                  </div>

                  {/* Terms of Service URL */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Globe className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Terms of Service URL
                    </label>
                    <input
                      type="url"
                      name="terms_url"
                      value={settings.terms_url}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/terms"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Email Settings */}
            {activeTab === 'email' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Email From Name */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Mail className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Email "From" Name
                    </label>
                    <input
                      type="text"
                      name="email_from_name"
                      value={settings.email_from_name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Company Name"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Name that will appear in the "From" field of emails
                    </p>
                  </div>

                  {/* Contact Email */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Mail className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Contact Email Address
                    </label>
                    <input
                      type="email"
                      name="email_contact_address"
                      value={settings.email_contact_address}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="contact@example.com"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Email address for customer inquiries
                    </p>
                  </div>
                </div>

                {/* Email Notifications */}
                <div>
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="admin_email_notifications"
                      name="admin_email_notifications"
                      checked={settings.admin_email_notifications}
                      onChange={(e) => setSettings(prev => ({ ...prev, admin_email_notifications: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:checked:bg-blue-600"
                    />
                    <label htmlFor="admin_email_notifications" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Admin Email Notifications
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Select which events trigger admin email notifications:
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notify_new_booking"
                        checked={true}
                        className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:checked:bg-blue-600"
                      />
                      <label htmlFor="notify_new_booking" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        New Bookings
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notify_cancelled_booking"
                        checked={true}
                        className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:checked:bg-blue-600"
                      />
                      <label htmlFor="notify_cancelled_booking" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Cancelled Bookings
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notify_new_user"
                        checked={true}
                        className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:checked:bg-blue-600"
                      />
                      <label htmlFor="notify_new_user" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        New User Registrations
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notify_driver_verification"
                        checked={true}
                        className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:checked:bg-blue-600"
                      />
                      <label htmlFor="notify_driver_verification" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Driver Verification Requests
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-100 dark:border-blue-800">
                  <div className="flex">
                    <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Email Templates</h3>
                      <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                        Email templates can be customized in the Developer Tools section. Changes to templates may take up to 5 minutes to propagate.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Maximum Failed Login Attempts */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Lock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Max Failed Login Attempts
                    </label>
                    <input
                      type="number"
                      name="max_failed_login_attempts"
                      value={settings.max_failed_login_attempts}
                      onChange={handleChange}
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Number of consecutive failed login attempts before temporary account lockout
                    </p>
                  </div>

                  {/* Minimum Password Length */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Lock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Minimum Password Length
                    </label>
                    <input
                      type="number"
                      name="min_password_length"
                      value={settings.min_password_length}
                      onChange={handleChange}
                      min="8"
                      max="32"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Minimum required length for user passwords
                    </p>
                  </div>
                </div>

                {/* API Throttling */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Globe className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                    API Rate Limit (requests per minute)
                  </label>
                  <input
                    type="number"
                    name="api_rate_limit"
                    value={settings.api_rate_limit}
                    onChange={handleChange}
                    min="10"
                    max="1000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Maximum number of API requests allowed per minute per IP address
                  </p>
                </div>

                {/* Security Notice */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-100 dark:border-yellow-800">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Security Information</h3>
                      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                        Changing security settings affects how users authenticate with the platform. Changes take effect immediately. Ensure all staff are informed of security policy changes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Advanced Settings */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Auto Archive Days */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Auto-Archive Completed Trips (days)
                    </label>
                    <input
                      type="number"
                      name="auto_archive_days"
                      value={settings.auto_archive_days}
                      onChange={handleChange}
                      min="30"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Number of days after which completed trips will be archived
                    </p>
                  </div>

                  {/* Maintenance Mode Toggle */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="maintenance_mode"
                          checked={settings.maintenance_mode}
                          onChange={(e) => setShowMaintenance(true)}
                          className="h-4 w-4 text-red-600 dark:text-red-500 border-gray-300 dark:border-gray-600 rounded focus:ring-red-500 dark:checked:bg-red-600"
                        />
                        <label htmlFor="maintenance_mode" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Maintenance Mode
                        </label>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                        When enabled, only administrators can access the platform
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setShowMaintenance(true)}
                      className="mt-2 inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Configure Maintenance
                    </button>
                  </div>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-100 dark:border-red-800">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Advanced Settings Warning</h3>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                        These settings can significantly impact system performance and availability. Changes should be made with caution and during low-traffic periods.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Save/Cancel Buttons */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving || !hasChanges}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="-ml-1 mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Maintenance Mode Confirmation Modal */}
      {showMaintenance && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b dark:border-red-800/30 flex justify-between items-center">
              <h3 className="text-lg font-medium text-red-800 dark:text-red-300 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Maintenance Mode
              </h3>
              <button 
                onClick={() => setShowMaintenance(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              {settings.maintenance_mode ? (
                <>
                  <p className="text-gray-700 dark:text-gray-300 mb-6">
                    Are you sure you want to disable maintenance mode? This will restore normal access to all users.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowMaintenance(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => toggleMaintenanceMode(false)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Disable Maintenance Mode
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Are you sure you want to enable maintenance mode? This will prevent all non-admin users from accessing the platform.
                  </p>
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/30 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      <strong>Warning:</strong> Only administrators will be able to access the platform while maintenance mode is active.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowMaintenance(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => toggleMaintenanceMode(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Enable Maintenance Mode
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformSettings;