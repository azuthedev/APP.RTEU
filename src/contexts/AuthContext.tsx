import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type UserData = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string, inviteCode?: string) => Promise<{ error: Error | null, data?: { user: User | null } }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null, session: Session | null }>;
  signOut: () => Promise<void>;
  updateUserData: (updates: Partial<Omit<UserData, 'id' | 'email' | 'created_at'>>) => 
    Promise<{ error: Error | null, data: UserData | null }>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to implement retry logic with exponential backoff
const retryWithExponentialBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let retries = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      // Check for refresh token errors and don't retry those
      if (error.message?.includes('refresh_token_not_found') || 
          error.error?.message?.includes('refresh_token_not_found') ||
          error.error === 'invalid_grant' ||
          (error.statusText === 'Bad Request' && error.status === 400)) {
        console.warn('Invalid refresh token detected, forcing sign out');
        throw error; // Don't retry for invalid refresh tokens
      }
      
      // If rate limited or if we should retry for this error
      if ((error.message?.includes('rate_limit') || error.status === 429) && retries < maxRetries) {
        retries++;
        console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay`);
        // Wait for the specified delay
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next potential retry (exponential backoff)
        delay *= 2;
      } else {
        // If we're out of retries or it's not a rate limit error, throw it
        throw error;
      }
    }
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const initialStateLoadedRef = useRef(false);
  const authStateChangeSubscribed = useRef(false);
  const tokenAuthAttemptedRef = useRef(false);
  const isRefreshingRef = useRef(false);

  // Function to fetch user data
  const fetchUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Check if the error is because no rows were returned
        if (error.code === 'PGRST116' || error.message?.includes('no rows')) {
          console.warn('No user data found for user ID:', userId);
          return null;
        }
        console.error('Error fetching user data:', error);
        return null;
      }

      setUserData(data);
      
      return data;
    } catch (error) {
      console.error('Unexpected error fetching user data:', error);
      return null;
    }
  };

  // Handle signed out state completely
  const handleSignedOut = async () => {
    console.log('Handling signed out state...');
    // Clear all auth state
    setSession(null);
    setUser(null);
    setUserData(null);
    
    // Ensure we're fully signed out from Supabase
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during cleanup signOut:', error);
    }
  };

  // Refresh the session to update JWT claims
  const refreshSession = async () => {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshingRef.current) {
      console.log('Session refresh already in progress, skipping');
      return;
    }

    try {
      isRefreshingRef.current = true;
      console.log('Refreshing session...');
      
      // Check if we have a current session first
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        console.log('No current session to refresh');
        await handleSignedOut();
        return;
      }
      
      // Use the retry logic with the refresh function
      try {
        const { data } = await retryWithExponentialBackoff(
          async () => await supabase.auth.refreshSession(),
          2, // Max 2 retries
          1000 // Start with 1s delay
        );
        
        const newSession = data.session;
        
        if (newSession) {
          console.log('Session refreshed successfully');
          setSession(newSession);
          setUser(newSession.user);
          
          if (newSession.user) {
            await fetchUserData(newSession.user.id);
          }
        } else {
          console.log('No session returned from refresh');
          await handleSignedOut();
        }
      } catch (error: any) {
        console.error('Error refreshing session:', error);
        // If refresh token is invalid or not found, sign the user out
        if (error.message?.includes('refresh_token_not_found') || 
            error.error?.message?.includes('refresh_token_not_found') ||
            error.error === 'invalid_grant' ||
            (error.statusText === 'Bad Request' && error.status === 400)) {
          console.warn('Invalid refresh token, signing out user');
          await handleSignedOut();
        }
      }
    } catch (error) {
      console.error('Error in refreshSession:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // Function to handle token authentication
  const handleTokenAuth = async () => {
    // Only attempt token auth once
    if (tokenAuthAttemptedRef.current) return;
    tokenAuthAttemptedRef.current = true;
    
    try {
      // Extract token from URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (!token) return;
      
      console.log('Found token in URL, attempting to sign in...');
      setLoading(true);
      
      // Sign in with the token
      const { data, error } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: '', // No refresh token available from the URL
      });
      
      if (error) {
        console.error('Error signing in with token:', error);
        return;
      }
      
      if (data.session) {
        console.log('Successfully signed in with token');
        setSession(data.session);
        setUser(data.session.user);
        
        // Fetch user data
        if (data.session.user) {
          await fetchUserData(data.session.user.id);
        }
      }
      
      // Remove token from URL for security (replace current URL without the query param)
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, document.title, url.toString());
      
    } catch (error) {
      console.error('Unexpected error in token auth:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First check for token auth
        await handleTokenAuth();
        
        // Then check for existing session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Fetch user data and update JWT claims if needed
          const userData = await fetchUserData(currentSession.user.id);
          if (userData?.user_role) {
            try {
              // Refresh session with retry logic to get updated JWT claims
              const { data } = await retryWithExponentialBackoff(
                async () => await supabase.auth.refreshSession(),
                2 // Max 2 retries to avoid hitting rate limits during initialization
              );
              
              if (data.session) {
                setSession(data.session);
              }
            } catch (refreshError: any) {
              console.error('Error refreshing session during init:', refreshError);
              // If refresh token is invalid, sign the user out
              if (refreshError.message?.includes('refresh_token_not_found') || 
                  refreshError.error?.message?.includes('refresh_token_not_found') ||
                  refreshError.error === 'invalid_grant' ||
                  (refreshError.statusText === 'Bad Request' && refreshError.status === 400)) {
                console.warn('Invalid refresh token during init, signing out user');
                await handleSignedOut();
              }
              // Continue with current session for other errors
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
        initialStateLoadedRef.current = true;
      }
    };

    initializeAuth();
  }, []);

  // Listen for auth changes
  useEffect(() => {
    if (!initialStateLoadedRef.current || authStateChangeSubscribed.current) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state change:', event);
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        await handleSignedOut();
      } else if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        if (!userData || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          const userData = await fetchUserData(currentSession.user.id);
          if (userData?.user_role) {
            try {
              // Refresh session with retry logic
              const { data } = await retryWithExponentialBackoff(
                async () => await supabase.auth.refreshSession()
              );
              
              if (data.session) {
                setSession(data.session);
              }
            } catch (refreshError: any) {
              console.error('Error refreshing session after auth change:', refreshError);
              // If refresh token is invalid, sign the user out
              if (refreshError.message?.includes('refresh_token_not_found') || 
                  refreshError.error?.message?.includes('refresh_token_not_found') ||
                  refreshError.error === 'invalid_grant' ||
                  (refreshError.statusText === 'Bad Request' && refreshError.status === 400)) {
                console.warn('Invalid refresh token after auth change, signing out user');
                await handleSignedOut();
              }
              // Continue with current session for other errors
            }
          }
        }
      }

      setLoading(false);
    });

    authStateChangeSubscribed.current = true;

    return () => {
      subscription.unsubscribe();
      authStateChangeSubscribed.current = false;
    };
  }, [userData]);

  const signUp = async (email: string, password: string, name: string, phone?: string, inviteCode?: string) => {
    try {
      setLoading(true);
      
      // Log for debugging
      console.log('Signup with invite code:', inviteCode);
      
      // Check invite code validity first if provided
      let inviteData = null;
      if (inviteCode) {
        const { data, error } = await supabase
          .from('invite_links')
          .select('*')
          .eq('code', inviteCode)
          .eq('status', 'active')
          .single();
          
        if (error) {
          console.error('Error validating invite code:', error);
          throw new Error('Invalid or expired invite code');
        }
        
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          // Mark as expired
          await supabase
            .from('invite_links')
            .update({ status: 'expired' })
            .eq('id', data.id);
            
          throw new Error('This invite link has expired');
        }
        
        inviteData = data;
        console.log('Valid invite data:', inviteData);
      }
      
      // Create metadata object
      const metadata: Record<string, string | null> = {
        name: name.trim(),
        phone: phone ? phone.trim() : null
      };
      
      // Important: Add invite code to metadata if provided
      if (inviteCode) {
        metadata.invite = inviteCode.trim();
      }
      
      console.log('Signup metadata being sent:', metadata);
      
      // Call Supabase signup with the metadata
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: metadata
        }
      });

      if (error) {
        console.error('Supabase signup error:', error);
        throw error;
      }
      
      if (!data.user) {
        throw new Error('User creation failed');
      }
      
      // Update invite link status if an invite code was used
      // NOTE: Using the anon client to update instead of the authenticated user
      if (inviteCode && inviteData && data.user) {
        try {
          const userId = data.user.id;
          console.log('Updating invite link status for new user:', userId);
          
          // Sign out temporarily to return to anon state
          await supabase.auth.signOut();
          
          // Now update as anon role (which has permission according to the RLS policy)
          const { error: updateError } = await supabase
            .from('invite_links')
            .update({ 
              status: 'used',
              used_at: new Date().toISOString(),
              used_by: userId
            })
            .eq('id', inviteData.id)
            .eq('status', 'active'); // Ensure we're only updating active invites
            
          if (updateError) {
            // Log the error but don't fail the signup
            console.error('Error updating invite link status:', updateError);
          } else {
            console.log('Successfully updated invite link status');
          }
          
          // Now sign back in to get a session for the new user
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });
          
          // If the invite specified a role, update the user's role
          if (inviteData.role) {
            console.log('Setting user role from invite:', inviteData.role);
            
            const { error: roleUpdateError } = await supabase
              .from('users')
              .update({ user_role: inviteData.role })
              .eq('id', userId);
              
            if (roleUpdateError) {
              console.error('Error updating user role:', roleUpdateError);
            } else {
              console.log('Successfully updated user role');
            }
          }
        } catch (updateError) {
          // Log the error but don't fail the signup
          console.error('Unexpected error updating invite status:', updateError);
        }
      }

      return { error: null, data };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) throw error;

      // Immediately update local state
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // Fetch user data
        const userData = await fetchUserData(data.session.user.id);
        
        if (userData?.user_role) {
          try {
            // Refresh session with retry logic
            const { data: refreshData } = await retryWithExponentialBackoff(
              async () => await supabase.auth.refreshSession()
            );
            
            if (refreshData.session) {
              setSession(refreshData.session);
            }
          } catch (refreshError: any) {
            console.error('Error refreshing session after sign in:', refreshError);
            // If refresh token is invalid, sign the user out
            if (refreshError.message?.includes('refresh_token_not_found') || 
                refreshError.error?.message?.includes('refresh_token_not_found') ||
                refreshError.error === 'invalid_grant' ||
                (refreshError.statusText === 'Bad Request' && refreshError.status === 400)) {
              console.warn('Invalid refresh token after sign in, signing out user');
              await handleSignedOut();
              throw new Error('Session refresh failed. Please try signing in again.');
            }
            // Continue with current session for other errors
          }
        }
      }
      
      return { error: null, session: data.session };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: error as Error, session: null };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await handleSignedOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserData = async (updates: Partial<Omit<UserData, 'id' | 'email' | 'created_at'>>) => {
    if (!user) {
      return { error: new Error('User not authenticated'), data: null };
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setUserData(data);
      
      // Refresh session to update JWT claims if user_role was updated
      if ('user_role' in updates) {
        try {
          // Use retry logic when refreshing
          const { data: refreshData } = await retryWithExponentialBackoff(
            async () => await supabase.auth.refreshSession()
          );
          
          if (refreshData.session) {
            setSession(refreshData.session);
          }
        } catch (refreshError: any) {
          console.error('Error refreshing session after user data update:', refreshError);
          // If refresh token is invalid, sign the user out
          if (refreshError.message?.includes('refresh_token_not_found') || 
              refreshError.error?.message?.includes('refresh_token_not_found') ||
              refreshError.error === 'invalid_grant' ||
              (refreshError.statusText === 'Bad Request' && refreshError.status === 400)) {
            console.warn('Invalid refresh token after user data update, signing out user');
            await handleSignedOut();
            throw new Error('Session refresh failed. Please sign in again.');
          }
          // Continue without refresh for other errors
        }
      }
      
      return { error: null, data };
    } catch (error) {
      console.error('Error updating user data:', error);
      return { error: error as Error, data: null };
    }
  };

  const value = {
    session,
    user,
    userData,
    loading,
    signUp,
    signIn,
    signOut,
    updateUserData,
    refreshSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};