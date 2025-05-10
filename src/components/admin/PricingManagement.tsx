import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Car, 
  Map, 
  Route, 
  Plus, 
  Trash2, 
  Save,
  AlertTriangle,
  Loader2
} from 'lucide-react';

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

const PricingManagement: React.FC = () => {
  // State for data
  const [vehiclePrices, setVehiclePrices] = useState<VehicleBasePrice[]>([]);
  const [zoneMultipliers, setZoneMultipliers] = useState<ZoneMultiplier[]>([]);
  const [fixedRoutes, setFixedRoutes] = useState<FixedRoute[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string; }[]>([]);
  
  // State for loading and saving
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // State for confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Toast notifications
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch vehicle base prices
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicle_base_prices')
        .select('*')
        .order('vehicle_type');
        
      if (vehicleError) throw vehicleError;
      
      // Fetch zones
      const { data: zoneData, error: zoneError } = await supabase
        .from('zones')
        .select('id, name');
        
      if (zoneError) throw zoneError;
      
      // Fetch zone multipliers
      const { data: multiplierData, error: multiplierError } = await supabase
        .from('zone_multipliers')
        .select(`
          id,
          zone_id,
          multiplier,
          zones (
            name
          )
        `);
        
      if (multiplierError) throw multiplierError;
      
      // Fetch fixed routes
      const { data: routeData, error: routeError } = await supabase
        .from('fixed_routes')
        .select('*')
        .order('origin_name');
        
      if (routeError) throw routeError;
      
      setVehiclePrices(vehicleData || []);
      setZones(zoneData || []);
      setZoneMultipliers(multiplierData?.map(m => ({
        ...m,
        zone_name: m.zones?.name || 'Unknown Zone'
      })) || []);
      setFixedRoutes(routeData || []);
      
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
      
      // Save vehicle prices
      for (const price of vehiclePrices) {
        if (price.id.startsWith('new_')) {
          const { id, ...newPrice } = price;
          await supabase.from('vehicle_base_prices').insert(newPrice);
        } else {
          const { id, ...updatePrice } = price;
          await supabase.from('vehicle_base_prices')
            .update(updatePrice)
            .eq('id', id);
        }
      }
      
      // Save zone multipliers
      for (const multiplier of zoneMultipliers) {
        if (multiplier.id.startsWith('new_')) {
          const { id, zone_name, ...newMultiplier } = multiplier;
          await supabase.from('zone_multipliers').insert(newMultiplier);
        } else {
          const { id, zone_name, ...updateMultiplier } = multiplier;
          await supabase.from('zone_multipliers')
            .update(updateMultiplier)
            .eq('id', id);
        }
      }
      
      // Save fixed routes
      for (const route of fixedRoutes) {
        if (route.id.startsWith('new_')) {
          const { id, ...newRoute } = route;
          await supabase.from('fixed_routes').insert(newRoute);
        } else {
          const { id, ...updateRoute } = route;
          await supabase.from('fixed_routes')
            .update(updateRoute)
            .eq('id', id);
        }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold dark:text-white">Pricing Management</h2>
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

      {/* Vehicle Base Prices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Car className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-medium dark:text-white">Vehicle Base Prices</h3>
          </div>
          <Button onClick={addVehiclePrice} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
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
            <Map className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
            <h3 className="text-lg font-medium dark:text-white">Zone Multipliers</h3>
          </div>
          <Button onClick={addZoneMultiplier} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
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
            <Route className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-lg font-medium dark:text-white">Fixed Routes</h3>
          </div>
          <Button onClick={addFixedRoute} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
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