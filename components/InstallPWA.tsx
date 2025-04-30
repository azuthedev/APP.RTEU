import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAppName } from '../lib/iconUtils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
}

const InstallPWA: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { userData } = useAuth();
  
  const appName = getAppName(userData);

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Store the install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Handle app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
      console.log(`${appName} was installed`);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [appName]);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      console.log('Install prompt not available');
      return;
    }

    // Show the install prompt
    await installPrompt.prompt();

    // Wait for user to respond to the prompt
    const choiceResult = await installPrompt.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstallable(false);
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Clear the saved prompt
    setInstallPrompt(null);
  };

  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={handleInstallClick}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
      >
        <Download className="w-5 h-5 mr-2" />
        Install App
      </button>
    </div>
  );
};

export default InstallPWA;