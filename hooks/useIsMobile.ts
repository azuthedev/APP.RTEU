import { useState, useEffect } from 'react';

// Hook to detect if the current device is mobile
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user agent indicates a mobile device
    const checkMobile = () => {
      const userAgent = 
        navigator.userAgent || navigator.vendor || (window as any).opera || '';
      
      // iOS detection
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
      
      // Android detection
      const isAndroid = /Android/i.test(userAgent);
      
      // General mobile detection
      const isMobileCheck = 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
        (window.innerWidth <= 768);
      
      setIsMobile(isIOS || isAndroid || isMobileCheck);
    };
    
    // Check on mount
    checkMobile();
    
    // Also check on resize for tablet/desktop devices that can change orientation
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return isMobile;
}