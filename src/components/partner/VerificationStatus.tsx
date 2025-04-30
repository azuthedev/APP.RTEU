import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, CheckCircle, Clock, XCircle, Info, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface VerificationStatusProps {
  className?: string;
}

const VerificationStatus: React.FC<VerificationStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<'unverified' | 'pending' | 'verified' | 'declined'>('unverified');
  const [loading, setLoading] = useState(true);
  const [docsUploaded, setDocsUploaded] = useState(0);
  const [docsRequired, setDocsRequired] = useState(0);
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const { userData } = useAuth();

  useEffect(() => {
    if (userData?.id) {
      fetchVerificationStatus();
      fetchDocumentStats();
    }
  }, [userData]);

  const fetchVerificationStatus = async () => {
    try {
      setLoading(true);
      
      // First check if the user has a driver record using RPC
      const { data: driverId, error: driverIdError } = await supabase
        .rpc('get_user_driver_id', { p_user_id: userData?.id });
      
      if (driverIdError || !driverId) {
        // No driver record found
        setStatus('unverified');
        return;
      }
      
      // Now fetch the driver details with the ID
      const { data, error } = await supabase
        .from('drivers')
        .select('verification_status, decline_reason')
        .eq('id', driverId)
        .single();
      
      if (error) {
        console.error('Error fetching driver verification status:', error);
        setStatus('unverified');
        return;
      }
      
      // Set the status based on database value or default to unverified
      if (data) {
        setStatus(data.verification_status || 'unverified');
        setDeclineReason(data.decline_reason);
      } else {
        setStatus('unverified');
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      setStatus('unverified');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentStats = async () => {
    try {
      // Get driver ID using the RPC function
      const { data: driverId, error: driverIdError } = await supabase
        .rpc('get_user_driver_id', { p_user_id: userData?.id });
      
      if (driverIdError || !driverId) {
        setDocsUploaded(0);
        setDocsRequired(3); // Default required docs count
        return;
      }
      
      // Count uploaded documents
      const { count: uploadedCount, error: uploadedError } = await supabase
        .from('driver_documents')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driverId);
        
      if (uploadedError) {
        console.error('Error counting uploaded documents:', uploadedError);
        return;
      }
      
      setDocsUploaded(uploadedCount || 0);
      setDocsRequired(3); // Required docs: License, Insurance, Registration
      
    } catch (error) {
      console.error('Error fetching document stats:', error);
    }
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'unverified':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          icon: <AlertCircle className="h-5 w-5 mr-2" />,
          text: 'Unverified',
          description: 'Your driver profile is incomplete. Please upload your documents for verification.'
        };
      case 'pending':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          borderColor: 'border-blue-200 dark:border-blue-800',
          icon: <Clock className="h-5 w-5 mr-2" />,
          text: 'Pending Review',
          description: 'Your documents are being reviewed. This typically takes 24-48 hours.'
        };
      case 'verified':
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          borderColor: 'border-green-200 dark:border-green-800',
          icon: <CheckCircle className="h-5 w-5 mr-2" />,
          text: 'Verified',
          description: 'Your driver profile is verified. You can now accept trips.'
        };
      case 'declined':
        return {
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          borderColor: 'border-red-200 dark:border-red-800',
          icon: <XCircle className="h-5 w-5 mr-2" />,
          text: 'Verification Declined',
          description: declineReason || 'Your verification was declined. Please check your profile for details and resubmit.'
        };
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          borderColor: 'border-gray-200 dark:border-gray-700',
          icon: <Info className="h-5 w-5 mr-2" />,
          text: 'Status Unknown',
          description: 'Unable to determine your verification status. Please contact support.'
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (loading) {
    return (
      <div className={`p-4 animate-pulse ${className}`}>
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div className={`p-4 rounded-lg border ${statusInfo.borderColor} ${statusInfo.bgColor}`}>
        <div className="flex items-center mb-2">
          <div className={`${statusInfo.color}`}>
            {statusInfo.icon}
          </div>
          <h3 className={`font-medium ${statusInfo.color}`}>
            {statusInfo.text}
          </h3>
          
          {docsRequired > 0 && (
            <div className="ml-auto text-sm">
              <span className="text-gray-500 dark:text-gray-400">Documents: </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {docsUploaded} / {docsRequired}
              </span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {statusInfo.description}
        </p>
        
        {status !== 'verified' && (
          <Link 
            to="/partner/documents" 
            className="mt-3 inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            {status === 'declined' ? 'Update documents' : 'Complete verification'}
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default VerificationStatus;