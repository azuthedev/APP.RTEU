import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import { BookingProvider } from './contexts/BookingContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import InstallPWA from './components/InstallPWA';
import MobileInstallPrompt from './components/MobileInstallPrompt';
import DynamicPWAManifest from './components/DynamicPWAManifest';

// Route observer component to handle page-specific classes
const RouteObserver = () => {
  const location = useLocation();

  useEffect(() => {
    const isBookingPage = location.pathname.startsWith('/transfer/');
    document.documentElement.classList.toggle('booking-page', isBookingPage);
    
    return () => {
      document.documentElement.classList.remove('booking-page');
    };
  }, [location]);

  return null;
};

// Protected route component that redirects to login if not authenticated
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Public route component that redirects to admin if already authenticated
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userData, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (user) {
    // If user has admin role, redirect to admin page
    if (userData?.user_role === 'admin' || userData?.user_role === 'support') {
      return <Navigate to="/admin" replace />;
    }
    
    // Otherwise redirect to login (which will handle customer redirects)
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Root level route that redirects to login
const IndexRedirect = () => {
  return <Navigate to="/login" replace />;
};

function AppRoutes() {
  const { userData } = useAuth();
  
  return (
    <>
      <RouteObserver />
      {userData && <DynamicPWAManifest />}
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BookingProvider>
          <BrowserRouter>
            <AppRoutes />
            <InstallPWA />
            <MobileInstallPrompt />
          </BrowserRouter>
        </BookingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;