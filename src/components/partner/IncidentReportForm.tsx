import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, X, Loader2, MapPin } from 'lucide-react';

interface IncidentReportFormProps {
  tripId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const INCIDENT_TYPES = [
  { value: 'passenger_behavior', label: 'Passenger Behavior Issue' },
  { value: 'traffic_delay', label: 'Traffic Delay' },
  { value: 'vehicle_issue', label: 'Vehicle Issue' },
  { value: 'navigation_problem', label: 'Navigation Problem' },
  { value: 'weather_conditions', label: 'Weather Conditions' },
  { value: 'safety_concern', label: 'Safety Concern' },
  { value: 'other', label: 'Other' }
];

const IncidentReportForm: React.FC<IncidentReportFormProps> = ({ tripId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    incidentType: '',
    description: '',
    location: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [driverId, setDriverId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const { toast } = useToast();
  const { userData } = useAuth();

  useEffect(() => {
    fetchDriverId();
  }, [userData]);

  const fetchDriverId = async () => {
    try {
      if (!userData?.id) return;
      
      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userData.id)
        .single();
        
      if (error) throw error;
      setDriverId(data.id);
    } catch (error) {
      console.error('Error fetching driver ID:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setUseCurrentLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData(prev => ({
            ...prev,
            location: `Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}`
          }));
          setUseCurrentLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            variant: "destructive",
            title: "Location Error",
            description: "Unable to get your current location. Please enter it manually."
          });
          setUseCurrentLocation(false);
        }
      );
    } else {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: "Geolocation is not supported by your browser. Please enter location manually."
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.incidentType) {
      newErrors.incidentType = 'Please select an incident type';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Please provide a description of the incident';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description should be at least 10 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (!driverId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to identify driver profile. Please contact support."
      });
      return;
    }
    
    if (!tripId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No trip selected. Please try again."
      });
      return;
    }
    
    setSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('incident_reports')
        .insert({
          trip_id: tripId,
          driver_id: driverId,
          incident_type: formData.incidentType,
          description: formData.description,
          location: formData.location || null
        });
        
      if (error) throw error;
      
      toast({
        title: "Report Submitted",
        description: "Your incident report has been submitted successfully."
      });
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error submitting incident report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit incident report. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Report an Incident</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Incident Type*
              </label>
              <select
                name="incidentType"
                value={formData.incidentType}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.incidentType 
                    ? 'border-red-500 dark:border-red-400' 
                    : 'border-gray-300 dark:border-gray-600'
                } dark:bg-gray-700 dark:text-white`}
              >
                <option value="">Select incident type</option>
                {INCIDENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.incidentType && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.incidentType}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description*
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Please provide details about the incident..."
                rows={4}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.description 
                    ? 'border-red-500 dark:border-red-400' 
                    : 'border-gray-300 dark:border-gray-600'
                } dark:bg-gray-700 dark:text-white`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location (optional)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Enter location or use current location"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
                <button 
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={useCurrentLocation}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {useCurrentLocation ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MapPin className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 flex items-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Submitting...
                </>
              ) : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncidentReportForm;