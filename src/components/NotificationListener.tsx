import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/use-toast';
import { CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// A component that listens for real-time notifications from Supabase
const NotificationListener: React.FC = () => {
  const { userData } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [previousVerificationStatus, setPreviousVerificationStatus] = useState<string | null>(null);
  
  useEffect(() => {
    if (!userData?.id) return;

    // Store initial verification status
    if (userData.user_role === 'partner') {
      getInitialDriverStatus();
    }
    
    // Set up a subscription to listen for driver table changes
    const subscription = supabase
      .channel('driver-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'drivers',
          filter: `user_id=eq.${userData.id}`
        },
        (payload) => {
          // Handle driver record updates
          handleDriverUpdate(payload.new);
        }
      )
      .subscribe();

    // Also listen for new messages if partner
    if (userData.user_role === 'partner') {
      const messageSubscription = supabase
        .channel('new-messages')
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${userData.id}`
          },
          (payload) => {
            // Handle new message
            handleNewMessage(payload.new);
          }
        )
        .subscribe();
        
      // Clean up the message subscription
      return () => {
        supabase.removeChannel(messageSubscription);
        supabase.removeChannel(subscription);
      };
    }

    // Clean up the subscription
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userData?.id, userData?.user_role]);

  const getInitialDriverStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('verification_status')
        .eq('user_id', userData?.id)
        .single();
        
      if (!error && data) {
        setPreviousVerificationStatus(data.verification_status);
      }
    } catch (error) {
      console.error('Error getting initial driver status:', error);
    }
  };

  const handleDriverUpdate = (newData: any) => {
    // Check if verification status changed to verified
    if (previousVerificationStatus !== 'verified' && newData.verification_status === 'verified') {
      toast({
        title: "You're now verified! 🎉",
        description: "Congratulations! You can now set your availability and start accepting trips.",
        variant: "success",
        duration: 10000, // Show for 10 seconds
      });
      
      // Update local storage to show the profile verification prompt again
      localStorage.removeItem('profilePromptDismissed');
      
      // Refresh the page to update UI (for simplicity)
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } 
    // Check if verification status changed to declined
    else if (newData.verification_status === 'declined' && previousVerificationStatus !== 'declined') {
      toast({
        title: "Verification Declined",
        description: "Your driver verification has been declined. Please check your documents page for details.",
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
      
      // Remove dismissed flag to show prompt again
      localStorage.removeItem('profilePromptDismissed');
    }
    
    // Update stored status
    setPreviousVerificationStatus(newData.verification_status);
  };

  const handleNewMessage = (message: any) => {
    toast({
      title: "New Message",
      description: "You have received a new support message.",
      variant: "default",
      onClick: () => {
        navigate('/partner/chat');
      }
    });
  };

  return null; // This component doesn't render anything
};

export default NotificationListener;