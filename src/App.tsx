import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Partner from './pages/Partner';
import NotFound from './pages/NotFound';
import { BookingProvider } from './contexts/BookingContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FeatureFlagProvider } from './components/FeatureFlagProvider';
import { useAuth } from './contexts/AuthContext';
import { ErrorProvider } from './contexts/ErrorContext';
import InstallPWA from './components/InstallPWA';
import MobileInstallPrompt from './components/MobileInstallPrompt';
import DynamicPWAManifest from './components/DynamicPWAManifest';
import UpdateNotification from './components/UpdateNotification';
import NotificationListener from './components/NotificationListener';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import { Toaster } from './components/ui/toaster';

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
    return <LoadingFallback message="Checking authentication..." fullscreen />;
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
    return <LoadingFallback message="Checking authentication..." fullscreen />;
  }
  
  if (user) {
    if (userData?.user_role === 'admin' || userData?.user_role === 'support') {
      return <Navigate to="/admin" replace />;
    } else if (userData?.user_role === 'partner') {
      return <Navigate to="/partner" replace />;
    } else {
      // Otherwise redirect to login (which will handle customer redirects)
      return <Navigate to="/login" replace />;
    }
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
      <NotificationListener />
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback message="Loading content..." fullscreen />}>
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
            <Route 
              path="/partner/*" 
              element={
                <ProtectedRoute>
                  <Partner />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ErrorProvider>
            <FeatureFlagProvider>
              <BookingProvider>
                <BrowserRouter>
                  <DynamicPWAManifest />
                  <AppRoutes />
                  <InstallPWA />
                  <MobileInstallPrompt />
                  <UpdateNotification />
                  <Toaster />
                </BrowserRouter>
              </BookingProvider>
            </FeatureFlagProvider>
          </ErrorProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;