import React, { createContext, useState, useEffect, useContext } from 'react';

// Define the feature flags type
interface FeatureFlags {
  showCookieBanner: boolean;
  // Add more feature flags as needed
}

// Default state for feature flags
const defaultFeatureFlags: FeatureFlags = {
  showCookieBanner: true,
  // Set defaults for other flags
};

// Create context for feature flags
const FeatureFlagContext = createContext<{
  flags: FeatureFlags;
  setFeatureFlag: (key: keyof FeatureFlags, value: boolean) => void;
}>({
  flags: defaultFeatureFlags,
  setFeatureFlag: () => {},
});

// Helper function to get cookies by name
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

// Helper function to set cookies with domain attribute
const setCookie = (name: string, value: string, days: number = 365): void => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  
  // Get top-level domain for cross-domain compatibility
  let domain = window.location.hostname;
  
  // Extract top-level domain (e.g., example.com from subdomain.example.com)
  // This handles basic cases - for more complex scenarios, you might need to adjust this
  const parts = domain.split('.');
  if (parts.length > 2) {
    // If we have a subdomain, use the top two parts
    domain = parts.slice(-2).join('.');
  }
  
  // Set the cookie with domain attribute to share across subdomains
  document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; domain=.${domain}`;
};

interface FeatureFlagProviderProps {
  children: React.ReactNode;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    // Try to load flags from cookies first
    try {
      const cookieValue = getCookie('featureFlags');
      if (cookieValue) {
        return { ...defaultFeatureFlags, ...JSON.parse(cookieValue) };
      }
      
      // Fall back to localStorage for backward compatibility
      const savedFlags = localStorage.getItem('featureFlags');
      if (savedFlags) {
        const parsedFlags = JSON.parse(savedFlags);
        // Save to cookie for future cross-domain access
        setCookie('featureFlags', savedFlags);
        return { ...defaultFeatureFlags, ...parsedFlags };
      }
      
      return defaultFeatureFlags;
    } catch (error) {
      console.error('Error loading feature flags:', error);
      return defaultFeatureFlags;
    }
  });

  // Effect to fetch flags from a remote source if needed
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        // Check for URL parameters to override flags for testing
        const urlParams = new URLSearchParams(window.location.search);
        const showBanner = urlParams.get('show_cookies_banner');
        
        if (showBanner !== null) {
          const shouldShow = showBanner === '1' || showBanner.toLowerCase() === 'true';
          setFlags(prev => ({ ...prev, showCookieBanner: shouldShow }));
        }
      } catch (error) {
        console.error('Error fetching feature flags:', error);
      }
    };

    fetchFlags();
  }, []);

  // Save flags to cookies and localStorage when they change
  useEffect(() => {
    try {
      const flagsJson = JSON.stringify(flags);
      
      // Set as cookie with domain attribute for cross-domain sharing
      setCookie('featureFlags', flagsJson);
      
      // Also save to localStorage for backward compatibility
      localStorage.setItem('featureFlags', flagsJson);
    } catch (error) {
      console.error('Error saving feature flags:', error);
    }
  }, [flags]);

  // Function to set a specific feature flag
  const setFeatureFlag = (key: keyof FeatureFlags, value: boolean) => {
    setFlags(prev => ({ ...prev, [key]: value }));
  };

  // Define a global function for admin panel integration
  useEffect(() => {
    // Expose a global function to set feature flags from the admin panel
    window.setFeatureFlag = (key: string, value: boolean) => {
      if (key === 'show_cookies_banner') {
        setFeatureFlag('showCookieBanner', value);
        return true;
      }
      // Add more mappings as needed
      return false;
    };
    
    // Clean up
    return () => {
      delete window.setFeatureFlag;
    };
  }, []);

  return (
    <FeatureFlagContext.Provider value={{ flags, setFeatureFlag }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

// Hook to use feature flags
export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};

// Compatibility hook for existing code
export const useFeatureFlag = () => {
  const { flags } = useFeatureFlags();
  return flags;
};

// Extend the Window interface to include our global function
declare global {
  interface Window {
    setFeatureFlag?: (key: string, value: boolean) => boolean;
  }
}