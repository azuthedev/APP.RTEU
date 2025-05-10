import React, { useState } from 'react';
import { Calculator, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '../../ui/use-toast';

interface SimulationResult {
  distance: number;
  basePrice: number;
  zoneMultiplier: number;
  finalPrice: number;
  breakdown: {
    description: string;
    amount: number;
  }[];
  isFixedRoute: boolean;
}

const PricingSimulator: React.FC = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const { toast } = useToast();

  const handleSimulate = async () => {
    if (!origin || !destination || !vehicleType) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all fields to simulate pricing"
      });
      return;
    }

    setLoading(true);
    try {
      // Call the pricing simulation edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          origin,
          destination,
          vehicleType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to simulate pricing');
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error simulating price:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to simulate pricing. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
      <h3 className="text-lg font-medium mb-4 flex items-center dark:text-white">
        <Calculator className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
        Price Simulator
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Origin
          </label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            placeholder="Enter origin location"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Destination
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            placeholder="Enter destination location"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Vehicle Type
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select vehicle type</option>
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="van">Van</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>

        <button
          onClick={handleSimulate}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Simulating...
            </>
          ) : (
            'Simulate Price'
          )}
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-lg mb-2 dark:text-white">
                Simulation Results
              </h4>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Distance:</span>
                  <span className="font-medium dark:text-white">{result.distance} km</span>
                </div>
                
                {result.isFixedRoute ? (
                  <div className="text-blue-600 dark:text-blue-400 font-medium">
                    Fixed route price applied
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Base Price:</span>
                      <span className="font-medium dark:text-white">€{result.basePrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Zone Multiplier:</span>
                      <span className="font-medium dark:text-white">x{result.zoneMultiplier}</span>
                    </div>
                  </>
                )}
                
                <div className="border-t dark:border-gray-600 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="dark:text-white">Final Price:</span>
                    <span className="text-green-600 dark:text-green-400">
                      €{result.finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h5 className="font-medium mb-2 dark:text-white">Price Breakdown</h5>
                <div className="space-y-1">
                  {result.breakdown.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{item.description}</span>
                      <span className="font-medium dark:text-white">€{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PricingSimulator;