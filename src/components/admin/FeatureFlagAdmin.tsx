import React, { useState, useEffect } from 'react';

interface FeatureFlag {
  key: string;
  name: string;
  enabled: boolean;
  description: string;
  scope?: 'global' | 'admin' | 'partner' | 'customer';
}

const defaultFlags: FeatureFlag[] = [
  {
    key: 'show_cookies_banner',
    name: 'Cookies Banner Pop-up',
    enabled: true,
    description: 'Controls whether users see the Cookies Banner Pop-up',
    scope: 'global'
  },
  // Add more feature flags as needed
];

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
  const parts = domain.split('.');
  if (parts.length > 2) {
    // If we have a subdomain, use the top two parts
    domain = parts.slice(-2).join('.');
  }
  
  // Set the cookie with domain attribute to share across subdomains
  document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; domain=.${domain}`;
};

const FeatureFlagAdmin: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  useEffect(() => {
    // Load flags
    const loadFlags = () => {
      setLoading(true);
      try {
        // Try to load from cookies first
        const cookieValue = getCookie('featureFlags');
        if (cookieValue) {
          const parsedFlags = JSON.parse(cookieValue);
          
          // Map from camelCase (cookie) to snake_case (admin UI)
          const mappedFlags = defaultFlags.map(flag => {
            if (flag.key === 'show_cookies_banner') {
              return {
                ...flag,
                enabled: parsedFlags.showCookieBanner ?? flag.enabled
              };
            }
            // Add mappings for other flags
            return flag;
          });
          
          setFlags(mappedFlags);
        } else {
          // Fall back to localStorage for backward compatibility
          const savedFlags = localStorage.getItem('featureFlags');
          if (savedFlags) {
            const parsedFlags = JSON.parse(savedFlags);
            
            // Map from camelCase to snake_case
            const mappedFlags = defaultFlags.map(flag => {
              if (flag.key === 'show_cookies_banner') {
                return {
                  ...flag,
                  enabled: parsedFlags.showCookieBanner ?? flag.enabled
                };
              }
              // Add mappings for other flags
              return flag;
            });
            
            setFlags(mappedFlags);
          } else {
            setFlags(defaultFlags);
          }
        }
      } catch (error) {
        console.error('Error loading feature flags:', error);
        setFlags(defaultFlags);
      } finally {
        setLoading(false);
      }
    };
    
    loadFlags();
  }, []);
  
  // Toggle a feature flag
  const toggleFlag = (key: string) => {
    setFlags(prev => prev.map(flag => 
      flag.key === key ? { ...flag, enabled: !flag.enabled } : flag
    ));
  };
  
  // Save changes
  const saveChanges = () => {
    setSaveStatus('saving');
    
    try {
      // Create an object with camelCase keys for storage
      const flagsObj: Record<string, any> = {};
      
      flags.forEach(flag => {
        if (flag.key === 'show_cookies_banner') {
          flagsObj.showCookieBanner = flag.enabled;
        }
        // Add handling for other flags
      });
      
      const flagsJson = JSON.stringify(flagsObj);
      
      // Set as cookie with domain attribute for cross-domain sharing
      setCookie('featureFlags', flagsJson);
      
      // Also save to localStorage for backward compatibility
      localStorage.setItem('featureFlags', flagsJson);
      
      // Update flags in main site using the global function if available
      flags.forEach(flag => {
        if (window.setFeatureFlag) {
          if (flag.key === 'show_cookies_banner') {
            window.setFeatureFlag('show_cookies_banner', flag.enabled);
          }
          // Add handling for other flags
        }
      });
      
      setSaveStatus('success');
      
      // Reset status after a delay
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error saving feature flags:', error);
      setSaveStatus('error');
      
      // Reset status after a delay
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  };
  
  if (loading) {
    return <div className="text-center p-4">Loading feature flags...</div>;
  }
  
  return (
    <div className="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold dark:text-white">Feature Flags (Client-Side)</h2>
        <button
          onClick={saveChanges}
          disabled={saveStatus === 'saving'}
          className={`px-4 py-2 rounded-md text-white ${
            saveStatus === 'saving' ? 'bg-gray-400 dark:bg-gray-600' :
            saveStatus === 'success' ? 'bg-green-500 dark:bg-green-600' :
            saveStatus === 'error' ? 'bg-red-500 dark:bg-red-600' :
            'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'
          }`}
        >
          {saveStatus === 'saving' ? 'Saving...' :
           saveStatus === 'success' ? 'Saved!' :
           saveStatus === 'error' ? 'Error!' :
           'Save Changes'}
        </button>
      </div>
      
      <div className="space-y-4">
        {flags.map(flag => (
          <div key={flag.key} className="border p-4 rounded-lg dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-medium text-lg dark:text-white">{flag.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{flag.description}</p>
                {flag.scope && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                    flag.scope === 'global' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : flag.scope === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        : flag.scope === 'partner'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {flag.scope.charAt(0).toUpperCase() + flag.scope.slice(1)}
                  </span>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={flag.enabled}
                  onChange={() => toggleFlag(flag.key)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:bg-gray-700 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">
              Key: {flag.key}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Cross-Domain Features</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          These feature flags are stored in cookies with a domain attribute set to your top-level domain.
          This allows settings to be shared between different subdomains (e.g., admin.example.com and app.example.com).
        </p>
      </div>
    </div>
  );
};

export default FeatureFlagAdmin;