import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Upload, AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useToast } from '../ui/use-toast';

interface ProfileVerificationPromptProps {
  onDismiss: () => void;
}

const ProfileVerificationPrompt: React.FC<ProfileVerificationPromptProps> = ({ onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  const [driverStatus, setDriverStatus] = useState<'unverified' | 'pending' | 'verified' | 'declined'>('unverified');
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const { userData } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Check if the prompt has been dismissed previously
    const isDismissed = localStorage.getItem('profilePromptDismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
    
    // Check driver verification status
    checkDriverStatus();
  }, [userData]);

  const checkDriverStatus = async () => {
    try {
      // Use the get_user_driver_id RPC function to check for driver profile
      const { data: driverId, error: driverIdError } = await supabase
        .rpc('get_user_driver_id');
      
      if (driverIdError || !driverId) {
        setDriverStatus('unverified');
        return;
      }
      
      // Now fetch the driver details
      const { data, error } = await supabase
        .from('drivers')
        .select('verification_status, decline_reason')
        .eq('id', driverId)
        .single();
        
      if (error) {
        console.error('Error fetching driver status:', error);
        setDriverStatus('unverified');
        return;
      }
      
      if (data) {
        setDriverStatus(data.verification_status || 'unverified');
        setDeclineReason(data.decline_reason);
      } else {
        setDriverStatus('unverified');
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
      setDriverStatus('unverified');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('profilePromptDismissed', 'true');
    setDismissed(true);
    onDismiss();
    
    toast({
      title: "Prompt Dismissed",
      description: "You can complete your profile verification at any time from your profile page.",
      variant: "default"
    });
  };

  // If already dismissed or status is pending/verified, don't show
  if (dismissed || driverStatus === 'pending' || driverStatus === 'verified') {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 overflow-hidden max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-blue-50 dark:bg-blue-900/30 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Driver Verification Required
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-full p-1 hover:bg-blue-100 dark:hover:bg-blue-800/50 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          {driverStatus === 'declined' ? (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-300">Your verification was declined</p>
                  {declineReason && (
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      Reason: {declineReason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            To start accepting trips, you need to upload your driver documents and complete your profile verification. This is required for safety and compliance.
          </p>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-start">
              <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full mr-2 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upload your driver's license and insurance documents
              </p>
            </div>
            <div className="flex items-start">
              <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full mr-2 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Complete your vehicle information
              </p>
            </div>
            <div className="flex items-start">
              <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full mr-2 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Wait for admin approval (typically within 24-48 hours)
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex flex-wrap justify-between gap-4">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            Remind Me Later
          </button>
          
          <Link
            to="/partner/documents"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            onClick={() => localStorage.removeItem('profilePromptDismissed')}
          >
            <Upload className="h-4 w-4 mr-2" />
            {driverStatus === 'declined' ? 'Resubmit Documents' : 'Upload Documents'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileVerificationPrompt;