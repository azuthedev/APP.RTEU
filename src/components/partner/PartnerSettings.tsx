import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/use-toast';
import { Bell, Moon, Sun, Shield, Smartphone, Globe, Loader2, Save } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const PartnerSettings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { userData } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [language, setLanguage] = useState('en');

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      // Simulate API call for saving settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };
  
  const requestNotificationPermission = async () => {
    try {
      if (!("Notification" in window)) {
        toast({
          variant: "destructive",
          title: "Not Supported",
          description: "This browser does not support notifications.",
        });
        return;
      }
      
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        setNotificationsEnabled(true);
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive notifications for new trips and updates.",
        });
      } else {
        setNotificationsEnabled(false);
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "Notification permission was denied. Update browser settings to enable.",
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to request notification permission.",
      });
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold dark:text-white mb-6">Settings</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
        {/* Profile section */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <h2 className="font-medium text-gray-900 dark:text-white">
            Profile Settings
          </h2>
        </div>
        
        <div className="p-6 border-b dark:border-gray-600">
          <div className="flex items-center mb-6 last:mb-0">
            <div className="flex-shrink-0 w-8">
              <Globe className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-grow">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Language
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Select your preferred language for the app
              </p>
            </div>
            <div className="flex-shrink-0 ml-4">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>
        </div>

        {/* App settings section */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <h2 className="font-medium text-gray-900 dark:text-white">
            App Settings
          </h2>
        </div>
        
        <div className="p-6 border-b dark:border-gray-600">
          {/* Theme setting */}
          <div className="flex items-center mb-6">
            <div className="flex-shrink-0 w-8">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <Sun className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              )}
            </div>
            <div className="flex-grow">
              <label htmlFor="theme-toggle" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Theme
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toggle between light and dark mode
              </p>
            </div>
            <div className="flex-shrink-0 ml-4">
              <button
                onClick={toggleTheme}
                className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent"
                aria-checked={theme === 'dark'}
                role="switch"
                id="theme-toggle"
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full ${
                    theme === 'dark' 
                      ? 'translate-x-5 bg-blue-600' 
                      : 'translate-x-0 bg-gray-300'
                  } transition duration-200 ease-in-out`}
                />
                <span 
                  className={`absolute inset-0 cursor-pointer rounded-full ${
                    theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Notifications setting */}
          <div className="flex items-center mb-6">
            <div className="flex-shrink-0 w-8">
              <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-grow">
              <label htmlFor="notifications-toggle" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Notifications
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive notifications for new trip assignments
              </p>
            </div>
            <div className="flex-shrink-0 ml-4">
              <button 
                onClick={requestNotificationPermission}
                className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent"
                aria-checked={notificationsEnabled}
                role="switch"
                id="notifications-toggle"
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full ${
                    notificationsEnabled 
                      ? 'translate-x-5 bg-blue-600' 
                      : 'translate-x-0 bg-gray-300'
                  } transition duration-200 ease-in-out`}
                />
                <span 
                  className={`absolute inset-0 cursor-pointer rounded-full ${
                    notificationsEnabled ? 'bg-gray-600' : 'bg-gray-200'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {/* Location sharing setting */}
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8">
              <Smartphone className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-grow">
              <label htmlFor="location-toggle" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Location Sharing
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Share your location during active trips
              </p>
            </div>
            <div className="flex-shrink-0 ml-4">
              <button
                onClick={() => setLocationSharingEnabled(!locationSharingEnabled)}
                className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent"
                aria-checked={locationSharingEnabled}
                role="switch"
                id="location-toggle"
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full ${
                    locationSharingEnabled 
                      ? 'translate-x-5 bg-blue-600' 
                      : 'translate-x-0 bg-gray-300'
                  } transition duration-200 ease-in-out`}
                />
                <span 
                  className={`absolute inset-0 cursor-pointer rounded-full ${
                    locationSharingEnabled ? 'bg-gray-600' : 'bg-gray-200'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Security section */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <h2 className="font-medium text-gray-900 dark:text-white">
            Security
          </h2>
        </div>
        
        <div className="p-6">
          <div className="flex items-start mb-6 pb-6 border-b dark:border-gray-600">
            <div className="flex-shrink-0 w-8 mt-1">
              <Shield className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Change Password
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Update your password regularly to keep your account secure
              </p>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                onClick={() => toast({
                  title: "Coming Soon",
                  description: "This feature will be available in the next update.",
                })}
              >
                Change Password
              </button>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerSettings;