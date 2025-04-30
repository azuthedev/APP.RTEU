import React from 'react';
import { X, CheckCircle, Upload, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AvailabilityModalProps {
  onClose: () => void;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'declined' | null;
  documentsUploaded: boolean;
}

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ 
  onClose, 
  verificationStatus,
  documentsUploaded
}) => {
  let title = 'Verification Required';
  let message = 'You need to be verified before you can set your availability status.';
  let actionText = 'Upload Documents';
  let actionLink = '/partner/documents';
  let icon = <Info className="w-12 h-12 text-blue-500 dark:text-blue-400 mx-auto mb-4" />;

  if (verificationStatus === 'pending') {
    title = 'Verification in Progress';
    message = 'Your documents are under review. We\'ll notify you as soon as your profile is verified.';
    actionText = 'View Status';
    actionLink = '/partner/documents';
    icon = <CheckCircle className="w-12 h-12 text-blue-500 dark:text-blue-400 mx-auto mb-4" />;
  } else if (verificationStatus === 'declined') {
    title = 'Verification Declined';
    message = 'Your verification was declined. Please update your documents and resubmit for approval.';
    actionText = 'Update Documents';
    actionLink = '/partner/documents';
    icon = <Info className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />;
  } else if (verificationStatus === 'unverified') {
    if (documentsUploaded) {
      title = 'Submit for Review';
      message = 'Your documents have been uploaded. Please submit them for verification to proceed.';
      actionText = 'Submit for Review';
      actionLink = '/partner/documents';
      icon = <Upload className="w-12 h-12 text-green-500 dark:text-green-400 mx-auto mb-4" />;
    } else {
      title = 'Documents Required';
      message = 'You need to upload your driver documents before you can be verified.';
      actionText = 'Upload Documents';
      actionLink = '/partner/documents';
      icon = <Upload className="w-12 h-12 text-blue-500 dark:text-blue-400 mx-auto mb-4" />;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="text-center pt-4">
          {icon}
          
          <h2 className="text-xl font-semibold mb-2 dark:text-white">
            {title}
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message}
          </p>
          
          <div className="flex flex-col space-y-3">
            <Link 
              to={actionLink}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors inline-flex items-center justify-center"
              onClick={onClose}
            >
              <Upload className="h-4 w-4 mr-2" />
              {actionText}
            </Link>
            
            <button
              onClick={onClose}
              className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityModal;