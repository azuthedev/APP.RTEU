import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { ToastAction } from './ui/toast';

interface UpdateNotificationProps {
  checkIntervalMs?: number; // How often to check for updates (default: 60 minutes)
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ 
  checkIntervalMs = 60 * 60 * 1000 
}) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let registration: ServiceWorkerRegistration | null = null;

    // Check if the browser supports service workers
    if ('serviceWorker' in navigator) {
      // Function to check for updates
      const checkForUpdates = async () => {
        try {
          // Get the registration
          registration = await navigator.serviceWorker.getRegistration();
          
          if (registration?.waiting) {
            // If there's a waiting worker, we have an update
            console.log('Update available!');
            setUpdateAvailable(true);
            showUpdateNotification();
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
        }
      };

      // Initial check
      checkForUpdates();

      // Set up periodic checks
      const intervalId = setInterval(checkForUpdates, checkIntervalMs);

      // Listen for controlling service worker changes
      const onControllerChange = () => {
        console.log('Controller changed, new version is active');
      };
      
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      
      // Set up update event listener from the service worker
      const onMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          setUpdateAvailable(true);
          showUpdateNotification();
        }
      };
      
      navigator.serviceWorker.addEventListener('message', onMessage);
      
      // Add update found listener when registering
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                showUpdateNotification();
              }
            });
          }
        });
      });

      return () => {
        clearInterval(intervalId);
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        navigator.serviceWorker.removeEventListener('message', onMessage);
      };
    }
  }, [checkIntervalMs]);

  // Function to handle reload
  const handleReload = () => {
    // Save scroll position or any other state if needed
    window.location.reload();
  };

  // Function to show the update notification
  const showUpdateNotification = () => {
    // Only show if update is available
    if (!updateAvailable) return;
    
    toast({
      title: "New Version Available",
      description: "A newer version of this application is available. Reload to update.",
      variant: "default",
      duration: 0, // Don't auto-dismiss
      className: "update-notification",
      action: (
        <ToastAction altText="Reload" onClick={handleReload}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Reload
        </ToastAction>
      ),
    });
  };

  return null; // This component doesn't render anything visible
};

export default UpdateNotification;