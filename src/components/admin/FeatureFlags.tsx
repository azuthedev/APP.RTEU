import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { 
  Loader2, 
  PlusCircle, 
  RefreshCw, 
  Flag, 
  Edit, 
  Trash2, 
  Save,
  X,
  AlertTriangle
} from 'lucide-react';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string | null;
  scope: 'global' | 'admin' | 'partner' | 'customer' | null;
}

interface FeatureFlagFormData {
  key: string;
  name: string;
  description: string;
  is_enabled: boolean;
  scope: 'global' | 'admin' | 'partner' | 'customer';
}

const FeatureFlags: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<FeatureFlagFormData>({
    key: '',
    name: '',
    description: '',
    is_enabled: false,
    scope: 'global'
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setRefreshing(true);
      
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setFlags(data || []);
    } catch (error: any) {
      console.error('Error fetching feature flags:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch feature flags.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleFlag = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ 
          is_enabled: !currentValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setFlags(flags.map(flag => 
        flag.id === id ? { ...flag, is_enabled: !currentValue } : flag
      ));
      
      toast({
        title: "Feature Flag Updated",
        description: `Flag has been ${!currentValue ? 'enabled' : 'disabled'}.`,
      });
    } catch (error: any) {
      console.error('Error toggling feature flag:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update feature flag.",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    }));
  };

  const validateForm = () => {
    let isValid = true;
    const errors = [];
    
    if (!formData.key) {
      errors.push('Key is required');
      isValid = false;
    } else if (!/^[a-z0-9_]+$/.test(formData.key)) {
      errors.push('Key must contain only lowercase letters, numbers, and underscores');
      isValid = false;
    }
    
    if (!formData.name) {
      errors.push('Name is required');
      isValid = false;
    }
    
    if (!formData.scope) {
      errors.push('Scope is required');
      isValid = false;
    }
    
    if (!isValid) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: errors.join('. '),
      });
    }
    
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      if (editingId) {
        // Update existing flag
        const { error } = await supabase
          .from('feature_flags')
          .update({
            name: formData.name,
            description: formData.description || null,
            is_enabled: formData.is_enabled,
            scope: formData.scope,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);
          
        if (error) throw error;
        
        // Update local state
        setFlags(flags.map(flag => 
          flag.id === editingId ? {
            ...flag,
            name: formData.name,
            description: formData.description || null,
            is_enabled: formData.is_enabled,
            scope: formData.scope,
            updated_at: new Date().toISOString()
          } : flag
        ));
        
        toast({
          title: "Feature Flag Updated",
          description: "The feature flag has been updated successfully.",
        });
      } else {
        // Check if key already exists
        const existingFlag = flags.find(flag => flag.key === formData.key);
        if (existingFlag) {
          throw new Error(`A feature flag with key '${formData.key}' already exists.`);
        }
        
        // Create new flag
        const { data, error } = await supabase
          .from('feature_flags')
          .insert({
            key: formData.key,
            name: formData.name,
            description: formData.description || null,
            is_enabled: formData.is_enabled,
            scope: formData.scope
          })
          .select()
          .single();
          
        if (error) throw error;
        
        // Update local state
        setFlags([data, ...flags]);
        
        toast({
          title: "Feature Flag Created",
          description: "The new feature flag has been created successfully.",
        });
      }
      
      // Reset form
      resetForm();
    } catch (error: any) {
      console.error('Error saving feature flag:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save feature flag.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (flag: FeatureFlag) => {
    setFormData({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      is_enabled: flag.is_enabled,
      scope: flag.scope || 'global'
    });
    setEditingId(flag.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setFlags(flags.filter(flag => flag.id !== id));
      
      toast({
        title: "Feature Flag Deleted",
        description: "The feature flag has been deleted successfully.",
      });
      
      setShowDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting feature flag:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete feature flag.",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      is_enabled: false,
      scope: 'global'
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const formatScope = (scope: string | null) => {
    if (!scope) return 'Global';
    return scope.charAt(0).toUpperCase() + scope.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold dark:text-white">Feature Flags</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Toggle features on and off without deploying code changes
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={fetchFlags}
            disabled={refreshing}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Add Flag
          </button>
        </div>
      </div>

      {/* New/Edit Feature Flag Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6 p-6 border dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {editingId ? 'Edit Feature Flag' : 'Create New Feature Flag'}
            </h3>
            <button
              onClick={resetForm}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key*
                </label>
                <input
                  type="text"
                  name="key"
                  value={formData.key}
                  onChange={handleInputChange}
                  disabled={!!editingId} // Can't edit key for existing flags
                  pattern="[a-z0-9_]+"
                  title="Only lowercase letters, numbers, and underscores"
                  placeholder="e.g. enable_feature_x"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Unique identifier for the feature flag (lowercase, no spaces)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name*
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Enable Feature X"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Human-readable name for the feature flag
                </p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="What does this feature flag control?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scope*
                </label>
                <select
                  name="scope"
                  value={formData.scope}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="global">Global (All users)</option>
                  <option value="admin">Admin Only</option>
                  <option value="partner">Partner Only</option>
                  <option value="customer">Customer Only</option>
                </select>
              </div>
              
              <div className="flex items-center mt-8">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_enabled"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  <span className="ms-3 text-sm font-medium text-gray-900 dark:text-white">Enabled</span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingId ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingId ? 'Update Flag' : 'Create Flag'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feature Flags Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <h3 className="font-medium text-gray-900 dark:text-white">Flags ({flags.length})</h3>
        </div>
        
        {flags.length === 0 ? (
          <div className="p-8 text-center">
            <Flag className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No feature flags yet</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              Feature flags let you toggle features on and off without deploying new code.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Your First Feature Flag
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Flag
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Key
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Scope
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {flags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 max-w-sm">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{flag.name}</div>
                      {flag.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{flag.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                        {flag.key}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        flag.scope === 'global' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : flag.scope === 'admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : flag.scope === 'partner'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {formatScope(flag.scope)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={flag.is_enabled}
                          onChange={() => handleToggleFlag(flag.id, flag.is_enabled)}
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                          {flag.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => startEditing(flag)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(flag.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="h-6 w-6 mr-2" />
              <h3 className="text-lg font-medium">Confirm Deletion</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this feature flag? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlags;