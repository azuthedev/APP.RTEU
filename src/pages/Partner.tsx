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
import { adminApi } from '../lib/adminApi';

const LAST_PARTNER_PATH_KEY = 'lastPartnerPath';

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

  // Save current path to localStorage whenever location changes
  useEffect(() => {
    if (location.pathname.startsWith('/partner')) {
      localStorage.setItem(LAST_PARTNER_PATH_KEY, location.pathname);
    }
  }, [location.pathname]);
  
  // On initial load, check if there's a saved path to restore
  useEffect(() => {
    // Only redirect if we're at the root partner path and there's a saved path
    if (location.pathname === '/partner' && !loading) {
      const savedPath = localStorage.getItem(LAST_PARTNER_PATH_KEY);
      if (savedPath && savedPath !== '/partner') {
        navigate(savedPath, { replace: true });
      }
    }
  }, [location.pathname, navigate, loading]);

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
      if (!userData || !userData.id) return;
      
      // Use adminApi instead of direct Supabase query
      const response = await adminApi.fetchDrivers({ userId: userData.id });
      
      if (!response || response.error) {
        console.error('Error fetching driver status:', response?.error || 'No data returned');
        setDriverVerificationStatus('unverified');
        setShowVerificationPrompt(true);
        return;
      }
      
      // Check if any driver data was returned
      if (response.data && response.data.length > 0) {
        const driverData = response.data[0];
        setDriverVerificationStatus(driverData.verification_status || 'unverified');
        setIsAvailable(driverData.is_available || false);
        
        // Show verification prompt for unverified or declined status
        if (driverData.verification_status === 'unverified' || driverData.verification_status === 'declined') {
          setShowVerificationPrompt(true);
        }
      } else {
        // No driver record found
        setDriverVerificationStatus('unverified');
        setShowVerificationPrompt(true);
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
      setDriverVerificationStatus('unverified');
      setShowVerificationPrompt(true);
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
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="dark:text-white">Loading driver portal...</p>
        </div>
      </div>
    );
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
      <Header />
      
      <main className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header section */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center">
              <a
                href="https://royaltransfer.eu/"
                className="mr-4 flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                <span className="text-sm">Main site</span>
              </a>
              
              <div>
                <h1 className="text-xl md:text-2xl font-bold dark:text-white flex items-center">
                  <Car className="mr-2 h-6 w-6" /> 
                  Driver Portal
                </h1>
                {isAdminView && (
                  <div className="mt-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-md inline-flex items-center">
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
            >
              <Menu className="w-6 h-6" />
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
                >
                  <div className="p-4 md:p-0">
                    <div className="mb-8 flex items-center justify-between md:hidden">
                      <h2 className="text-lg font-semibold dark:text-white">Menu</h2>
                      <button 
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                      >
                        <span className="text-xl">×</span>
                      </button>
                    </div>
                    <nav className="space-y-1">
                      {tabs.map(tab => (
                        <Link
                          key={tab.id}
                          to={tab.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md 
                          ${location.pathname === tab.path
                              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <tab.icon className="mr-3 h-5 w-5" />
                          {tab.label}
                        </Link>
                      ))}
                    </nav>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 mt-4 md:mt-0">
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