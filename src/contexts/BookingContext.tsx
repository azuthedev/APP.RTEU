import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

// Define vehicles array that was missing
const vehicles = [
  { 
    id: 'default',
    name: 'Default Vehicle',
    type: 'sedan',
    capacity: 4,
    price: 25
  }
];

interface BookingState {
  step: 1 | 2 | 3;
  previousStep?: 1 | 2 | 3; // Added to track previous step for animations
  selectedVehicle: typeof vehicles[0];
  personalDetails: {
    title: 'mr' | 'ms';
    firstName: string;
    lastName: string;
    email: string;
    country: string;
    phone: string;
    selectedExtras: Set<string>;
  };
  paymentDetails: {
    method: 'card' | 'cash';
    cardNumber?: string;
    expiryDate?: string;
    cvc?: string;
    discountCode?: string;
  };
}

interface BookingContextType {
  bookingState: BookingState;
  setBookingState: React.Dispatch<React.SetStateAction<BookingState>>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookingState, setBookingState] = useState<BookingState>({
    step: 1,
    selectedVehicle: vehicles[0],
    personalDetails: {
      title: 'mr',
      firstName: '',
      lastName: '',
      email: '',
      country: '',
      phone: '',
      selectedExtras: new Set()
    },
    paymentDetails: {
      method: 'card'
    }
  });

  // Track previous step for animation purposes
  const previousStepRef = useRef<1 | 2 | 3>(1);
  
  useEffect(() => {
    // When step changes, update the previousStep value
    if (bookingState.step !== previousStepRef.current) {
      setBookingState(prev => ({
        ...prev,
        previousStep: previousStepRef.current
      }));
      previousStepRef.current = bookingState.step;
    }
  }, [bookingState.step]);

  return (
    <BookingContext.Provider value={{ bookingState, setBookingState }}>
      {children}
    </BookingContext.Provider>
  );
};

export { useBooking };