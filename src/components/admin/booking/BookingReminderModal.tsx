import React, { useState } from 'react';
import { X, Save, Loader2, Bell, AlertCircle, Tag, Plus } from 'lucide-react';

interface Booking {
  id: string;
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  priority?: number;
  internal_tags?: string[];
}

interface BookingReminderModalProps {
  booking: Booking;
  onClose: () => void;
  onUpdatePriority: (bookingId: string, priority: number) => void;
  onSendReminder: (booking: Booking) => void;
}

const PRIORITY_LEVELS = [
  { value: 0, label: 'Normal', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  { value: 1, label: 'High', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 2, label: 'Urgent', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
];

const DEFAULT_TAGS = [
  'VIP', 'Wheelchair', 'Extra Luggage', 'Airport', 'Child Seat', 'Return Trip', 'Special Request'
];

const BookingReminderModal: React.FC<BookingReminderModalProps> = ({
  booking,
  onClose,
  onUpdatePriority,
  onSendReminder
}) => {
  const [priority, setPriority] = useState(booking.priority || 0);
  const [tags, setTags] = useState<string[]>(booking.internal_tags || []);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const handleUpdatePriority = async () => {
    setSaving(true);
    try {
      await onUpdatePriority(booking.id, priority);
    } finally {
      setSaving(false);
    }
  };

  const handleSendReminder = async () => {
    setSending(true);
    try {
      await onSendReminder(booking);
    } finally {
      setSending(false);
    }
  };

  const addTag = (tag: string) => {
    if (!tags.includes(tag) && tag.trim()) {
      setTags([...tags, tag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Priority & Tags: {booking.booking_reference}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Priority Section */}
          <div className="mb-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Set Booking Priority
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setPriority(level.value)}
                  className={`py-2 px-3 rounded-md text-center ${level.color} ${
                    priority === level.value ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400' : ''
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>

            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {priority === 2 && (
                <p className="text-red-600 dark:text-red-400">
                  Urgent bookings are highlighted in all views and trigger notifications.
                </p>
              )}
              {priority === 1 && (
                <p className="text-blue-600 dark:text-blue-400">
                  High priority bookings are highlighted and prioritized in default views.
                </p>
              )}
            </div>
          </div>

          {/* Tags Section */}
          <div className="mb-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <Tag className="h-4 w-4 mr-2" />
              Internal Tags
            </h4>
            
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <div 
                  key={tag} 
                  className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex items-center"
                >
                  <span className="text-sm text-gray-800 dark:text-gray-200">{tag}</span>
                  <button 
                    onClick={() => removeTag(tag)} 
                    className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {tags.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">No tags added</div>
              )}
            </div>
            
            <div className="flex mt-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag(newTag)}
                placeholder="Add a tag..."
                className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => addTag(newTag)}
                className="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Suggested tags:</p>
              <div className="flex flex-wrap gap-1">
                {DEFAULT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    disabled={tags.includes(tag)}
                    className={`text-xs px-2 py-1 rounded ${
                      tags.includes(tag)
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Send Reminder Section */}
          <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-900/30">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center">
              <Bell className="h-4 w-4 mr-2" />
              Send Customer Reminder
            </h4>
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
              Send a reminder email to the customer about this booking.
            </p>
            <button
              onClick={handleSendReminder}
              disabled={sending}
              className="w-full py-2 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Send Reminder to {booking.customer_name}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdatePriority}
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
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingReminderModal;