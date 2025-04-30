import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFeatureFlags } from '../FeatureFlagProvider';

const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const { flags } = useFeatureFlags();

  useEffect(() => {
    // Only show if the feature flag is enabled and consent not already given
    if (flags.showCookieBanner && !localStorage.getItem('cookieConsent')) {
      // Short delay before showing the banner for better UX
      const timer = setTimeout(() => {
        setVisible(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [flags.showCookieBanner]);

  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setVisible(false);
  };

  const declineCookies = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 z-50">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">We value your privacy</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              By clicking "Accept", you consent to our use of cookies. Read our{' '}
              <Link to="/cookie-policy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Cookie Policy
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </Link>.
            </p>
          </div>
          <div className="flex flex-row md:flex-row space-x-3 md:space-x-4">
            <button
              onClick={declineCookies}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium"
            >
              Decline
            </button>
            <button
              onClick={acceptCookies}
              className="px-4 py-2 bg-blue-600 rounded-md text-white hover:bg-blue-700 text-sm font-medium"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;