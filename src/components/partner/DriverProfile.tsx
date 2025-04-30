import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User, 
  Phone, 
  Award, 
  Star, 
  MapPin, 
  AtSign, 
  Car, 
  Loader2, 
  Save, 
  AlertCircle, 
  Camera, 
  Upload, 
  PaintBucket,
  Pencil, 
  CheckCircle,
  X
} from 'lucide-react';

interface DriverData {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  created_at: string;
  license_number?: string;
  profile_image_url?: string;
  avg_rating?: number;
  total_trips?: number;
  completed_trips?: number;
  verification_status?: string;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: string | number;
    color: string;
    plate_number: string;
    capacity: number;
    vehicle_type?: string;
    license_expiry?: string;
    insurance_expiry?: string;
  } | null;
  user?: {
    name: string;
    email: string;
    phone: string;
  };
}

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV / Crossover' },
  { value: 'van', label: 'Van / Minivan' },
  { value: 'luxury', label: 'Luxury Sedan' },
  { value: 'wagon', label: 'Station Wagon' },
  { value: 'compact', label: 'Compact Car' }
];

const COLOR_PRESETS = [
  { value: 'black', label: 'Black', hex: '#000000' },
  { value: 'white', label: 'White', hex: '#ffffff' },
  { value: 'silver', label: 'Silver', hex: '#c0c0c0' },
  { value: 'gray', label: 'Gray', hex: '#808080' },
  { value: 'red', label: 'Red', hex: '#ff0000' },
  { value: 'blue', label: 'Blue', hex: '#0000ff' },
  { value: 'green', label: 'Green', hex: '#008000' },
  { value: 'beige', label: 'Beige', hex: '#f5f5dc' },
  { value: 'brown', label: 'Brown', hex: '#a52a2a' },
  { value: 'yellow', label: 'Yellow', hex: '#ffff00' }
];

const DriverProfile: React.FC = () => {
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
    vehicle_color: '',
    vehicle_type: '',
    vehicle_plate: '',
    vehicle_capacity: '',
    license_expiry: '',
    insurance_expiry: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { userData, refreshSession } = useAuth();

  useEffect(() => {
    fetchDriverData();
  }, [userData]);

  const fetchDriverData = async () => {
    try {
      setLoading(true);

      // Fetch driver data including vehicle and user info
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          vehicle:vehicles(id, make, model, year, color, plate_number, capacity, vehicle_type, license_expiry, insurance_expiry),
          user:users!drivers_user_id_fkey(name, email, phone)
        `)
        .eq('user_id', userData?.id)
        .single();

      if (error) throw error;

      setDriver(data);

      // Initialize form data with fetched data
      if (data) {
        setFormData({
          name: data.user?.name || '',
          email: data.user?.email || '',
          phone: data.user?.phone || '',
          license_number: data.license_number || '',
          vehicle_make: data.vehicle?.[0]?.make || '',
          vehicle_model: data.vehicle?.[0]?.model || '',
          vehicle_year: data.vehicle?.[0]?.year?.toString() || '',
          vehicle_color: data.vehicle?.[0]?.color || '',
          vehicle_type: data.vehicle?.[0]?.vehicle_type || '',
          vehicle_plate: data.vehicle?.[0]?.plate_number || '',
          vehicle_capacity: data.vehicle?.[0]?.capacity?.toString() || '',
          license_expiry: data.vehicle?.[0]?.license_expiry ? new Date(data.vehicle[0].license_expiry).toISOString().split('T')[0] : '',
          insurance_expiry: data.vehicle?.[0]?.insurance_expiry ? new Date(data.vehicle[0].insurance_expiry).toISOString().split('T')[0] : '',
        });
      }

    } catch (error: any) {
      console.error('Error fetching driver data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load your profile data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when the user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";

    // Only validate vehicle fields if vehicle exists or we're creating one
    if (driver?.vehicle || (!driver?.vehicle && (
      formData.vehicle_make || 
      formData.vehicle_model || 
      formData.vehicle_plate
    ))) {
      if (!formData.vehicle_make.trim()) newErrors.vehicle_make = "Make is required";
      if (!formData.vehicle_model.trim()) newErrors.vehicle_model = "Model is required";
      if (!formData.vehicle_plate.trim()) newErrors.vehicle_plate = "Plate number is required";
      
      // Optional but validate format if provided
      if (formData.license_expiry && !/^\d{4}-\d{2}-\d{2}$/.test(formData.license_expiry)) {
        newErrors.license_expiry = "Invalid date format (YYYY-MM-DD required)";
      }
      
      if (formData.insurance_expiry && !/^\d{4}-\d{2}-\d{2}$/.test(formData.insurance_expiry)) {
        newErrors.insurance_expiry = "Invalid date format (YYYY-MM-DD required)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please check the form for errors.",
      });
      return;
    }

    try {
      setSaving(true);

      // Update user information
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        })
        .eq('id', userData?.id);

      if (userError) throw userError;

      // Update driver information
      const { error: driverError } = await supabase
        .from('drivers')
        .update({
          license_number: formData.license_number,
        })
        .eq('id', driver?.id);

      if (driverError) throw driverError;

      // Create or update vehicle information
      if (formData.vehicle_make && formData.vehicle_model && formData.vehicle_plate) {
        const vehicleData = {
          driver_id: driver?.id,
          make: formData.vehicle_make,
          model: formData.vehicle_model,
          year: formData.vehicle_year,
          color: formData.vehicle_color,
          plate_number: formData.vehicle_plate,
          capacity: parseInt(formData.vehicle_capacity) || 4,
          vehicle_type: formData.vehicle_type,
          license_expiry: formData.license_expiry || null,
          insurance_expiry: formData.insurance_expiry || null
        };
        
        if (driver?.vehicle?.[0]?.id) {
          // Update existing vehicle
          const { error: vehicleError } = await supabase
            .from('vehicles')
            .update(vehicleData)
            .eq('id', driver.vehicle[0].id);

          if (vehicleError) throw vehicleError;
        } else {
          // Create new vehicle
          const { data: newVehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .insert(vehicleData)
            .select()
            .single();

          if (vehicleError) throw vehicleError;
          
          // Link vehicle to driver
          if (newVehicle) {
            const { error: linkError } = await supabase
              .from('drivers')
              .update({ vehicle_id: newVehicle.id })
              .eq('id', driver?.id);
              
            if (linkError) throw linkError;
          }
        }
      }

      // Refresh session to update JWT claims if email changed
      await refreshSession();

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });

      // Refresh driver data
      await fetchDriverData();
      
      // Exit edit mode
      setEditMode(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update your profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !driver?.id) return;

    try {
      setUploadingImage(true);
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image too large. Maximum size is 2MB.');
      }
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPG, PNG or WebP image.');
      }
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${driver.id}-profile-${Date.now()}.${fileExt}`;
      const filePath = `profile_images/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('driver_images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the public URL for the file
      const { data: { publicUrl } } = supabase.storage
        .from('driver_images')
        .getPublicUrl(filePath);

      // Update the driver record with the new profile image URL
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ profile_image_url: publicUrl })
        .eq('id', driver.id);

      if (updateError) throw updateError;

      // Update local state
      setDriver(prev => prev ? { ...prev, profile_image_url: publicUrl } : null);

      toast({
        title: "Success",
        description: "Profile image uploaded successfully.",
      });
    } catch (error: any) {
      console.error('Error uploading profile image:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to upload profile image.",
      });
      // Clear the preview
      setFilePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Driver Profile Not Found</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Your driver profile hasn't been set up yet. Please contact support for assistance.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold dark:text-white">Driver Profile</h1>
        
        {!editMode ? (
          <button
            onClick={() => setEditMode(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Edit Profile
          </button>
        ) : (
          <button
            onClick={() => {
              setEditMode(false);
              // Reset form data to match driver data
              if (driver) {
                setFormData({
                  name: driver.user?.name || '',
                  email: driver.user?.email || '',
                  phone: driver.user?.phone || '',
                  license_number: driver.license_number || '',
                  vehicle_make: driver.vehicle?.[0]?.make || '',
                  vehicle_model: driver.vehicle?.[0]?.model || '',
                  vehicle_year: driver.vehicle?.[0]?.year?.toString() || '',
                  vehicle_color: driver.vehicle?.[0]?.color || '',
                  vehicle_type: driver.vehicle?.[0]?.vehicle_type || '',
                  vehicle_plate: driver.vehicle?.[0]?.plate_number || '',
                  vehicle_capacity: driver.vehicle?.[0]?.capacity?.toString() || '',
                  license_expiry: driver.vehicle?.[0]?.license_expiry ? new Date(driver.vehicle[0].license_expiry).toISOString().split('T')[0] : '',
                  insurance_expiry: driver.vehicle?.[0]?.insurance_expiry ? new Date(driver.vehicle[0].insurance_expiry).toISOString().split('T')[0] : '',
                });
              }
            }}
            className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
            <div className="p-6 flex flex-col items-center">
              {/* Profile Image */}
              <div className="relative mb-4 group">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
                  {uploadingImage ? (
                    <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : filePreview ? (
                    <img 
                      src={filePreview} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : driver.profile_image_url ? (
                    <img 
                      src={driver.profile_image_url} 
                      alt={driver.user?.name || 'Driver'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                
                <button 
                  onClick={triggerFileInput}
                  className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white shadow-md hover:bg-blue-700 transition-colors"
                  title="Upload profile photo"
                >
                  <Camera className="h-4 w-4" />
                </button>
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
              </div>
              
              {/* Driver Name and Status */}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-2">
                {driver.user?.name || 'Driver'}
              </h2>
              
              {driver.verification_status && (
                <div className={`mt-1 px-2 py-1 text-xs font-medium rounded-full ${
                  driver.verification_status === 'verified' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                    : driver.verification_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {driver.verification_status === 'verified' 
                    ? 'Verified Driver' 
                    : driver.verification_status === 'pending'
                      ? 'Verification Pending'
                      : 'Unverified'}
                </div>
              )}
              
              <div className="flex items-center mt-3 text-gray-500 dark:text-gray-400">
                <AtSign className="w-4 h-4 mr-1" />
                <span className="text-sm">{driver.user?.email}</span>
              </div>
              
              {/* Driver Stats */}
              <div className="grid grid-cols-2 gap-4 w-full mt-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {driver.total_trips || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Trips</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                  <div className="flex items-center justify-center text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {driver.avg_rating ? driver.avg_rating.toFixed(1) : '-'}
                    {driver.avg_rating && <Star className="w-4 h-4 ml-1 text-yellow-500" />}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Rating</div>
                </div>
              </div>
              
              {/* Quick links */}
              <div className="w-full mt-6 space-y-2">
                <button
                  onClick={() => {/* Navigate to documents page */}}
                  className="w-full flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30"
                >
                  <span>Manage Documents</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => {/* Navigate to settings page */}}
                  className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <span>Account Settings</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Profile Details */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
            {!editMode ? (
              /* View Mode */
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <User className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      Personal Information
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                          <p className="text-base font-medium text-gray-900 dark:text-white">{driver.user?.name || 'N/A'}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Email Address</p>
                          <p className="text-base font-medium text-gray-900 dark:text-white">{driver.user?.email || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Phone Number</p>
                          <p className="text-base font-medium text-gray-900 dark:text-white">{driver.user?.phone || 'N/A'}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Driver License Number</p>
                          <p className="text-base font-medium text-gray-900 dark:text-white">{driver.license_number || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Vehicle Information */}
                  <div className="border-t dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <Car className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      Vehicle Information
                    </h3>
                    
                    {driver.vehicle?.[0] ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Vehicle</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {driver.vehicle[0].make} {driver.vehicle[0].model}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {driver.vehicle[0].year} · {driver.vehicle[0].vehicle_type || 'Not specified'}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Color</p>
                            <div className="flex items-center">
                              <div 
                                className="w-5 h-5 rounded-full mr-2 border border-gray-300 dark:border-gray-600"
                                style={{ 
                                  backgroundColor: COLOR_PRESETS.find(c => 
                                    c.value === driver.vehicle?.[0].color.toLowerCase())?.hex || driver.vehicle?.[0].color 
                                }}
                              />
                              <p className="text-base font-medium text-gray-900 dark:text-white capitalize">
                                {driver.vehicle[0].color}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">License Plate</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white">{driver.vehicle[0].plate_number}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Passenger Capacity</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white">{driver.vehicle[0].capacity} passengers</p>
                          </div>
                        </div>
                        
                        {/* Document expiry dates */}
                        {(driver.vehicle[0].license_expiry || driver.vehicle[0].insurance_expiry) && (
                          <div className="md:col-span-2 mt-2 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Document Expiry Dates</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {driver.vehicle[0].license_expiry && (
                                <div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Vehicle License Expiry</p>
                                  <p className="text-base font-medium text-gray-900 dark:text-white">
                                    {new Date(driver.vehicle[0].license_expiry).toLocaleDateString()}
                                  </p>
                                </div>
                              )}
                              
                              {driver.vehicle[0].insurance_expiry && (
                                <div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Insurance Expiry</p>
                                  <p className="text-base font-medium text-gray-900 dark:text-white">
                                    {new Date(driver.vehicle[0].insurance_expiry).toLocaleDateString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900/30">
                        <div className="flex items-center">
                          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3" />
                          <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            No vehicle information has been added to your profile yet. Edit your profile to add vehicle details.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <form onSubmit={handleSubmit} className="p-6">
                {/* Personal Information Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <User className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                    Personal Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Full Name*
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${
                          errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        required
                      />
                      {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address*
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${
                          errors.email ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        required
                      />
                      {errors.email && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone Number*
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${
                          errors.phone ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        required
                      />
                      {errors.phone && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.phone}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Driver License Number
                      </label>
                      <input
                        type="text"
                        name="license_number"
                        value={formData.license_number}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${
                          errors.license_number ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.license_number && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.license_number}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Vehicle Information Section */}
                <div className="border-t dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Car className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                    Vehicle Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Vehicle Make*
                      </label>
                      <input
                        type="text"
                        name="vehicle_make"
                        value={formData.vehicle_make}
                        onChange={handleChange}
                        placeholder="e.g., Toyota, BMW, Mercedes"
                        className={`w-full px-3 py-2 border ${
                          errors.vehicle_make ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.vehicle_make && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vehicle_make}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Vehicle Model*
                      </label>
                      <input
                        type="text"
                        name="vehicle_model"
                        value={formData.vehicle_model}
                        onChange={handleChange}
                        placeholder="e.g., Camry, 5 Series, E-Class"
                        className={`w-full px-3 py-2 border ${
                          errors.vehicle_model ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.vehicle_model && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vehicle_model}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Year
                      </label>
                      <input
                        type="number"
                        name="vehicle_year"
                        value={formData.vehicle_year}
                        onChange={handleChange}
                        placeholder="e.g., 2020"
                        min="1990"
                        max={new Date().getFullYear() + 1}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Vehicle Type
                      </label>
                      <select
                        name="vehicle_type"
                        value={formData.vehicle_type}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select vehicle type</option>
                        {VEHICLE_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Color
                      </label>
                      <div className="flex flex-col space-y-2">
                        <select
                          name="vehicle_color"
                          value={formData.vehicle_color}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select color</option>
                          {COLOR_PRESETS.map(color => (
                            <option key={color.value} value={color.value}>{color.label}</option>
                          ))}
                        </select>
                        
                        {/* Color swatches */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {COLOR_PRESETS.map(color => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, vehicle_color: color.value }))}
                              className={`w-6 h-6 rounded-full border ${
                                formData.vehicle_color === color.value
                                  ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-300 dark:ring-blue-700'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                              style={{ backgroundColor: color.hex }}
                              title={color.label}
                              aria-label={`Select ${color.label} color`}
                            ></button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        License Plate*
                      </label>
                      <input
                        type="text"
                        name="vehicle_plate"
                        value={formData.vehicle_plate}
                        onChange={handleChange}
                        placeholder="e.g., ABC123"
                        className={`w-full px-3 py-2 border ${
                          errors.vehicle_plate ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.vehicle_plate && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vehicle_plate}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Passenger Capacity
                      </label>
                      <input
                        type="number"
                        name="vehicle_capacity"
                        value={formData.vehicle_capacity}
                        onChange={handleChange}
                        min="1"
                        max="15"
                        placeholder="e.g., 4, 7"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  {/* Document Expiry Dates */}
                  <div className="mt-6 border-t dark:border-gray-700 pt-6">
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">Vehicle Document Expiry Dates</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Vehicle License Expiry Date
                        </label>
                        <input
                          type="date"
                          name="license_expiry"
                          value={formData.license_expiry}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 border ${
                            errors.license_expiry ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                          } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors.license_expiry && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.license_expiry}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Vehicle Insurance Expiry Date
                        </label>
                        <input
                          type="date"
                          name="insurance_expiry"
                          value={formData.insurance_expiry}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 border ${
                            errors.insurance_expiry ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                          } dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors.insurance_expiry && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.insurance_expiry}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 flex items-center"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverProfile;