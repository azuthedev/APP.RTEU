import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Car, FileText, BarChart2, Settings, ArrowLeft, Menu, User, MessageSquare, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import TodayJobs from '../components/partner/TodayJobs';
import JobCalendar from '../components/partner/JobCalendar';
import DriverProfile from '../components/partner/DriverProfile';
import DriverDocuments from '../components/partner/DriverDocuments';
import PaymentHistory from '../components/partner/PaymentHistory';
import PartnerSettings from '../components/partner/PartnerSettings';
import ChatSupport from '../components/partner/ChatSupport';
import IncidentReports from '../components/partner/IncidentReports';
import VerificationStatus from '../components/partner/VerificationStatus';
import ProfileVerificationPrompt from '../components/partner/ProfileVerificationPrompt';
import { useAuth } from '../contexts/AuthContext';
import { Toaster } from '../components/ui/toaster';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../components/ThemeToggle';
import DriverAvailabilityToggle from '../components/partner/DriverAvailabilityToggle';
import { supabase } from '../lib/supabase';
import ErrorBoundary from '../components/ErrorBoundary';
import SkipToContent from '../components/SkipToContent';
import LoadingFallback from '../components/LoadingFallback';

const Partner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [driverVerificationStatus, setDriverVerificationStatus] = useState<string | null>(null);
  const [showAvailabilityTooltip, setShowAvailabilityTooltip] = useState(false);

  // Setup admin view flag
  useEffect(() => {
    if (!loading && userData) {
      // Check if this is admin viewing the partner portal
      if (userData.user_role === 'admin') {
        setIsAdminView(true);
        console.log('Admin viewing partner portal');
      }
    }
  }, [userData, loading]);
  
  // Check driver status on component mount
  useEffect(() => {
    if (!loading && userData && userData.user_role === 'partner') {
      checkDriverStatus();
    }
  }, [userData, loading]);

  // Only redirect non-partner/non-admin users
  useEffect(() => {
    if (!loading && userData) {
      // Only redirect if user is neither admin nor partner
      if (userData.user_role !== 'admin' && userData.user_role !== 'partner') {
        if (userData.user_role === 'customer') {
          // Redirect customer to main website
          window.location.href = 'https://royaltransfer.eu/customer-dashboard';
        } else {
          navigate('/login', { replace: true });
        }
      }
    }
  }, [userData, loading, navigate]);

  // Check driver verification status
  const checkDriverStatus = async () => {
    try {
      // First check if the user has a driver record
      const { data: driverData, error: driverError } = await supabase
        .rpc('get_user_driver_id', { p_user_id: userData?.id })
        .then(async result => {
          if (result.error) {
            return { data: null, error: result.error };
          }

          if (result.data) {
            // If we got a driver ID, fetch the driver details
            const { data, error } = await supabase
              .from('drivers')
              .select('id, verification_status, is_available, decline_reason')
              .eq('id', result.data)
              .single();
            
            return { data, error };
          }
          
          return { data: null, error: null };
        });
      
      if (driverError) {
        console.error('Error fetching driver status:', driverError);
        return;
      }
      
      if (!driverData) {
        // No driver profile yet
        setDriverVerificationStatus('unverified');
        setShowVerificationPrompt(true);
        return;
      }
      
      // Set driver status and availability
      setDriverVerificationStatus(driverData.verification_status || 'unverified');
      setIsAvailable(driverData.is_available || false);
      
      // Show verification prompt for unverified or declined status
      if (driverData.verification_status === 'unverified' || driverData.verification_status === 'declined') {
        setShowVerificationPrompt(true);
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
    }
  };

  const tabs = [
    { id: 'today', label: "Today's Jobs", icon: Clock, path: '/partner' },
    { id: 'calendar', label: 'Schedule', icon: Calendar, path: '/partner/calendar' },
    { id: 'profile', label: 'Profile', icon: User, path: '/partner/profile' },
    { id: 'documents', label: 'Documents', icon: FileText, path: '/partner/documents' },
    { id: 'payments', label: 'Earnings', icon: BarChart2, path: '/partner/payments' },
    { id: 'incidents', label: 'Incident Reports', icon: AlertTriangle, path: '/partner/incidents' },
    { id: 'chat', label: 'Support Chat', icon: MessageSquare, path: '/partner/chat' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/partner/settings' }
  ];

  if (loading) {
    return <LoadingFallback message="Loading driver portal..." fullscreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mx-auto mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2 dark:text-white">Error</h2>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <SkipToContent contentId="main-content" />
      <Header />
      
      <main id="main-content" className="pt-32 pb-16" tabIndex={-1}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header section */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center">
              <a
                href="https://royaltransfer.eu/"
                className="mr-4 flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                aria-label="Go to main site"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                <span className="text-sm">Main site</span>
              </a>
              
              <div>
                <h1 className="text-xl md:text-2xl font-bold dark:text-white flex items-center">
                  <Car className="mr-2 h-6 w-6" aria-hidden="true" /> 
                  <span>Driver Portal</span>
                </h1>
                {isAdminView && (
                  <div className="mt-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-md inline-flex items-center" role="alert">
                    <span>Admin View Mode</span>
                    <Link 
                      to="/admin" 
                      className="ml-2 underline hover:text-purple-900 dark:hover:text-purple-200"
                    >
                      Return to Admin
                    </Link>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center mt-4 md:mt-0 space-x-3">
              {!isAdminView && (
                <div 
                  className="relative"
                  onMouseEnter={() => driverVerificationStatus !== 'verified' && setShowAvailabilityTooltip(true)}
                  onMouseLeave={() => setShowAvailabilityTooltip(false)}
                >
                  <DriverAvailabilityToggle 
                    isAvailable={isAvailable}
                    onChange={setIsAvailable}
                    verificationStatus={driverVerificationStatus as any}
                  />
                  
                  {/* Status tooltip */}
                  {showAvailabilityTooltip && driverVerificationStatus !== 'verified' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-60 bg-gray-800 text-white text-xs rounded py-2 px-3 shadow-lg z-10">
                      {driverVerificationStatus === 'pending' ? 
                        'Your documents are pending verification. You\'ll be able to go available once approved.' : 
                        'You need to complete verification before you can go available for trips.'}
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
                    </div>
                  )}
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>
          
          {/* Verification Status Banner */}
          {!isAdminView && driverVerificationStatus && (
            <div className="mb-6">
              <VerificationStatus className="w-full" />
            </div>
          )}

          <div className="flex flex-col md:flex-row">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden mb-4 p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-expanded={isSidebarOpen}
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
              <span className="sr-only">Toggle navigation menu</span>
            </button>

            {/* Sidebar */}
            <AnimatePresence>
              {(isSidebarOpen || window.innerWidth >= 768) && (
                <motion.div
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className={`
                    ${isSidebarOpen ? 'fixed inset-0 bg-white dark:bg-gray-800 z-50 md:relative md:bg-transparent dark:md:bg-transparent' : ''}
                    w-64 md:w-64 md:pr-8
                  `}
                  role="navigation"
                  aria-label="Main navigation"
                >
                  <div className="p-4 md:p-0">
                    <div className="mb-8 flex items-center justify-between md:hidden">
                      <h2 className="text-lg font-semibold dark:text-white">Menu</h2>
                      <button 
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                        aria-label="Close menu"
                      >
                        <span className="text-xl" aria-hidden="true">×</span>
                      </button>
                    </div>
                    <nav className="space-y-1">
                      {tabs.map(tab => (
                        <Link
                          key={tab.id}
                          to={tab.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md keyboard-focus
                          ${location.pathname === tab.path
                              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          aria-current={location.pathname === tab.path ? 'page' : undefined}
                        >
                          <tab.icon className="mr-3 h-5 w-5" aria-hidden="true" />
                          <span>{tab.label}</span>
                        </Link>
                      ))}
                    </nav>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 mt-4 md:mt-0">
              <ErrorBoundary>
                <Routes>
                  <Route index element={<TodayJobs />} />
                  <Route path="calendar" element={<JobCalendar />} />
                  <Route path="profile" element={<DriverProfile />} />
                  <Route path="documents" element={<DriverDocuments />} />
                  <Route path="payments" element={<PaymentHistory />} />
                  <Route path="incidents" element={<IncidentReports />} />
                  <Route path="chat" element={<ChatSupport />} />
                  <Route path="settings" element={<PartnerSettings />} />
                </Routes>
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </main>

      {/* Verification Prompt */}
      {showVerificationPrompt && !isAdminView && (
        <ProfileVerificationPrompt onDismiss={() => setShowVerificationPrompt(false)} />
      )}

      {/* Toast Container */}
      <Toaster />
    </div>
  );
};

export default Partner;