import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  Loader2, 
  Search, 
  AlertTriangle,
  RefreshCw,
  Eye,
  Download,
  Filter
} from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { adminApi } from '../../lib/adminApi';

interface Driver {
  id: string;
  user_id: string;
  verification_status: 'unverified' | 'pending' | 'verified' | 'declined';
  is_available: boolean;
  verified_at: string | null;
  license_number: string | null;
  profile_image_url: string | null;
  _documentCount: number;
  _isPartnerWithoutProfile?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

interface Document {
  id: string;
  driver_id: string;
  doc_type: 'license' | 'insurance' | 'registration' | 'other';
  file_url: string;
  uploaded_at: string;
  verified: boolean;
  name: string;
  expiry_date: string | null;
}

interface ActivityLog {
  id: string;
  driver_id: string;
  admin_id: string;
  action: string;
  details: any;
  created_at: string;
  admin?: {
    name: string;
    email: string;
  };
}

const DriverVerification: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'unverified' | 'declined'>('all');
  
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Approval/decline states
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  
  const { toast } = useToast();
  const { userData } = useAuth();

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setRefreshing(true);
      
      // Call the edge function to fetch drivers with admin privileges
      const driversData = await adminApi.fetchDrivers();
      
      // Ensure driversData is an array before setting state
      if (Array.isArray(driversData)) {
        setDrivers(driversData);
      } else if (driversData && typeof driversData === 'object' && Array.isArray(driversData.data)) {
        // Handle if API returns an object with a data property
        setDrivers(driversData.data);
      } else {
        console.error('Unexpected response format from fetchDrivers API:', driversData);
        setDrivers([]); // Ensure drivers is set to an empty array
        toast({
          variant: "destructive",
          title: "Error",
          description: "Received invalid data format from the server. Please try again."
        });
      }
    } catch (error: any) {
      console.error('Error fetching drivers:', error);
      setDrivers([]); // Ensure drivers is set to an empty array on error
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch drivers. Please try again.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const viewDriverDetails = async (driver: Driver) => {
    setSelectedDriver(driver);
    setShowDetails(true);
    
    // Fetch driver documents
    fetchDriverDocuments(driver.id);
    
    // Fetch driver activity logs
    fetchDriverLogs(driver.id);
  };

  const fetchDriverDocuments = async (driverId: string) => {
    try {
      setLoadingDocuments(true);
      
      // Use the admin API to fetch documents
      const documentsData = await adminApi.fetchDriverDocuments(driverId);
      
      // Ensure documentsData is an array
      setDocuments(Array.isArray(documentsData) ? documentsData : []);
    } catch (error: any) {
      console.error('Error fetching driver documents:', error);
      setDocuments([]);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch driver documents.",
      });
    } finally {
      setLoadingDocuments(false);
    }
  };

  const fetchDriverLogs = async (driverId: string) => {
    try {
      setLoadingLogs(true);
      
      // Use the admin API to fetch activity logs
      const logsData = await adminApi.fetchDriverLogs(driverId);
      
      // Ensure logsData is an array
      setActivityLogs(Array.isArray(logsData) ? logsData : []);
    } catch (error: any) {
      console.error('Error fetching driver logs:', error);
      setActivityLogs([]);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch driver activity logs.",
      });
    } finally {
      setLoadingLogs(false);
    }
  };

  const approveDriver = async () => {
    if (!selectedDriver) return;
    
    try {
      setProcessingAction(true);
      
      // Call the admin API to approve the driver
      await adminApi.approveDriver(selectedDriver.id);
      
      // Update local state
      setDrivers(prevDrivers => 
        prevDrivers.map(driver => 
          driver.id === selectedDriver.id 
            ? { ...driver, verification_status: 'verified', verified_at: new Date().toISOString() }
            : driver
        )
      );
      
      // Update selected driver
      setSelectedDriver(prev => 
        prev ? { ...prev, verification_status: 'verified', verified_at: new Date().toISOString() } : null
      );
      
      // Also update documents to verified
      setDocuments(prevDocs => 
        prevDocs.map(doc => ({ ...doc, verified: true }))
      );
      
      toast({
        title: "Driver Approved",
        description: "Driver has been successfully verified.",
        variant: "success"
      });
      
      // Fetch updated logs
      fetchDriverLogs(selectedDriver.id);
    } catch (error: any) {
      console.error('Error approving driver:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to approve driver. Please try again.",
      });
    } finally {
      setProcessingAction(false);
      setShowApproveConfirm(false);
    }
  };

  const declineDriver = async () => {
    if (!selectedDriver || !declineReason) return;
    
    try {
      setProcessingAction(true);
      
      // Call the admin API to decline the driver
      await adminApi.declineDriver(selectedDriver.id, declineReason);
      
      // Update local state
      setDrivers(prevDrivers => 
        prevDrivers.map(driver => 
          driver.id === selectedDriver.id 
            ? { ...driver, verification_status: 'declined' }
            : driver
        )
      );
      
      // Update selected driver
      setSelectedDriver(prev => 
        prev ? { ...prev, verification_status: 'declined' } : null
      );
      
      toast({
        title: "Driver Declined",
        description: "Driver verification has been declined.",
      });
      
      // Fetch updated logs
      fetchDriverLogs(selectedDriver.id);
      
      // Reset
      setDeclineReason('');
    } catch (error: any) {
      console.error('Error declining driver:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to decline driver. Please try again.",
      });
    } finally {
      setProcessingAction(false);
      setShowDeclineConfirm(false);
    }
  };

  const toggleDriverAvailability = async (driver: Driver, newStatus: boolean) => {
    try {
      // Call the admin API to toggle driver availability
      await adminApi.toggleDriverAvailability(driver.id, newStatus);
      
      // Update local state
      setDrivers(prevDrivers => 
        prevDrivers.map(d => 
          d.id === driver.id ? { ...d, is_available: newStatus } : d
        )
      );
      
      // Update selected driver if applicable
      if (selectedDriver?.id === driver.id) {
        setSelectedDriver(prev => 
          prev ? { ...prev, is_available: newStatus } : null
        );
      }
      
      toast({
        title: newStatus ? "Driver Now Available" : "Driver Now Unavailable",
        description: `Driver has been set to ${newStatus ? "available" : "unavailable"} status.`
      });
      
    } catch (error: any) {
      console.error('Error toggling driver availability:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update driver availability.",
      });
    }
  };

  // Filter drivers based on search and status filter
  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = 
      driver.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (driver.user.phone && driver.user.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (driver.license_number && driver.license_number.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (driver.verification_status === statusFilter) ||
      (statusFilter === 'unverified' && driver._isPartnerWithoutProfile);
    
    return matchesSearch && matchesStatus;
  });

  // Format document name for display
  const formatDocumentType = (docType: string) => {
    switch (docType) {
      case 'license': return 'Driver License';
      case 'insurance': return 'Insurance Certificate';
      case 'registration': return 'Vehicle Registration';
      case 'other': return 'Other Document';
      default: return docType;
    }
  };

  // Check if document is expired
  const isDocumentExpired = (document: Document): boolean => {
    if (!document.expiry_date) return false;
    
    const expiryDate = parseISO(document.expiry_date);
    const today = new Date();
    
    return isAfter(today, expiryDate);
  };

  if (loading && !drivers.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold dark:text-white">Driver Verification</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Review and approve driver documents and verification requests
          </p>
        </div>

        <div className="flex space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="declined">Declined</option>
          </select>

          <button
            onClick={() => fetchDrivers()}
            disabled={refreshing}
            className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Drivers grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {filteredDrivers.length > 0 ? (
          filteredDrivers.map(driver => (
            <div 
              key={driver.id}
              className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => viewDriverDetails(driver)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      {driver.profile_image_url ? (
                        <img 
                          src={driver.profile_image_url} 
                          alt={driver.user.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <Users className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">{driver.user.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{driver.user.email}</p>
                    </div>
                  </div>
                  
                  <div className={`px-2 py-1 text-xs rounded-full ${
                    driver._isPartnerWithoutProfile ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                    driver.verification_status === 'verified' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                    driver.verification_status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                    driver.verification_status === 'declined' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {driver._isPartnerWithoutProfile 
                      ? 'No Profile' 
                      : driver.verification_status.charAt(0).toUpperCase() + driver.verification_status.slice(1)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {driver._isPartnerWithoutProfile 
                      ? `Partner Since: ${format(parseISO(driver.created_at), 'PP')}` 
                      : `Documents: ${driver._documentCount || 0} uploaded`}
                  </div>
                  
                  {driver.verification_status === 'verified' && (
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      driver.is_available 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {driver.is_available ? 'Available' : 'Unavailable'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg p-6 border dark:border-gray-700 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full">
                <Filter className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No drivers found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'No drivers have registered yet'}
            </p>
          </div>
        )}
      </div>

      {/* Driver Details Modal */}
      {showDetails && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full">
            {/* Header */}
            <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Driver Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Driver Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-1">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-center mb-4">
                      {selectedDriver.profile_image_url ? (
                        <img 
                          src={selectedDriver.profile_image_url} 
                          alt={selectedDriver.user.name}
                          className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-600"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <Users className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                    </div>
                    
                    <h4 className="text-center text-lg font-medium text-gray-900 dark:text-white mb-1">
                      {selectedDriver.user.name}
                    </h4>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {selectedDriver.user.email}
                    </p>
                    
                    <div className="flex justify-center mb-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selectedDriver.verification_status === 'verified' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                          : selectedDriver.verification_status === 'pending' 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' 
                            : selectedDriver.verification_status === 'declined' 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {selectedDriver.verification_status.charAt(0).toUpperCase() + selectedDriver.verification_status.slice(1)}
                      </span>
                    </div>
                    
                    {selectedDriver.verification_status === 'verified' && (
                      <div className="text-center mb-4">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                          selectedDriver.is_available 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {selectedDriver.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    )}
                    
                    {selectedDriver.verification_status === 'verified' && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => toggleDriverAvailability(
                            selectedDriver, 
                            !selectedDriver.is_available
                          )}
                          className={`px-4 py-2 text-sm rounded-md ${
                            selectedDriver.is_available
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              : 'bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600'
                          }`}
                        >
                          {selectedDriver.is_available ? 'Set Unavailable' : 'Set Available'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Contact Info */}
                  <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Contact Information</h4>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Email Address</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{selectedDriver.user.email}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Phone Number</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedDriver.user.phone || 'Not provided'}
                        </p>
                      </div>
                      
                      {selectedDriver.license_number && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">License Number</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedDriver.license_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  {/* Driver Documents */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Document Verification</h4>
                    
                    {loadingDocuments ? (
                      <div className="py-4 flex justify-center">
                        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                      </div>
                    ) : documents.length === 0 ? (
                      selectedDriver._isPartnerWithoutProfile ? (
                        <div className="py-4 text-center">
                          <AlertTriangle className="h-8 w-8 text-yellow-500 dark:text-yellow-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Partner Account without Driver Profile</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            This user has a partner account but hasn't created a driver profile or uploaded any documents yet.
                          </p>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 dark:text-gray-300">No documents uploaded yet</p>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        {documents.map(document => (
                          <div 
                            key={document.id} 
                            className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-100 dark:border-gray-600"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formatDocumentType(document.doc_type)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Uploaded: {format(parseISO(document.uploaded_at), 'PPp')}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {document.verified ? (
                                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full flex items-center">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Unverified
                                  </span>
                                )}
                                
                                <a
                                  href={document.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                                  title="View Document"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                                
                                <a
                                  href={document.file_url}
                                  download
                                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                                  title="Download Document"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                            
                            {/* Display expiry date if available */}
                            {document.expiry_date && (
                              <div className={`mt-2 text-xs p-1 rounded ${
                                isDocumentExpired(document)
                                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              }`}>
                                <span className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Expires: {format(parseISO(document.expiry_date), 'PP')}
                                  {isDocumentExpired(document) && (
                                    <span className="ml-2 font-medium">EXPIRED</span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Activity Logs */}
                  <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Activity History</h4>
                    
                    {loadingLogs ? (
                      <div className="py-4 flex justify-center">
                        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                      </div>
                    ) : activityLogs.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No activity logs found
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                        {activityLogs.map(log => (
                          <div key={log.id} className="text-sm bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-600">
                            <div className="flex items-start">
                              <div className="flex-grow">
                                <p className="text-gray-900 dark:text-white">
                                  {log.action.replace(/_/g, ' ')}
                                  {log.admin && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                      by {log.admin.name}
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {format(parseISO(log.created_at), 'PPp')}
                                </p>
                                {log.details && log.details.reason && (
                                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 bg-gray-50 dark:bg-gray-700 p-1 rounded">
                                    Reason: {log.details.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Verification Actions */}
                  {!selectedDriver._isPartnerWithoutProfile && documents.length > 0 && selectedDriver.verification_status !== 'verified' && (
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        onClick={() => setShowDeclineConfirm(true)}
                        className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Decline Verification
                      </button>
                      
                      <button
                        onClick={() => setShowApproveConfirm(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Approve Driver
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveConfirm && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Confirm Driver Approval</h3>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to approve <span className="font-medium">{selectedDriver.user.name}</span> as a verified driver?
                They will be able to accept trips once approved.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  disabled={processingAction}
                >
                  Cancel
                </button>
                
                <button
                  onClick={approveDriver}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                  disabled={processingAction}
                >
                  {processingAction ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Driver
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decline Confirmation Modal */}
      {showDeclineConfirm && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Decline Verification</h3>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Please provide a reason for declining <span className="font-medium">{selectedDriver.user.name}</span>'s verification request:
              </p>
              
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter reason for declining verification..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                rows={3}
                required
              ></textarea>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowDeclineConfirm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  disabled={processingAction}
                >
                  Cancel
                </button>
                
                <button
                  onClick={declineDriver}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
                  disabled={processingAction || !declineReason.trim()}
                >
                  {processingAction ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline Verification
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverVerification;
