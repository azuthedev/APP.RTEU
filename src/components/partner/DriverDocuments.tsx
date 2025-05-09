import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2,
  AlertTriangle,
  Eye,
  Calendar,
  Info,
  Save
} from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import { Link } from 'react-router-dom';

interface Document {
  id: string;
  driver_id: string;
  doc_type: 'license' | 'insurance' | 'registration' | 'other';
  file_url: string;
  uploaded_at: string;
  verified: boolean;
  expiry_date: string | null;
  name: string;
}

const DOCUMENT_TYPES = [
  { value: 'license', label: 'Driver License', required: true },
  { value: 'insurance', label: 'Insurance Certificate', required: true },
  { value: 'registration', label: 'Vehicle Registration', required: true },
  { value: 'other', label: 'Other Document', required: false }
];

const DriverDocuments: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasAnyDocument, setHasAnyDocument] = useState(false);
  const [submittingForReview, setSubmittingForReview] = useState(false);
  const [uploadExpiryDate, setUploadExpiryDate] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [localDocumentUrls, setLocalDocumentUrls] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { userData } = useAuth();
  const [creatingDriverProfile, setCreatingDriverProfile] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      fetchDriverId().then(id => {
        if (id) {
          setDriverId(id);
          fetchDocuments(id);
          fetchDriverStatus(id);
        } else {
          // Don't create driver profile automatically
          // We'll create it when they submit documents or click "Submit for Verification"
          setLoading(false);
        }
      });
    }
  }, [userData]);

  // Check if at least one document is uploaded or selected
  useEffect(() => {
    // Get the list of documents (existing or staged)
    const existingDocTypes = documents.map(doc => doc.doc_type);
    const stagedDocTypes = Object.keys(uploadedFiles);
    const allDocTypes = [...new Set([...existingDocTypes, ...stagedDocTypes])];
    
    // Check if we have any documents
    setHasAnyDocument(allDocTypes.length > 0);
  }, [documents, uploadedFiles]);

  const fetchDriverId = async (): Promise<string | null> => {
    try {
      // Using RPC is more secure than direct table access
      const { data, error } = await supabase
        .rpc('get_user_driver_id');

      if (error) {
        console.error('Error fetching driver ID:', error);
        // This is expected for new drivers, no need to show toast
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  };

  const createDriverProfile = async (): Promise<string | null> => {
    try {
      setErrorMessage(null);
      setCreatingDriverProfile(true);
      
      // Get the current session for the JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Call the edge function to securely create a driver profile
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-driver-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.driverId) {
        setDriverId(result.driverId);
        setVerificationStatus('unverified');
        return result.driverId;
      }
      
      throw new Error('Failed to create driver profile');
    } catch (error: any) {
      console.error('Error creating driver profile:', error);
      setErrorMessage(error.message || 'Could not create your driver profile. Please try again or contact support.');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not create your driver profile. Please try again or contact support.",
      });
      return null;
    } finally {
      setCreatingDriverProfile(false);
    }
  };

  const fetchDriverStatus = async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('verification_status, decline_reason')
        .eq('id', driverId)
        .single();

      if (error) {
        console.error('Error fetching driver status:', error);
        return;
      }

      setVerificationStatus(data?.verification_status || 'unverified');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchDocuments = async (driverId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('driver_id', driverId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch your documents.",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitForReview = async () => {
    // Only proceed if we have any documents to submit
    if (!hasAnyDocument && Object.keys(uploadedFiles).length === 0) {
      toast({
        variant: "destructive",
        title: "No Documents",
        description: "Please upload at least one document before submitting for verification.",
      });
      return;
    }

    try {
      setSubmittingForReview(true);
      setErrorMessage(null);

      // First, ensure we have a driver profile
      let currentDriverId = driverId;
      if (!currentDriverId) {
        // Create driver profile if it doesn't exist
        currentDriverId = await createDriverProfile();
        if (!currentDriverId) {
          throw new Error('Could not create driver profile');
        }
        setDriverId(currentDriverId);
      }
      
      // Now upload any saved documents to existing driver profile
      await uploadSavedDocuments(currentDriverId);
      
      // Get the current session for the JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Update driver verification status using a function call for security
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/update-driver-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          driverId: currentDriverId,
          status: 'pending'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      // Update state
      setVerificationStatus('pending');
      
      toast({
        title: "Documents Submitted",
        description: "Your documents have been submitted for review. You'll be notified once they're verified.",
        variant: "success"
      });
      
      // Clear temporary uploads
      setUploadedFiles({});
      setLocalDocumentUrls({});
      setExpiryDates({});
      
      // Refresh document list
      fetchDocuments(currentDriverId);
      
      // Remove dismiss flag to show prompt again when status changes
      localStorage.removeItem('profilePromptDismissed');
    } catch (error: any) {
      console.error('Error submitting for review:', error);
      setErrorMessage(error.message || "Failed to submit for review. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit for review. Please try again.",
      });
    } finally {
      setSubmittingForReview(false);
    }
  };

  const generateLocalDocumentUrl = (file: File): string => {
    return URL.createObjectURL(file);
  };

  const handleFilePrepare = async (docType: string, file: File) => {
    if (!file) return;
    
    try {
      setUploading(docType);
      setErrorMessage(null);
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 5MB.');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG or PDF file.');
      }

      // Store uploaded file and expiry date in local state
      setUploadedFiles(prev => ({
        ...prev,
        [docType]: file
      }));
      
      // Generate and store local URL for preview
      const localUrl = generateLocalDocumentUrl(file);
      setLocalDocumentUrls(prev => ({
        ...prev,
        [docType]: localUrl
      }));
      
      // Store expiry date if set
      if (uploadExpiryDate) {
        setExpiryDates(prev => ({
          ...prev,
          [docType]: uploadExpiryDate
        }));
      }

      toast({
        title: "File Selected",
        description: "Document is ready for submission. Click 'Submit for Verification' when ready.",
      });
      
      // Reset upload expiry date for next document
      setUploadExpiryDate(null);
    } catch (error: any) {
      console.error('Error preparing document:', error);
      setErrorMessage(error.message || "Failed to prepare document. Please try again.");
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to prepare document. Please try again.",
      });
    } finally {
      setUploading(null);
    }
  };

  const uploadSavedDocuments = async (driverId: string): Promise<boolean> => {
    try {
      // Upload each saved document using the edge function
      for (const docType of Object.keys(uploadedFiles)) {
        const file = uploadedFiles[docType];
        const expiryDate = expiryDates[docType] || null;

        // Get the current session for the JWT token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Authentication required');
        }
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);
        formData.append('driverId', driverId);
        formData.append('fileName', file.name);
        if (expiryDate) {
          formData.append('expiryDate', expiryDate);
        }
        
        // Call the edge function to upload the document
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/upload-driver-document`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
      }
      
      return true;
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to upload documents. Please try again.",
      });
      return false;
    }
  };

  const getDocumentTypeLabel = (type: string): string => {
    const docType = DOCUMENT_TYPES.find(t => t.value === type);
    return docType ? docType.label : type;
  };

  const getDocumentStatus = (document: Document) => {
    if (!document.verified) {
      return {
        icon: <Clock className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />,
        text: 'Pending Verification',
        color: 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30'
      };
    }

    if (document.expiry_date) {
      const expiry = new Date(document.expiry_date);
      const now = new Date();
      const expiringThreshold = addDays(now, 30);

      if (isBefore(expiry, now)) {
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
          text: 'Expired',
          color: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30'
        };
      }

      if (isBefore(expiry, expiringThreshold)) {
        return {
          icon: <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />,
          text: `Expiring Soon (${format(expiry, 'PP')})`,
          color: 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30'
        };
      }
    }

    return {
      icon: <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />,
      text: 'Verified',
      color: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30'
    };
  };

  const getDocumentForType = (type: string): Document | undefined => {
    return documents.find(doc => doc.doc_type === type);
  };

  const getPendingDocumentForType = (type: string): File | undefined => {
    return uploadedFiles[type];
  };

  const hasPendingDocument = (type: string): boolean => {
    return !!uploadedFiles[type];
  };

  // File input ref for each document type
  const fileInputRefs: Record<string, React.RefObject<HTMLInputElement>> = {};
  DOCUMENT_TYPES.forEach(type => {
    fileInputRefs[type.value] = React.createRef<HTMLInputElement>();
  });

  const triggerFileInput = (docType: string) => {
    if (fileInputRefs[docType]?.current) {
      fileInputRefs[docType].current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFilePrepare(docType, file);
    }
  };

  // Error display component
  const ErrorDisplay = () => {
    if (!errorMessage) return null;
    
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md mb-6 border border-red-200 dark:border-red-800 flex items-start">
        <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
        <div>
          <p className="text-red-700 dark:text-red-300 font-medium">Error</p>
          <p className="text-red-600 dark:text-red-400 mt-1">{errorMessage}</p>
        </div>
      </div>
    );
  };

  // Determine if we should show the verification status bar
  const shouldShowVerificationSubmitButton = () => {
    // Don't show for verified drivers
    if (verificationStatus === 'verified') return false;
    
    // Don't show for pending verification
    if (verificationStatus === 'pending') return false;
    
    // Show in all other cases (unverified, declined, or null)
    return true;
  };

  // Calculate button status
  const getVerificationButtonStatus = () => {
    if (creatingDriverProfile || submittingForReview) {
      return {
        disabled: true,
        text: creatingDriverProfile ? "Creating Profile..." : "Submitting..."
      };
    }

    if (!hasAnyDocument && Object.keys(uploadedFiles).length === 0) {
      return {
        disabled: true,
        text: "Upload at least one document"
      };
    }
    
    return {
      disabled: false,
      text: verificationStatus === 'declined' ? "Resubmit for Verification" : "Submit for Verification"
    };
  };

  if (loading && driverId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold dark:text-white">Documents</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload and manage your required documents. All documents must be verified before you can accept trips.
        </p>
      </div>

      {/* Error Message Display */}
      <ErrorDisplay />

      {/* Submit for Verification Button - Always visible */}
      {shouldShowVerificationSubmitButton() && (
        <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {hasAnyDocument || Object.keys(uploadedFiles).length > 0 
              ? "Ready to Submit for Verification?" 
              : "Upload Documents for Verification"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-lg mx-auto">
            {hasAnyDocument || Object.keys(uploadedFiles).length > 0 
              ? "You can submit your documents for review now. At least one document is required."
              : "Upload at least one document below, then submit for verification to start accepting trips."}
          </p>
          
          <button
            onClick={submitForReview}
            disabled={getVerificationButtonStatus().disabled}
            className={`px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center ${
              getVerificationButtonStatus().disabled ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {creatingDriverProfile || submittingForReview ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                {getVerificationButtonStatus().text}
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                {getVerificationButtonStatus().text}
              </>
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DOCUMENT_TYPES.map((docType) => {
          const existingDoc = getDocumentForType(docType.value);
          const pendingDoc = getPendingDocumentForType(docType.value);
          const status = existingDoc ? getDocumentStatus(existingDoc) : null;
          const isPending = hasPendingDocument(docType.value);

          return (
            <div 
              key={docType.value}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700"
            >
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex justify-between items-center">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  {docType.label}
                  {docType.required && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                      Required
                    </span>
                  )}
                </h3>
              </div>
              
              <div className="p-6">
                {existingDoc ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${status?.color}`}>
                        {status?.icon}
                        <span className="ml-2">{status?.text}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <a 
                          href={existingDoc.file_url} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                          title="View Document"
                        >
                          <Eye className="h-5 w-5" />
                        </a>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span className="truncate max-w-[180px]">{existingDoc.name}</span>
                    </div>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Uploaded: {format(new Date(existingDoc.uploaded_at), 'PP')}
                    </div>
                    
                    {existingDoc.expiry_date && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Expires: {format(new Date(existingDoc.expiry_date), 'PP')}
                      </div>
                    )}
                    
                    <div className="pt-4 border-t dark:border-gray-700 mt-4 flex justify-between items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {existingDoc.verified ? 'Document verified' : 'Awaiting verification'}
                      </span>
                      
                      <div className="flex flex-col md:flex-row items-end md:items-center space-y-2 md:space-y-0 md:space-x-3">
                        {/* Document expiry date input field */}
                        {docType.value !== 'other' && (
                          <div className="flex flex-col items-start space-y-1">
                            <label htmlFor={`${docType.value}-expiry`} className="text-xs text-gray-500 dark:text-gray-400">
                              Expiry Date:
                            </label>
                            <input
                              type="date"
                              id={`${docType.value}-expiry`}
                              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                              onChange={(e) => setUploadExpiryDate(e.target.value)}
                            />
                          </div>
                        )}
                        
                        <input
                          type="file"
                          ref={fileInputRefs[docType.value]}
                          onChange={(e) => handleFileChange(e, docType.value)}
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.pdf"
                        />
                        <button
                          type="button"
                          onClick={() => triggerFileInput(docType.value)}
                          disabled={!!uploading}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center z-10"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {uploading === docType.value ? 'Uploading...' : 'Upload New'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isPending ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        <Clock className="h-5 w-5 mr-2" />
                        <span>Ready for Submission</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span className="truncate max-w-[180px]">{pendingDoc?.name}</span>
                    </div>
                    
                    {expiryDates[docType.value] && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Expires: {format(new Date(expiryDates[docType.value]), 'PP')}
                      </div>
                    )}
                    
                    <div className="flex items-center mt-2 pt-4 border-t dark:border-gray-700">
                      <a 
                        href={localDocumentUrls[docType.value]}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center"
                      >
                        <Eye className="w-4 h-4 mr-1" /> View Selected File
                      </a>

                      <button
                        onClick={() => {
                          // Remove the file from staged uploads
                          setUploadedFiles(prev => {
                            const newState = {...prev};
                            delete newState[docType.value];
                            return newState;
                          });
                          setLocalDocumentUrls(prev => {
                            const newState = {...prev};
                            delete newState[docType.value];
                            return newState;
                          });
                          setExpiryDates(prev => {
                            const newState = {...prev};
                            delete newState[docType.value];
                            return newState;
                          });
                        }}
                        className="ml-auto text-red-600 dark:text-red-400 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No document uploaded</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      {docType.required 
                        ? 'This document is required to accept trips.' 
                        : 'Upload this document if requested by admin.'}
                    </p>
                    
                    <div className="space-y-4">
                      {/* Document expiry date input field (not dropdown) */}
                      {docType.value !== 'other' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Document Expiry Date
                          </label>
                          <div className="flex items-center">
                            <input
                              type="date"
                              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white text-sm"
                              onChange={(e) => setUploadExpiryDate(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                      
                      <input
                        type="file"
                        ref={fileInputRefs[docType.value]}
                        onChange={(e) => handleFileChange(e, docType.value)}
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.pdf"
                      />
                      <button
                        type="button"
                        onClick={() => triggerFileInput(docType.value)}
                        disabled={uploading === docType.value}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-10"
                      >
                        {uploading === docType.value ? (
                          <>
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                            Selecting...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Select Document
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-sm border border-blue-100 dark:border-blue-800">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Document Requirements</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-400 list-disc list-inside space-y-1">
              <li>All documents must be current and not expired</li>
              <li>Files must be in JPG, PNG, or PDF format</li>
              <li>Maximum file size is 5MB</li>
              <li>Documents must be clearly legible</li>
              <li>All documents will be verified by our team before you can start accepting trips</li>
            </ul>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">
              For assistance, please <Link to="/partner/chat" className="underline">contact support</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDocuments;