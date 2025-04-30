import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, MessageSquare } from 'lucide-react';

interface Booking {
  id: string;
  booking_reference: string;
  notes?: string;
  customer_name: string;
}

interface BookingNoteModalProps {
  booking: Booking;
  onClose: () => void;
  onSave: (bookingId: string, notes: string) => void;
}

const BookingNoteModal: React.FC<BookingNoteModalProps> = ({
  booking,
  onClose,
  onSave
}) => {
  const [notes, setNotes] = useState(booking.notes || '');
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [autoSaving, setAutoSaving] = useState(false);

  // Auto-save timer (simulated)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setAutoSaving(true);
          // Simulate autosave
          setTimeout(() => {
            setAutoSaving(false);
            return 60;
          }, 1000);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(booking.id, notes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Admin Notes for: {booking.booking_reference}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes for {booking.customer_name}'s trip
              </h4>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              {autoSaving ? (
                <span className="text-green-600 dark:text-green-400 flex items-center">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Autosaving...
                </span>
              ) : (
                <>Autosaves in {countdown}s</>
              )}
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add private notes about this booking. These notes are only visible to administrators."
          ></textarea>
          
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            <p>These notes are only visible to administrators and not to customers or drivers.</p>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  Save Notes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingNoteModal;