import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/useIsMobile';

const MobileInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    // Check if already installed (in standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone || 
                         document.referrer.includes('android-app://');
    
    // Check if user has previously dismissed the prompt
    const hasPromptBeenDismissed = localStorage.getItem('pwaPromptDismissed');
    
    // Only show on mobile devices, when not already installed, and not previously dismissed
    const shouldShow = isMobile && !isStandalone && !hasPromptBeenDismissed;
    
    if (shouldShow) {
      // Delay showing the prompt for 2 seconds to avoid disrupting initial experience
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isMobile]);
  
  // Handle dismiss action
  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwaPromptDismissed', 'true');
  };
  
  // Detect iOS Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  // Instructions based on platform
  const instructionText = isIOS
    ? "Tap the share icon and select 'Add to Home Screen'"
    : "Tap the menu icon and select 'Install App'";
  
  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className={`fixed bottom-0 left-0 right-0 z-50 m-4 p-4 rounded-lg shadow-lg ${
            theme === 'dark' 
              ? 'bg-gray-800 text-white border border-gray-700' 
              : 'bg-white text-gray-800 border border-gray-200'
          }`}
        >
          <button 
            onClick={handleDismiss}
            className={`absolute top-2 right-2 p-1 rounded-full ${
              theme === 'dark' 
                ? 'hover:bg-gray-700 text-gray-300' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            aria-label="Close prompt"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center">
            <div className={`p-2 rounded-full mr-3 ${
              theme === 'dark' ? 'bg-blue-900' : 'bg-blue-100'
            }`}>
              <Download className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} size={24} />
            </div>
            
            <div className="flex-1">
              <p className="font-medium mb-1">Install our app</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                For a better experience, add this app to your home screen.
              </p>
              <p className={`text-sm mt-1 font-medium ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {instructionText}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileInstallPrompt;