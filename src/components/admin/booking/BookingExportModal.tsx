import React, { useState } from 'react';
import { X, FileDown, FileText, Calendar, Download, Loader2 } from 'lucide-react';

interface Booking {
  id: string;
  booking_reference: string;
  status: string;
  customer_name: string;
  datetime: string;
  // ... other booking fields
}

interface BookingExportModalProps {
  bookings: Booking[];
  onClose: () => void;
  onExport: (format: 'csv' | 'excel', filters: any) => void;
}

const BookingExportModal: React.FC<BookingExportModalProps> = ({
  bookings,
  onClose,
  onExport
}) => {
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');
  const [filters, setFilters] = useState({
    includeNotes: true,
    includeCustomerInfo: true,
    includePayments: true,
    includeFees: true,
    dateRange: 'all' // 'all', 'thisMonth', 'lastMonth', 'thisYear'
  });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport(format, filters);
      setTimeout(() => {
        onClose();
      }, 1000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <FileDown className="h-5 w-5 mr-2" />
            Export Bookings
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Export Format
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`py-3 px-4 flex flex-col items-center justify-center border rounded-md ${
                  format === 'csv' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <FileText className={`h-6 w-6 mb-2 ${
                  format === 'csv' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                }`} />
                <span className={format === 'csv' ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}>
                  CSV File
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`py-3 px-4 flex flex-col items-center justify-center border rounded-md ${
                  format === 'excel' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <FileText className={`h-6 w-6 mb-2 ${
                  format === 'excel' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                }`} />
                <span className={format === 'excel' ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}>
                  Excel File
                </span>
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Data to Include
            </h4>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeNotes"
                  checked={filters.includeNotes}
                  onChange={() => setFilters({...filters, includeNotes: !filters.includeNotes})}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeNotes" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Include admin notes
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeCustomerInfo"
                  checked={filters.includeCustomerInfo}
                  onChange={() => setFilters({...filters, includeCustomerInfo: !filters.includeCustomerInfo})}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeCustomerInfo" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Include customer details
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includePayments"
                  checked={filters.includePayments}
                  onChange={() => setFilters({...filters, includePayments: !filters.includePayments})}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includePayments" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Include payment details
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeFees"
                  checked={filters.includeFees}
                  onChange={() => setFilters({...filters, includeFees: !filters.includeFees})}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeFees" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Include custom fees
                </label>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Date Range
            </h4>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All dates</option>
              <option value="thisMonth">This month</option>
              <option value="lastMonth">Last month</option>
              <option value="thisYear">This year</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md flex items-start">
            <Calendar className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Export Preview</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Your export will include {bookings.length} bookings with the currently applied filters.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-70"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingExportModal;