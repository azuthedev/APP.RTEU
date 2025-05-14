import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2, PlusCircle, Trash2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '../../ui/use-toast';
import PricingSimulator from './PricingSimulator';
import PricingChangeLogs from './PricingChangeLogs';
import { adminApi } from '../../../lib/adminApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

interface VehicleBasePrice {
  id: string;
  vehicle_type: string;
  base_price_per_km: number;
}

interface ZoneMultiplier {
  id: string;
  zone_id: string;
  zone_name: string;
  multiplier: number;
}

interface FixedRoute {
  id: string;
  origin_name: string;
  destination_name: string;
  vehicle_type: string;
  fixed_price: number;
}

interface Zone {
  id: string;
  name: string;
}

const PricingManagement: React.FC = () => {
  // State for data
  const [vehiclePrices, setVehiclePrices] = useState<VehicleBasePrice[]>([]);
  const [zoneMultipliers, setZoneMultipliers] = useState<ZoneMultiplier[]>([]);
  const [fixedRoutes, setFixedRoutes] = useState<FixedRoute[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  
  // State for loading and saving
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('tables');
  
  // State for confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Toast notifications
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all pricing data using edge function
      const pricingData = await adminApi.fetchPricingData();
      
      if (!pricingData) {
        throw new Error('Failed to fetch pricing data');
      }
      
      // Update state with fetched data
      setVehiclePrices(pricingData.vehiclePrices || []);
      setZoneMultipliers(pricingData.zoneMultipliers || []);
      setFixedRoutes(pricingData.fixedRoutes || []);
      
      // Fetch zones list
      // Note: Zones are used for dropdowns when selecting zone_id
      const zonesQuery = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/get_zones_list`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': `${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({})
        }
      );
      
      const zonesData = await zonesQuery.json();
      setZones(zonesData || []);
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load pricing data"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      await adminApi.refreshPricingCache();
      
      toast({
        title: "Success",
        description: "Pricing cache refreshed successfully"
      });
    } catch (error) {
      console.error('Error refreshing cache:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh pricing cache"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Add new vehicle price
  const addVehiclePrice = () => {
    setVehiclePrices(prev => [...prev, {
      id: 'new_' + Date.now(),
      vehicle_type: '',
      base_price_per_km: 0
    }]);
    setHasChanges(true);
  };

  // Add new zone multiplier
  const addZoneMultiplier = () => {
    if (zones.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No zones available. Please create zones first."
      });
      return;
    }
    
    setZoneMultipliers(prev => [...prev, {
      id: 'new_' + Date.now(),
      zone_id: zones[0].id,
      zone_name: zones[0].name,
      multiplier: 1.0
    }]);
    setHasChanges(true);
  };

  // Add new fixed route
  const addFixedRoute = () => {
    if (vehiclePrices.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add vehicle types first"
      });
      return;
    }
    
    setFixedRoutes(prev => [...prev, {
      id: 'new_' + Date.now(),
      origin_name: '',
      destination_name: '',
      vehicle_type: vehiclePrices[0].vehicle_type,
      fixed_price: 0
    }]);
    setHasChanges(true);
  };

  // Delete handlers
  const deleteVehiclePrice = (id: string) => {
    setVehiclePrices(prev => prev.filter(p => p.id !== id));
    setHasChanges(true);
  };

  const deleteZoneMultiplier = (id: string) => {
    setZoneMultipliers(prev => prev.filter(m => m.id !== id));
    setHasChanges(true);
  };

  const deleteFixedRoute = (id: string) => {
    setFixedRoutes(prev => prev.filter(r => r.id !== id));
    setHasChanges(true);
  };

  // Update handlers
  const updateVehiclePrice = (id: string, field: keyof VehicleBasePrice, value: any) => {
    setVehiclePrices(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
    setHasChanges(true);
  };

  const updateZoneMultiplier = (id: string, field: string, value: any) => {
    setZoneMultipliers(prev => prev.map(m => {
      if (m.id === id) {
        if (field === 'zone_id') {
          const zone = zones.find(z => z.id === value);
          return {
            ...m,
            zone_id: value,
            zone_name: zone?.name || 'Unknown Zone'
          };
        }
        return { ...m, [field]: value };
      }
      return m;
    }));
    setHasChanges(true);
  };

  const updateFixedRoute = (id: string, field: keyof FixedRoute, value: any) => {
    setFixedRoutes(prev => prev.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
    setHasChanges(true);
  };

  // Save all changes
  const saveChanges = async () => {
    try {
      setSaving(true);
      
      // Use the edge function to save all pricing data
      const result = await adminApi.updatePricingData({
        vehiclePrices,
        zoneMultipliers,
        fixedRoutes
      });
      
      if (!result || result.error) {
        throw new Error(result?.error || 'Failed to save changes');
      }
      
      toast({
        title: "Success",
        description: "Pricing changes saved successfully"
      });
      
      // Refresh data
      await fetchData();
      setHasChanges(false);
      setShowConfirmation(false);
      
    } catch (error: any) {
      console.error('Error saving changes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save changes"
      });
    } finally {
      setSaving(false);
    }
  };

  const renderPricingTables = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Vehicle Base Prices */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <h3 className="text-lg font-medium dark:text-white">Vehicle Base Prices</h3>
            </div>
            <Button onClick={addVehiclePrice} variant="outline" size="sm">
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle Type</TableHead>
                <TableHead>Base Price per KM</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehiclePrices.map(price => (
                <TableRow key={price.id}>
                  <TableCell>
                    <Input
                      value={price.vehicle_type}
                      onChange={e => updateVehiclePrice(price.id, 'vehicle_type', e.target.value)}
                      placeholder="e.g., Sedan"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={price.base_price_per_km}
                      onChange={e => updateVehiclePrice(price.id, 'base_price_per_km', parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteVehiclePrice(price.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Zone Multipliers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <h3 className="text-lg font-medium dark:text-white">Zone Multipliers</h3>
            </div>
            <Button onClick={addZoneMultiplier} variant="outline" size="sm">
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Multiplier
            </Button>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zoneMultipliers.map(multiplier => (
                <TableRow key={multiplier.id}>
                  <TableCell>
                    <select
                      value={multiplier.zone_id}
                      onChange={e => updateZoneMultiplier(multiplier.id, 'zone_id', e.target.value)}
                      className="w-full px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {zones.map(zone => (
                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={multiplier.multiplier}
                      onChange={e => updateZoneMultiplier(multiplier.id, 'multiplier', parseFloat(e.target.value))}
                      min="0.1"
                      step="0.1"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteZoneMultiplier(multiplier.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Fixed Routes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <h3 className="text-lg font-medium dark:text-white">Fixed Routes</h3>
            </div>
            <Button onClick={addFixedRoute} variant="outline" size="sm">
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Route
            </Button>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Vehicle Type</TableHead>
                <TableHead>Fixed Price</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fixedRoutes.map(route => (
                <TableRow key={route.id}>
                  <TableCell>
                    <Input
                      value={route.origin_name}
                      onChange={e => updateFixedRoute(route.id, 'origin_name', e.target.value)}
                      placeholder="e.g., Airport"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={route.destination_name}
                      onChange={e => updateFixedRoute(route.id, 'destination_name', e.target.value)}
                      placeholder="e.g., City Center"
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={route.vehicle_type}
                      onChange={e => updateFixedRoute(route.id, 'vehicle_type', e.target.value)}
                      className="w-full px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {vehiclePrices.map(vehicle => (
                        <option key={vehicle.id} value={vehicle.vehicle_type}>
                          {vehicle.vehicle_type}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={route.fixed_price}
                      onChange={e => updateFixedRoute(route.id, 'fixed_price', parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFixedRoute(route.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold dark:text-white">Pricing Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleRefreshCache}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Force Refresh Cache
              </>
            )}
          </button>
          
          {hasChanges && (
            <Button
              onClick={() => setShowConfirmation(true)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
          <li className="mr-2">
            <button
              className={`inline-block p-4 border-b-2 rounded-t-lg ${
                activeTab === 'tables' 
                  ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-500' 
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('tables')}
            >
              Pricing Tables
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 border-b-2 rounded-t-lg ${
                activeTab === 'tools' 
                  ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-500' 
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('tools')}
            >
              Pricing Tools
            </button>
          </li>
        </ul>
      </div>

      {/* Tab Content */}
      {activeTab === 'tables' ? (
        renderPricingTables()
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PricingSimulator />
          <PricingChangeLogs />
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
              Confirm Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these pricing changes? This will affect all future bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveChanges} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : 'Save Changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PricingManagement;