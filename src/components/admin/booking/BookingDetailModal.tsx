import React from 'react';
import { X, Car, User, Calendar, MapPin, CreditCard, Clock, MessageSquare, Copy, History, Plus, Tag, Bell } from 'lucide-react';
import { format } from 'date-fns';

interface Booking {
  id: string;
  booking_reference: string;
  datetime: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  pickup_address?: string;
  dropoff_address?: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  estimated_price: number;
  notes?: string;
  priority?: number;
  custom_fees?: {
    id: string;
    name: string;
    amount: number;
    customer_visible: boolean;
  }[];
  driver?: {
    name: string;
    email: string;
    phone?: string;
  };
  pickup_zone?: {
    name: string;
  };
  dropoff_zone?: {
    name: string;
  };
  payments?: {
    id: string;
    amount: number;
    status: string;
    payment_method: string;
    paid_at?: string;
  }[];
}

interface BookingDetailModalProps {
  booking: Booking;
  onClose: () => void;
  onStatusChange: (bookingId: string, status: string) => void;
  onAssignDriver: () => void;
  onEditNotes: () => void;
  onViewLogs: () => void;
  onDuplicate: () => void;
  onManageFees: () => void;
  onManagePriority: () => void;
}

const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  onClose,
  onStatusChange,
  onAssignDriver,
  onEditNotes,
  onViewLogs,
  onDuplicate,
  onManageFees,
  onManagePriority
}) => {
  // Calculate total amount including custom fees
  const customFeesTotal = (booking.custom_fees || []).reduce((sum, fee) => sum + fee.amount, 0);
  const totalAmount = (booking.estimated_price || 0) + customFeesTotal;

  // Format priority level
  const getPriorityLabel = (priority?: number) => {
    switch (priority) {
      case 2: return { label: 'Urgent', color: 'text-red-600 dark:text-red-400' };
      case 1: return { label: 'High', color: 'text-blue-600 dark:text-blue-400' };
      default: return { label: 'Normal', color: 'text-gray-600 dark:text-gray-400' };
    }
  };
  
  const priority = getPriorityLabel(booking.priority);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <span className="mr-2">Booking Details:</span>
            <span className="font-mono">{booking.booking_reference}</span>
            {booking.priority === 2 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                URGENT
              </span>
            )}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer & Booking Info */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Customer Information
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium dark:text-white">{booking.customer_name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{booking.customer_email}</div>
                    {booking.customer_phone && (
                      <div className="text-sm text-gray-600 dark:text-gray-300">{booking.customer_phone}</div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Trip Details
                </h4>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="min-w-[100px] text-sm text-gray-500 dark:text-gray-400">Date & Time:</div>
                    <div className="font-medium dark:text-white">{format(new Date(booking.datetime), 'PPpp')}</div>
                  </div>
                  <div className="flex items-start">
                    <div className="min-w-[100px] text-sm text-gray-500 dark:text-gray-400">Pickup:</div>
                    <div>
                      <div className="font-medium dark:text-white">
                        {booking.pickup_zone?.name || 'Unknown zone'}
                      </div>
                      {booking.pickup_address && (
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {booking.pickup_address}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="min-w-[100px] text-sm text-gray-500 dark:text-gray-400">Dropoff:</div>
                    <div>
                      <div className="font-medium dark:text-white">
                        {booking.dropoff_zone?.name || 'Unknown zone'}
                      </div>
                      {booking.dropoff_address && (
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {booking.dropoff_address}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="min-w-[100px] text-sm text-gray-500 dark:text-gray-400">Status:</div>
                    <div>
                      <select
                        value={booking.status}
                        onChange={(e) => onStatusChange(booking.id, e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="min-w-[100px] text-sm text-gray-500 dark:text-gray-400">Priority:</div>
                    <div className={`font-medium ${priority.color}`}>
                      {priority.label}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="min-w-[100px] text-sm text-gray-500 dark:text-gray-400">Driver:</div>
                    <div>
                      {booking.driver ? (
                        <div>
                          <div className="font-medium dark:text-white">{booking.driver.name}</div>
                          {booking.driver.phone && (
                            <div className="text-sm text-gray-600 dark:text-gray-300">{booking.driver.phone}</div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={onAssignDriver}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Assign Driver
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Admin Notes
                  </h4>
                  <button
                    onClick={onEditNotes}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Edit Notes
                  </button>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 min-h-[100px]">
                  {booking.notes ? (
                    <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{booking.notes}</p>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">No notes added yet. Click 'Edit Notes' to add notes.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment & Action Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment Information
                </h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Base price:</span>
                    <span className="font-medium dark:text-white">€{(booking.estimated_price || 0).toFixed(2)}</span>
                  </div>

                  {/* Custom Fees */}
                  {booking.custom_fees && booking.custom_fees.length > 0 && (
                    <>
                      {booking.custom_fees.map((fee, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            {fee.name}
                            {!fee.customer_visible && <span className="text-xs ml-1">(internal)</span>}:
                          </span>
                          <span className="font-medium dark:text-white">€{fee.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                    </>
                  )}
                  
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
                    <span className="font-bold dark:text-white">€{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <button
                    onClick={onManageFees}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Manage Custom Fees
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Quick Actions
                </h4>
                <div className="space-y-2">
                  {!booking.driver && (
                    <button
                      onClick={onAssignDriver}
                      className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    >
                      <span className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        Assign Driver
                      </span>
                      <span>→</span>
                    </button>
                  )}
                  <button
                    onClick={onManagePriority}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <span className="flex items-center">
                      <Tag className="h-4 w-4 mr-2" />
                      Set Priority/Tags
                    </span>
                    <span>→</span>
                  </button>
                  <button
                    onClick={onViewLogs}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <span className="flex items-center">
                      <History className="h-4 w-4 mr-2" />
                      View Activity Log
                    </span>
                    <span>→</span>
                  </button>
                  <button
                    onClick={onDuplicate}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <span className="flex items-center">
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate Booking
                    </span>
                    <span>→</span>
                  </button>
                  <button
                    onClick={onEditNotes}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <span className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add/Edit Notes
                    </span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailModal;