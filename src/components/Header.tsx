import React, { useState, useEffect } from 'react';
import { User, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  hideSignIn?: boolean;
}

const Header = ({ hideSignIn = false }: HeaderProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, loading, signOut } = useAuth();
  const { theme } = useTheme();

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) {
      return 'Admin Portal';
    } else if (path.startsWith('/partner')) {
      return 'Driver Portal';
    }
    return '';
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      setShowUserMenu(false);
      navigate('/login');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Refresh the current page
    window.location.reload();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showUserMenu && !target.closest('#user-menu-button') && !target.closest('#user-menu')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu]);

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate(userData?.user_role === 'admin' ? '/admin' : '/partner')}
              className="flex items-center focus:outline-none h-[70px] py-[4px]"
            >
              {/* Light mode logo */}
              <div className="block dark:hidden h-full">
                <picture className="h-full w-auto">
                  <source srcSet="https://i.imghippo.com/files/cDgm3025PmI.webp" type="image/webp" />
                  <img
                    src="https://i.imgur.com/991MInn.png"
                    alt="Royal Transfer EU Logo"
                    className="h-full w-auto object-contain"
                  />
                </picture>
              </div>
              
              {/* Dark mode logo */}
              <div className="hidden dark:block h-full">
                <picture className="h-full w-auto">
                  <source srcSet="https://i.imghippo.com/files/SUQ5630UJo.webp" type="image/webp" />
                  <img
                    src="https://i.imghippo.com/files/SUQ5630UJo.webp"
                    alt="Royal Transfer EU Logo"
                    className="h-full w-auto object-contain"
                  />
                </picture>
              </div>
            </button>
            {userData && (
              <div className="hidden md:block text-gray-700 dark:text-gray-200">
                <span className="font-semibold">{getPageTitle()}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Refresh Button */}
            {user && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {!hideSignIn && (
              loading ? (
                <div className="w-10 h-10 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              ) : user ? (
                <div className="relative">
                  <button
                    id="user-menu-button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <User className="h-5 w-5" />
                  </button>
                  
                  {showUserMenu && (
                    <div 
                      id="user-menu"
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 border-b dark:border-gray-700">
                        {userData?.name || 'User'}
                        {userData?.user_role && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {userData.user_role}
                          </div>
                        )}
                      </div>
                      
                      {/* Add portal switcher for admins */}
                      {userData?.user_role === 'admin' && (
                        <>
                          <div className="pt-1 pb-1 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                            Switch Portal
                          </div>
                          <button
                            onClick={() => navigate('/admin')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              location.pathname.startsWith('/admin') 
                                ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            Admin Portal
                          </button>
                          <button
                            onClick={() => navigate('/partner')}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              location.pathname.startsWith('/partner') 
                                ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            Driver Portal
                          </button>
                          <div className="my-1 border-t dark:border-gray-700"></div>
                        </>
                      )}
                      
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => navigate('/login')}
                  className="hidden md:inline-flex border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 px-[calc(1.5rem-1px)] py-[calc(0.5rem-1px)] rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-300 box-border"
                >
                  Sign In
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;