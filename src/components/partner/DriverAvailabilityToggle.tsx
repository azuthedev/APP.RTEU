import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { Power, Lock, AlertTriangle } from 'lucide-react';
import AvailabilityModal from './AvailabilityModal';

interface DriverAvailabilityToggleProps {
  isAvailable: boolean;
  onChange: (isAvailable: boolean) => void;
  disabled?: boolean;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'declined' | null;
}

const DriverAvailabilityToggle: React.FC<DriverAvailabilityToggleProps> = ({ 
  isAvailable,
  onChange,
  disabled = false,
  verificationStatus = null
}) => {
  const { toast } = useToast();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [hasDocumentsUploaded, setHasDocumentsUploaded] = useState(false);
  
  const toggleAvailability = async () => {
    // If disabled or not verified, show modal and return
    if (disabled || verificationStatus !== 'verified') {
      // Check if documents are uploaded
      await checkDocumentsUploaded();
      setShowModal(true);
      return;
    }
    
    try {
      // Get the current driver record
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id, is_available, verification_status')
        .eq('user_id', supabase.auth.getSession().then(res => res.data.session?.user?.id))
        .single();
      
      if (driverError) {
        console.error('Error fetching driver data:', driverError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not update availability. Please try again later.",
        });
        return;
      }
      
      // Double-check verification status on the backend to prevent bypassing
      if (driverData.verification_status !== 'verified') {
        toast({
          variant: "destructive", 
          title: "Verification Required",
          description: "You need to be verified before you can change your availability."
        });
        return;
      }
      
      // Update the driver availability
      if (driverData) {
        const newAvailability = !isAvailable;
        const { error: updateError } = await supabase
          .from('drivers')
          .update({ 
            is_available: newAvailability,
            // Log the last time availability was changed
            updated_at: new Date().toISOString()
          })
          .eq('id', driverData.id);
          
        if (updateError) {
          console.error('Error updating availability:', updateError);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update your availability status.",
          });
          return;
        }
        
        // Update the local state
        onChange(newAvailability);
        
        // Log the activity
        await logAvailabilityChange(driverData.id, newAvailability);
        
        toast({
          title: newAvailability ? "You're now available" : "You're now unavailable",
          description: newAvailability 
            ? "You'll be notified of new job assignments." 
            : "You won't receive new job assignments while unavailable."
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Function to log availability changes
  const logAvailabilityChange = async (driverId: string, newStatus: boolean) => {
    try {
      await supabase.from('activity_logs').insert({
        driver_id: driverId,
        action: 'availability_change',
        details: {
          new_status: newStatus ? 'available' : 'unavailable',
          device_type: navigator.userAgent
        }
      });
    } catch (error) {
      console.error('Error logging availability change:', error);
      // Don't show toast for this since it's a background operation
    }
  };

  // Check if the driver has at least one document uploaded
  const checkDocumentsUploaded = async () => {
    try {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', supabase.auth.getSession().then(res => res.data.session?.user?.id))
        .single();

      if (driverData) {
        const { count, error } = await supabase
          .from('driver_documents')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', driverData.id);

        if (!error && count && count > 0) {
          setHasDocumentsUploaded(true);
        } else {
          setHasDocumentsUploaded(false);
        }
      }
    } catch (error) {
      console.error('Error checking documents:', error);
      setHasDocumentsUploaded(false);
    }
  };

  const showVerificationRequiredMessage = () => {
    let title, description;
    
    if (verificationStatus === 'unverified') {
      title = "Verification Required";
      description = "You need to upload and verify your documents before you can go available for trips.";
    } else if (verificationStatus === 'pending') {
      title = "Verification Pending";
      description = "Your documents are under review. We'll notify you as soon as your profile is verified.";
    } else if (verificationStatus === 'declined') {
      title = "Verification Declined";
      description = "Your verification was declined. Please update and resubmit your documents.";
    } else {
      title = "Not Available";
      description = "You can't change your availability status at this time.";
    }
    
    toast({
      title,
      description,
      variant: "destructive"
    });
  };

  // Determine if toggle should be disabled
  const isDisabled = disabled || (verificationStatus !== 'verified');

  return (
    <div className="relative">
      <button 
        onClick={toggleAvailability}
        onMouseEnter={() => isDisabled && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => isDisabled && setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
          isDisabled
            ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' 
            : isAvailable 
              ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-800/30' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        {isDisabled ? (
          <Lock size={16} className="text-gray-400 dark:text-gray-500" />
        ) : (
          <Power size={16} className={isAvailable ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'} />
        )}
        <span className="text-sm font-medium">{isAvailable ? 'Available' : 'Unavailable'}</span>
      </button>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-800 text-white text-xs rounded py-2 px-3 shadow-lg z-10">
          <div className="flex items-start">
            <AlertTriangle size={12} className="text-yellow-300 mt-0.5 mr-1.5 flex-shrink-0" />
            <p>
              {verificationStatus === 'unverified' 
                ? 'You need to upload and verify your documents first.' 
                : verificationStatus === 'pending'
                  ? 'Your documents are under review. Please wait for approval.'
                  : verificationStatus === 'declined'
                    ? 'Your verification was declined. Please update your documents.'
                    : 'You cannot change your availability status at this time.'}
            </p>
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
        </div>
      )}

      {/* Verification Required Modal */}
      {showModal && (
        <AvailabilityModal 
          onClose={() => setShowModal(false)}
          verificationStatus={verificationStatus}
          documentsUploaded={hasDocumentsUploaded}
        />
      )}
    </div>
  );
};

export default DriverAvailabilityToggle;