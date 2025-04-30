import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from '../components/ui/use-toast';
import { Toaster } from '../components/ui/toaster';

interface LocationState {
  message?: string;
  from?: Location;
}

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, userData } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (user && userData) {
      if (userData.user_role === 'admin' || userData.user_role === 'support' || userData.user_role === 'partner') {
        navigate('/admin', { replace: true });
      } else if (userData.user_role === 'customer') {
        // Show toast for customer redirect
        toast({
          title: "Customer Account Detected",
          description: "This portal is for admin and partner access only. Redirecting to customer portal...",
          variant: "destructive"
        });
        
        // Wait a moment to show the toast before redirecting
        setTimeout(() => {
          window.location.href = 'https://royaltransfer.eu/customer-signup';
        }, 3000);
      }
    }
  }, [user, userData, navigate]);

  // Check for any message passed from other pages
  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.message) {
      toast({
        title: "Notice",
        description: state.message
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error, session } = await signIn(formData.email, formData.password);
      
      if (error) throw error;
      
      // If we have a session, redirection will be handled by the useEffect above
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header hideSignIn />
      
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
            <div className="flex justify-end mb-4">
              <ThemeToggle />
            </div>
            <h2 className="text-2xl font-bold text-center mb-6 dark:text-white">Admin Portal Login</h2>
            <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
              Access the administrative area of Royal Transfer EU
            </p>
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-md mb-6 text-sm flex items-start">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="ml-2">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-all duration-300 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Back Link */}
            <div className="mt-8 text-center">
              <a
                href="https://royaltransfer.eu/"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to main site
              </a>
            </div>
          </div>

          {/* Help Link */}
          <div className="text-center mt-6">
            <a
              href="https://royaltransfer.eu/contact"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Need Help? Contact Support
            </a>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
};

export default Login;