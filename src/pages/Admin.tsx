import React, { useEffect } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Users, Calendar, BarChart2, Settings, Database, AlertTriangle, ArrowLeft, Menu, Bug, LayoutDashboard, Car } from 'lucide-react';
import Header from '../components/Header';
import UserManagement from '../components/admin/UserManagement';
import BookingsManagement from '../components/admin/BookingsManagement';
import Dashboard from '../components/admin/Dashboard';
import PlatformSettings from '../components/admin/PlatformSettings';
import DebugPanel from '../components/admin/DebugPanel';
import ThemeToggle from '../components/ThemeToggle';
import AdminDeveloperTools from '../components/admin/AdminDeveloperTools';
import DriverVerification from '../components/admin/DriverVerification';
import { useAuth } from '../contexts/AuthContext';
import { Toaster } from '../components/ui/toaster';
import { motion, AnimatePresence } from 'framer-motion';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Redirect if not admin or support
  useEffect(() => {
    if (!loading && userData) {
      if (userData.user_role === 'customer') {
        // Redirect customer to main website
        window.location.href = 'https://royaltransfer.eu/customer-signup';
        return;
      }
      
      // Only redirect if not admin or support role (partners can be handled separately)
      if (userData.user_role !== 'admin' && userData.user_role !== 'support' && userData.user_role !== 'partner') {
        navigate('/login', { replace: true });
      }
    }
  }, [userData, loading, navigate]);

  // Filter tabs based on user role
  const getAllTabs = () => [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin', allowedRoles: ['admin', 'support'] },
    { id: 'users', label: 'User Management', icon: Users, path: '/admin/users', allowedRoles: ['admin'] },
    { id: 'bookings', label: 'Bookings', icon: Calendar, path: '/admin/bookings', allowedRoles: ['admin', 'support', 'partner'] },
    { id: 'drivers', label: 'Driver Verification', icon: Car, path: '/admin/drivers', allowedRoles: ['admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings', allowedRoles: ['admin'] },
    { id: 'admin-tools', label: 'Developer Tools', icon: Database, path: '/admin/admin-tools', allowedRoles: ['admin'] },
    { id: 'debug', label: 'Debug JWT', icon: Bug, path: '/admin/debug', allowedRoles: ['admin'] }
  ];

  const tabs = getAllTabs().filter(tab => 
    !userData?.user_role || tab.allowedRoles.includes(userData.user_role)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="dark:text-gray-300">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 dark:text-white">Error</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header />
      
      <main className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back to Site Button and Theme Toggle */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a
                href="https://royaltransfer.eu/"
                className="flex items-center text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Main site
              </a>
              
              {/* Partner Portal Button */}
              {userData?.user_role === 'admin' && (
                <Link
                  to="/partner"
                  className="flex items-center text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors"
                >
                  <Car className="w-5 h-5 mr-2" />
                  View Partner Portal
                </Link>
              )}
            </div>
            <ThemeToggle />
          </div>

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
                    <h1 className="text-2xl font-bold mb-8 dark:text-white">Admin Portal</h1>
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
                <Route index element={<Dashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="bookings" element={<BookingsManagement />} />
                <Route path="drivers" element={<DriverVerification />} />
                <Route path="settings" element={<PlatformSettings />} />
                <Route path="admin-tools" element={<AdminDeveloperTools />} />
                <Route path="debug" element={<DebugPanel />} />
              </Routes>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Container */}
      <Toaster />
    </div>
  );
};

const Admin = () => {
  return <AdminLayout />;
};

export default Admin;