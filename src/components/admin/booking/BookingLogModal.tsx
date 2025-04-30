import React from 'react';
import { X, Search, Clock, Users, Car, Tag, MessageSquare, CreditCard, Copy, CalendarPlus, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ActivityLog {
  id: string;
  booking_id: string;
  user_id: string;
  action: string;
  details: any;
  created_at: string;
  user?: {
    name: string;
  };
}

interface Booking {
  id: string;
  booking_reference: string;
  customer_name: string;
}

interface BookingLogModalProps {
  booking: Booking;
  logs: ActivityLog[];
  onClose: () => void;
}

const BookingLogModal: React.FC<BookingLogModalProps> = ({
  booking,
  logs,
  onClose
}) => {
  // Function to get appropriate icon for action type
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <CalendarPlus className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case 'status_update':
        return <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
      case 'driver_assignment':
        return <Car className="h-4 w-4 text-purple-500 dark:text-purple-400" />;
      case 'notes_updated':
        return <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      case 'fees_updated':
        return <CreditCard className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case 'priority_changed':
        return <Tag className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
      case 'booking_duplicated':
        return <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      case 'reminder_sent':
        return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  // Function to format action text
  const formatAction = (log: ActivityLog) => {
    const { action, details } = log;
    const userName = log.user?.name || 'Unknown user';
    
    switch (action) {
      case 'created':
        return `Booking created by ${userName}`;
      
      case 'status_update':
        if (details?.previous_status && details?.new_status) {
          return `Status changed from "${details.previous_status}" to "${details.new_status}" by ${userName}`;
        }
        return `Status updated by ${userName}`;
      
      case 'driver_assignment':
        return `Driver assigned by ${userName}`;
      
      case 'notes_updated':
        return `Notes updated by ${userName}`;
      
      case 'fees_updated':
        if (details?.fees_count) {
          return `${details.fees_count} custom fee(s) updated by ${userName}`;
        }
        return `Custom fees updated by ${userName}`;
      
      case 'priority_changed':
        if (details?.previous_priority !== undefined && details?.new_priority !== undefined) {
          const getPriorityName = (p: number) => p === 2 ? 'Urgent' : p === 1 ? 'High' : 'Normal';
          return `Priority changed from "${getPriorityName(details.previous_priority)}" to "${getPriorityName(details.new_priority)}" by ${userName}`;
        }
        return `Priority updated by ${userName}`;
      
      case 'booking_duplicated':
        if (details?.new_booking_reference) {
          return `Booking duplicated by ${userName} as ${details.new_booking_reference}`;
        }
        return `Booking duplicated by ${userName}`;
      
      case 'reminder_sent':
        return `Reminder sent to customer by ${userName}`;
      
      default:
        return `${action.replace(/_/g, ' ')} by ${userName}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Activity Log: {booking.booking_reference}
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
              Activity history for {booking.customer_name}'s booking
            </h4>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Filter activity..."
                className="pl-9 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              />
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No activity logs found for this booking.
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {logs.map((log) => (
                <div 
                  key={log.id}
                  className="flex p-3 border border-gray-100 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex-shrink-0 mt-1 mr-3">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-grow">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatAction(log)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {format(parseISO(log.created_at), 'PPp')}
                    </div>
                    
                    {/* Show additional details for certain action types */}
                    {log.action === 'fees_updated' && log.details?.fees_total !== undefined && (
                      <div className="mt-2 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300 rounded">
                        Total fees amount: €{log.details.fees_total.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-between items-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Showing {logs.length} activity log entries
          </div>
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

export default BookingLogModal;