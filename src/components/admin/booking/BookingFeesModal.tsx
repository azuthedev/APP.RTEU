import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, CreditCard, Plus, Trash2, Eye, EyeOff, DollarSign } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface CustomFee {
  id: string;
  name: string;
  amount: number;
  customer_visible: boolean;
}

interface Booking {
  id: string;
  booking_reference: string;
  customer_name: string;
  estimated_price: number;
  custom_fees?: CustomFee[];
}

interface BookingFeesModalProps {
  booking: Booking;
  onClose: () => void;
  onSave: (bookingId: string, fees: CustomFee[]) => void;
}

const BookingFeesModal: React.FC<BookingFeesModalProps> = ({
  booking,
  onClose,
  onSave
}) => {
  const [fees, setFees] = useState<CustomFee[]>(booking.custom_fees || []);
  const [saving, setSaving] = useState(false);

  // Calculate totals
  const basePrice = booking.estimated_price || 0;
  const feesTotal = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
  const grandTotal = basePrice + feesTotal;

  const handleAddFee = () => {
    setFees([
      ...fees,
      {
        id: uuidv4(),
        name: '',
        amount: 0,
        customer_visible: true
      }
    ]);
  };

  const handleRemoveFee = (id: string) => {
    setFees(fees.filter(fee => fee.id !== id));
  };

  const handleFeeChange = (id: string, field: keyof CustomFee, value: any) => {
    setFees(fees.map(fee => {
      if (fee.id === id) {
        return {
          ...fee,
          [field]: field === 'amount' ? parseFloat(value) || 0 : value
        };
      }
      return fee;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Filter out empty fees
      const validFees = fees.filter(fee => fee.name.trim() !== '');
      await onSave(booking.id, validFees);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Manage Custom Fees: {booking.booking_reference}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Base Trip Price
            </h4>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <span className="text-gray-700 dark:text-gray-300">Base fare</span>
              <span className="font-medium text-gray-900 dark:text-white">€{basePrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Custom Fees */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Fees & Charges
              </h4>
              <button
                type="button"
                onClick={handleAddFee}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Fee
              </button>
            </div>

            {fees.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No custom fees added yet. Click "Add Fee" to add extras, discounts, or special charges.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {fees.map((fee) => (
                  <div key={fee.id} className="flex flex-wrap md:flex-nowrap items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="flex-grow min-w-[200px]">
                      <input
                        type="text"
                        value={fee.name}
                        onChange={(e) => handleFeeChange(fee.id, 'name', e.target.value)}
                        placeholder="Fee name (e.g., Extra Luggage)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center w-full md:w-auto">
                      <div className="relative w-32">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="number"
                          value={fee.amount === 0 ? '' : fee.amount}
                          onChange={(e) => handleFeeChange(fee.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleFeeChange(fee.id, 'customer_visible', !fee.customer_visible)}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded"
                        title={fee.customer_visible ? "Visible to customer" : "Hidden from customer"}
                      >
                        {fee.customer_visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFee(fee.id)}
                        className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-md font-medium">
              <span className="text-gray-900 dark:text-white">Total Amount</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                €{grandTotal.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {fees.some(fee => !fee.customer_visible)
                ? "Some fees are marked as internal and won't be visible to customers"
                : "All fees are visible to customers"}
            </p>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-70"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Fees
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingFeesModal;