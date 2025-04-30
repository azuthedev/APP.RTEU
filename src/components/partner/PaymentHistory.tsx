import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  isSameWeek, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  parseISO, 
  subDays, 
  startOfDay, 
  endOfDay, 
  isToday,
  subMonths,
  eachDayOfInterval,
  isSameDay
} from 'date-fns';
import { 
  DollarSign, 
  Calendar,
  Download,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ArrowUpRight,
  Loader2,
  BarChart,
  TrendingUp,
  Filter,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface Payment {
  id: string;
  trip_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  paid_at: string | null;
  created_at: string;
  payment_method: 'cash' | 'credit_card' | 'paypal';
  trip?: {
    id: string;
    datetime: string;
    pickup_zone?: {
      name: string;
    };
    dropoff_zone?: {
      name: string;
    };
    pickup_address?: string;
    dropoff_address?: string;
    status: string;
  };
}

interface Earnings {
  daily: {
    [key: string]: number;
  };
  weekly: number;
  monthly: number;
  total: number;
  completedTrips: number;
}

interface MonthlyEarningsBreakdown {
  month: string;
  earnings: number;
  tripsCount: number;
}

// Helper to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount);
};

// Helper to generate sparkline data for a given date range
const generateSparklineData = (payments: Payment[], days: number = 7) => {
  const today = new Date();
  const startDate = subDays(today, days - 1);
  const dates = eachDayOfInterval({ start: startDate, end: today });
  
  const data = dates.map(date => {
    const dayPayments = payments.filter(payment => {
      const paymentDate = parseISO(payment.created_at);
      return isSameDay(paymentDate, date);
    });
    
    const dayTotal = dayPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    
    return {
      date,
      amount: dayTotal || 0
    };
  });
  
  return data;
};

const PaymentHistory: React.FC = () => {
  // Base states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [earnings, setEarnings] = useState<Earnings>({
    daily: {},
    weekly: 0,
    monthly: 0,
    total: 0,
    completedTrips: 0
  });
  const [loading, setLoading] = useState(true);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
  
  // Additional states for enhanced earnings reporting
  const [viewMode, setViewMode] = useState<'payments' | 'earnings'>('payments');
  const [earningsBreakdown, setEarningsBreakdown] = useState<MonthlyEarningsBreakdown[]>([]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [dailyEarnings, setDailyEarnings] = useState<{ date: string; amount: number; trips: number }[]>([]);
  const [sparklineData, setSparklineData] = useState<{date: Date; amount: number}[]>([]);
  const [earningsViewMode, setEarningsViewMode] = useState<'monthly' | 'daily' | 'trips'>('monthly');
  const [earningsForTrips, setEarningsForTrips] = useState<{tripId: string; amount: number; date: string; locations: string}[]>([]);
  
  // General state
  const { toast } = useToast();
  const { userData } = useAuth();

  useEffect(() => {
    if (userData?.id) {
      fetchPayments();
    }
  }, [userData]);

  // Effect to handle monthly data when month changes
  useEffect(() => {
    if (earningsBreakdown.length > 0 && selectedMonthIndex >= 0 && selectedMonthIndex < earningsBreakdown.length) {
      // Get the selected month's data
      const selectedMonth = earningsBreakdown[selectedMonthIndex].month;
      
      // Filter payments for this month
      const monthPayments = payments.filter(payment => {
        const paymentDate = parseISO(payment.created_at);
        const paymentMonth = format(paymentDate, 'yyyy-MM');
        return paymentMonth === selectedMonth;
      });
      
      // Generate daily data for the selected month
      generateDailyEarnings(monthPayments, selectedMonth);
      
      // Generate trip-level data for the selected month
      generateTripEarnings(monthPayments);
    }
  }, [selectedMonthIndex, earningsBreakdown, payments]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      
      // Get driver ID
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userData?.id)
        .single();
      
      if (driverError) throw driverError;
      
      if (!driverData?.id) {
        throw new Error('Driver profile not found');
      }

      // Get all completed trips for this driver
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(`
          id,
          datetime,
          status,
          estimated_price,
          pickup_zone:zones!trips_pickup_zone_id_fkey(name),
          dropoff_zone:zones!trips_dropoff_zone_id_fkey(name),
          pickup_address,
          dropoff_address
        `)
        .eq('driver_id', userData.id)
        .in('status', ['completed', 'in_progress'])
        .order('datetime', { ascending: false });
      
      if (tripsError) throw tripsError;
      
      // Get payments for these trips
      const tripIds = (tripsData || []).map(trip => trip.id);
      
      if (tripIds.length === 0) {
        setPayments([]);
        calculateEarnings([]);
        calculateMonthlyBreakdown([]);
        setSparklineData(generateSparklineData([]));
        return;
      }

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('trip_id', tripIds)
        .order('created_at', { ascending: false });
      
      if (paymentsError) throw paymentsError;
      
      // Combine payment and trip data
      const paymentsWithTrips = (paymentsData || []).map(payment => {
        const trip = tripsData?.find(t => t.id === payment.trip_id);
        return {
          ...payment,
          trip
        };
      });

      setPayments(paymentsWithTrips);
      
      // Calculate various earnings metrics
      calculateEarnings(tripsData || []);
      calculateMonthlyBreakdown(paymentsWithTrips);
      setSparklineData(generateSparklineData(paymentsWithTrips));
      
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch payment history.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate earnings from completed trips
  const calculateEarnings = (trips: any[]): void => {
    const now = new Date();
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 });
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    
    let weeklyTotal = 0;
    let monthlyTotal = 0;
    let allTimeTotal = 0;
    const dailyEarnings: Record<string, number> = {};
    
    // Only count completed trips
    const completedTrips = trips.filter(trip => trip.status === 'completed');
    
    completedTrips.forEach(trip => {
      const tripDate = parseISO(trip.datetime);
      const dayKey = format(tripDate, 'yyyy-MM-dd');
      
      // Add to daily totals
      if (!dailyEarnings[dayKey]) {
        dailyEarnings[dayKey] = 0;
      }
      dailyEarnings[dayKey] += Number(trip.estimated_price);
      
      // Add to weekly total if in current week
      if (isSameWeek(tripDate, now, { weekStartsOn: 1 })) {
        weeklyTotal += Number(trip.estimated_price);
      }
      
      // Add to monthly total if in current month
      if (isSameMonth(tripDate, now)) {
        monthlyTotal += Number(trip.estimated_price);
      }
      
      // Add to all-time total
      allTimeTotal += Number(trip.estimated_price);
    });
    
    setEarnings({
      daily: dailyEarnings,
      weekly: weeklyTotal,
      monthly: monthlyTotal,
      total: allTimeTotal,
      completedTrips: completedTrips.length
    });
  };

  // Calculate monthly earnings breakdown
  const calculateMonthlyBreakdown = (paymentsWithTrips: Payment[]) => {
    // Get unique months from payments
    const uniqueMonths = new Set<string>();
    
    // Include current month and past 11 months (for a total of 12)
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const month = format(subMonths(today, i), 'yyyy-MM');
      uniqueMonths.add(month);
    }
    
    // Initialize monthly breakdown with 0 for each month
    const monthlyData: MonthlyEarningsBreakdown[] = Array.from(uniqueMonths).map(month => ({
      month,
      earnings: 0,
      tripsCount: 0
    }));
    
    // Calculate earnings for each month
    paymentsWithTrips.forEach(payment => {
      const paymentDate = parseISO(payment.created_at);
      const monthKey = format(paymentDate, 'yyyy-MM');
      
      // Find this month in our breakdown array
      const monthData = monthlyData.find(m => m.month === monthKey);
      if (monthData) {
        monthData.earnings += Number(payment.amount);
        monthData.tripsCount += 1;
      }
    });
    
    // Sort by month (most recent first)
    monthlyData.sort((a, b) => b.month.localeCompare(a.month));
    
    setEarningsBreakdown(monthlyData);
    
    // Select the most recent month by default
    setSelectedMonthIndex(0);
  };

  // Generate daily earnings for the selected month
  const generateDailyEarnings = (monthPayments: Payment[], monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = endOfMonth(startDate);
    
    // Get all days in the month
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Initialize with 0 for each day
    const dailyData = daysInMonth.map(date => ({
      date: format(date, 'yyyy-MM-dd'),
      amount: 0,
      trips: 0
    }));
    
    // Calculate earnings for each day
    monthPayments.forEach(payment => {
      const paymentDate = parseISO(payment.created_at);
      const dayKey = format(paymentDate, 'yyyy-MM-dd');
      
      // Find this day in our array
      const dayData = dailyData.find(d => d.date === dayKey);
      if (dayData) {
        dayData.amount += Number(payment.amount);
        dayData.trips += 1;
      }
    });
    
    setDailyEarnings(dailyData);
  };

  // Generate trip-level earnings data
  const generateTripEarnings = (monthPayments: Payment[]) => {
    const tripData = monthPayments.map(payment => ({
      tripId: payment.trip_id,
      amount: Number(payment.amount),
      date: format(parseISO(payment.trip?.datetime || payment.created_at), 'yyyy-MM-dd'),
      locations: payment.trip 
        ? `${payment.trip.pickup_zone?.name || payment.trip.pickup_address || 'Unknown'} to ${payment.trip.dropoff_zone?.name || payment.trip.dropoff_address || 'Unknown'}` 
        : 'Unknown trip'
    }));
    
    // Sort by date (most recent first)
    tripData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setEarningsForTrips(tripData);
  };

  const togglePaymentDetails = (paymentId: string) => {
    if (expandedPayment === paymentId) {
      setExpandedPayment(null);
    } else {
      setExpandedPayment(paymentId);
    }
  };

  // Export earnings data as CSV
  const exportEarnings = () => {
    try {
      let csvData: string[][];
      let filename: string;
      
      // Format data based on current view mode
      if (earningsViewMode === 'monthly') {
        csvData = [
          ['Month', 'Earnings (EUR)', 'Number of Trips', 'Average Per Trip']
        ];
        
        earningsBreakdown.forEach(month => {
          const avgPerTrip = month.tripsCount > 0 ? month.earnings / month.tripsCount : 0;
          csvData.push([
            format(new Date(month.month + '-01'), 'MMMM yyyy'),
            month.earnings.toFixed(2),
            month.tripsCount.toString(),
            avgPerTrip.toFixed(2)
          ]);
        });
        
        filename = `monthly_earnings_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      } 
      else if (earningsViewMode === 'daily') {
        csvData = [
          ['Date', 'Earnings (EUR)', 'Number of Trips']
        ];
        
        // Only include days with earnings
        dailyEarnings
          .filter(day => day.amount > 0 || day.trips > 0)
          .forEach(day => {
            csvData.push([
              format(parseISO(day.date), 'MMM d, yyyy'),
              day.amount.toFixed(2),
              day.trips.toString()
            ]);
          });
        
        filename = `daily_earnings_${earningsBreakdown[selectedMonthIndex]?.month || format(new Date(), 'yyyy-MM')}.csv`;
      }
      else { // trips view
        csvData = [
          ['Date', 'Trip', 'Earnings (EUR)']
        ];
        
        earningsForTrips.forEach(trip => {
          csvData.push([
            format(parseISO(trip.date), 'MMM d, yyyy'),
            trip.locations,
            trip.amount.toFixed(2)
          ]);
        });
        
        filename = `trip_earnings_${earningsBreakdown[selectedMonthIndex]?.month || format(new Date(), 'yyyy-MM')}.csv`;
      }

      // Convert to CSV string
      const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Complete",
        description: "Earnings data exported to CSV file.",
      });
    } catch (error: any) {
      console.error('Error exporting earnings data:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "Failed to export earnings data.",
      });
    }
  };

  // Export all payment history as CSV
  const exportPaymentHistory = () => {
    try {
      // Format payments data for CSV export
      const csvData = payments.map(payment => {
        return {
          Date: payment.trip?.datetime ? format(new Date(payment.trip.datetime), 'PP') : 'N/A',
          Time: payment.trip?.datetime ? format(new Date(payment.trip.datetime), 'p') : 'N/A',
          Amount: formatCurrency(payment.amount),
          Status: payment.status,
          'Payment Method': payment.payment_method,
          'Payment Date': payment.paid_at ? format(new Date(payment.paid_at), 'PP') : 'N/A',
          'Pickup Location': payment.trip?.pickup_zone?.name || payment.trip?.pickup_address || 'N/A',
          'Dropoff Location': payment.trip?.dropoff_zone?.name || payment.trip?.dropoff_address || 'N/A',
        };
      });

      // Convert to CSV
      const headers = Object.keys(csvData[0] || {});
      const csv = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(field => `"${row[field as keyof typeof row]}"`).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `payment_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      a.click();
      
      toast({
        title: "Export Complete",
        description: "Payment history exported to CSV file.",
      });
    } catch (error: any) {
      console.error('Error exporting payment history:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "Failed to export payment history.",
      });
    }
  };

  const getSparklinePath = () => {
    if (sparklineData.length === 0) return '';
    
    const width = 100; // SVG width
    const height = 30;  // SVG height
    const padding = 2;  // Padding from edges
    
    // Find min/max values for scaling
    const maxAmount = Math.max(...sparklineData.map(d => d.amount), 1);  // Ensure at least 1 to prevent division by zero
    
    // Generate path data
    const pathData = sparklineData.map((dataPoint, index) => {
      const x = padding + (index / (sparklineData.length - 1)) * (width - 2 * padding);
      const y = height - padding - (dataPoint.amount / maxAmount) * (height - 2 * padding);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return pathData;
  };

  // Navigate to previous month
  const handlePreviousMonth = () => {
    if (selectedMonthIndex < earningsBreakdown.length - 1) {
      setSelectedMonthIndex(selectedMonthIndex + 1);
    }
  };

  // Navigate to next month
  const handleNextMonth = () => {
    if (selectedMonthIndex > 0) {
      setSelectedMonthIndex(selectedMonthIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  // Get highest and lowest earning days
  const getHighestEarningDay = () => {
    if (dailyEarnings.length === 0) return null;
    return dailyEarnings.reduce((max, day) => day.amount > max.amount ? day : max, dailyEarnings[0]);
  };

  const getLowestEarningDay = () => {
    const daysWithEarnings = dailyEarnings.filter(day => day.amount > 0);
    if (daysWithEarnings.length === 0) return null;
    return daysWithEarnings.reduce((min, day) => day.amount < min.amount ? day : min, daysWithEarnings[0]);
  };

  const highestEarningDay = getHighestEarningDay();
  const lowestEarningDay = getLowestEarningDay();

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold dark:text-white mb-4 sm:mb-0">Earnings & Payments</h1>
        
        <div className="flex items-center space-x-3">
          {/* View toggle buttons */}
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('earnings')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'earnings' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Earnings Breakdown
            </button>
            <button
              onClick={() => setViewMode('payments')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'payments' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Payment History
            </button>
          </div>
          
          <button
            onClick={viewMode === 'earnings' ? exportEarnings : exportPaymentHistory}
            disabled={payments.length === 0}
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Earnings Summary Cards - Always visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">This Week</h3>
            <div className="relative h-8 w-16">
              <svg width="100%" height="100%" className="text-blue-100 dark:text-blue-900/30">
                <path 
                  d={getSparklinePath()} 
                  fill="none" 
                  strokeWidth="2"
                  stroke="currentColor" 
                  className="text-blue-500 dark:text-blue-400"
                />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(earnings.weekly)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Week of {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">This Month</h3>
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(earnings.monthly)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {format(new Date(), 'MMMM yyyy')}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Completed Trips</h3>
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {earnings.completedTrips}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            All-time total
          </div>
        </div>
      </div>

      {/* View mode specific content */}
      {viewMode === 'earnings' ? (
        <div className="space-y-6">
          {/* Earnings View - Month Navigation & View Type Toggle */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
                <BarChart className="h-5 w-5 mr-2 text-blue-500 dark:text-blue-400" />
                Earnings Breakdown
              </h3>
              
              <div className="flex items-center space-x-2">
                {/* Month navigation */}
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
                  <button 
                    onClick={handlePreviousMonth}
                    disabled={selectedMonthIndex >= earningsBreakdown.length - 1}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-md disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="px-2 py-1.5 text-sm text-gray-900 dark:text-white">
                    {earningsBreakdown[selectedMonthIndex] 
                      ? format(new Date(earningsBreakdown[selectedMonthIndex].month + '-01'), 'MMMM yyyy')
                      : 'No data'}
                  </div>
                  <button 
                    onClick={handleNextMonth}
                    disabled={selectedMonthIndex <= 0}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-md disabled:opacity-50"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                
                {/* View type toggle */}
                <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <button
                    onClick={() => setEarningsViewMode('monthly')}
                    className={`p-2 text-sm ${
                      earningsViewMode === 'monthly' 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                    title="Monthly View"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEarningsViewMode('daily')}
                    className={`p-2 text-sm ${
                      earningsViewMode === 'daily' 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                    title="Daily Breakdown"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEarningsViewMode('trips')}
                    className={`p-2 text-sm ${
                      earningsViewMode === 'trips' 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                    title="Trips Breakdown"
                  >
                    <Car className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {earningsBreakdown.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Earnings Data</h4>
                  <p className="text-gray-500 dark:text-gray-400">
                    You don't have any earnings recorded yet. Once you complete trips and receive payments, your earnings data will appear here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Monthly Overview */}
                  {earningsViewMode === 'monthly' && (
                    <div className="space-y-6">
                      {/* Monthly Stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {earningsBreakdown.slice(0, 4).map((month, index) => (
                          <div 
                            key={month.month}
                            className={`p-4 rounded-lg border ${
                              index === selectedMonthIndex 
                                ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' 
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                            onClick={() => setSelectedMonthIndex(index)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="font-medium text-sm text-gray-500 dark:text-gray-400">
                              {format(new Date(month.month + '-01'), 'MMMM yyyy')}
                            </div>
                            <div className="mt-1 font-semibold text-lg text-gray-900 dark:text-white">
                              {formatCurrency(month.earnings)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {month.tripsCount} trip{month.tripsCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Monthly Chart */}
                      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Monthly Earnings (Last 12 Months)</h4>
                        <div className="h-60 relative">
                          {/* Bar chart visualization */}
                          <div className="flex h-full items-end justify-around gap-1">
                            {earningsBreakdown.slice(0, 12).reverse().map((month, index) => {
                              const maxEarning = Math.max(...earningsBreakdown.map(m => m.earnings), 1);
                              const heightPercentage = (month.earnings / maxEarning) * 100;
                              
                              return (
                                <div key={month.month} className="flex flex-col items-center flex-1">
                                  <div 
                                    className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all duration-500"
                                    style={{ 
                                      height: `${heightPercentage || 2}%`,
                                      minHeight: '4px',
                                      opacity: 11 - index >= 0 ? (11 - index) / 11 : 1
                                    }}
                                    title={`${formatCurrency(month.earnings)}`}
                                  ></div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 rotate-45 origin-left translate-y-3">
                                    {format(new Date(month.month + '-01'), 'MMM')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 h-full flex flex-col justify-between pointer-events-none">
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {formatCurrency(Math.max(...earningsBreakdown.map(m => m.earnings), 0))}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {formatCurrency(Math.max(...earningsBreakdown.map(m => m.earnings), 0) / 2)}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {formatCurrency(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Monthly Earnings Stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                          <div className="text-sm text-green-700 dark:text-green-300 mb-1">Monthly Average</div>
                          <div className="text-xl font-semibold text-green-800 dark:text-green-200">
                            {formatCurrency(earningsBreakdown.length > 0 
                              ? earningsBreakdown.reduce((sum, month) => sum + month.earnings, 0) / 
                                earningsBreakdown.filter(m => m.earnings > 0).length || 0
                              : 0
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                          <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Highest Month</div>
                          <div className="text-xl font-semibold text-blue-800 dark:text-blue-200">
                            {formatCurrency(Math.max(...earningsBreakdown.map(m => m.earnings), 0))}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {earningsBreakdown.length > 0
                              ? format(new Date(earningsBreakdown.reduce((max, month) => 
                                  month.earnings > max.earnings ? month : max, 
                                  { earnings: 0, month: '', tripsCount: 0 }).month + '-01'), 'MMMM yyyy')
                              : 'N/A'}
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                          <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Average Per Trip</div>
                          <div className="text-xl font-semibold text-purple-800 dark:text-purple-200">
                            {formatCurrency(earningsBreakdown.reduce((sum, month) => sum + month.earnings, 0) / 
                              earningsBreakdown.reduce((sum, month) => sum + month.tripsCount, 0) || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Daily Breakdown */}
                  {earningsViewMode === 'daily' && (
                    <div className="space-y-6">
                      {/* Daily Stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                          <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total for {format(new Date(earningsBreakdown[selectedMonthIndex].month + '-01'), 'MMMM')}</div>
                          <div className="text-xl font-semibold text-blue-800 dark:text-blue-200">
                            {formatCurrency(earningsBreakdown[selectedMonthIndex].earnings)}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {earningsBreakdown[selectedMonthIndex].tripsCount} trip{earningsBreakdown[selectedMonthIndex].tripsCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                        
                        {highestEarningDay && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="text-sm text-green-700 dark:text-green-300 mb-1">Best Day</div>
                            <div className="text-xl font-semibold text-green-800 dark:text-green-200">
                              {formatCurrency(highestEarningDay.amount)}
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                              {format(parseISO(highestEarningDay.date), 'EEEE, MMM d')}
                            </div>
                          </div>
                        )}
                        
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                          <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Daily Average</div>
                          <div className="text-xl font-semibold text-purple-800 dark:text-purple-200">
                            {formatCurrency(
                              dailyEarnings.reduce((sum, day) => sum + day.amount, 0) / 
                              (dailyEarnings.filter(day => day.amount > 0).length || 1)
                            )}
                          </div>
                          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                            on working days
                          </div>
                        </div>
                      </div>
                      
                      {/* Daily Earnings Table */}
                      <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-600 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily Breakdown</h4>
                          
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <div className="w-3 h-3 bg-blue-500 dark:bg-blue-400 rounded-sm mr-1"></div>
                            <span>Earnings</span>
                          </div>
                        </div>
                        
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
                          {dailyEarnings
                            .filter(day => dailyEarnings.length <= 31 || day.amount > 0) // Only show days with earnings if many days
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date descending
                            .map(day => (
                              <div 
                                key={day.date}
                                className={`flex items-center justify-between p-3 ${
                                  day.amount > 0 
                                    ? 'hover:bg-gray-50 dark:hover:bg-gray-600' 
                                    : 'text-gray-400 dark:text-gray-500'
                                }`}
                              >
                                <div className="flex items-center">
                                  <div className={`flex flex-col mr-4 w-12 ${
                                    isToday(parseISO(day.date)) 
                                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                                      : ''
                                  }`}>
                                    <span className="text-xs">{format(parseISO(day.date), 'E')}</span>
                                    <span className="text-lg leading-none">{format(parseISO(day.date), 'd')}</span>
                                  </div>
                                  <div>
                                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                                      {format(parseISO(day.date), 'MMMM d, yyyy')}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {day.trips} trip{day.trips !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className={`text-right ${
                                  highestEarningDay?.date === day.date 
                                    ? 'text-green-600 dark:text-green-400 font-semibold' 
                                    : lowestEarningDay?.date === day.date && day.amount > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-gray-900 dark:text-white'
                                }`}>
                                  <div className="text-lg font-medium">
                                    {formatCurrency(day.amount)}
                                  </div>
                                  {highestEarningDay?.date === day.date && (
                                    <div className="text-xs">Highest</div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Trip-level Breakdown */}
                  {earningsViewMode === 'trips' && (
                    <div>
                      {earningsForTrips.length > 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Trip Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Earnings</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {earningsForTrips.map((trip, index) => (
                                <tr key={trip.tripId + index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                    {format(parseISO(trip.date), 'MMM d, yyyy')}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    {trip.locations}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {formatCurrency(trip.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <Car className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Trips Found</h4>
                          <p className="text-gray-500 dark:text-gray-400">
                            There are no completed trips for this period.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Payment History View */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="font-medium text-gray-900 dark:text-white">Payment History</h2>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No payment history yet</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Your payment history will appear here after you complete trips.
              </p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {payments.map((payment) => (
                <div key={payment.id}>
                  <div 
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => togglePaymentDetails(payment.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-full mr-3 ${
                          payment.status === 'completed' 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : payment.status === 'pending'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30'
                              : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {payment.status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : payment.status === 'pending' ? (
                            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {payment.trip?.pickup_zone?.name || 'Pickup'} to {payment.trip?.dropoff_zone?.name || 'Dropoff'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {payment.trip?.datetime ? format(new Date(payment.trip.datetime), 'PP') : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <div className="text-right mr-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(payment.amount)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {payment.payment_method.replace('_', ' ')}
                          </div>
                        </div>
                        
                        {expandedPayment === payment.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded payment details */}
                  {expandedPayment === payment.id && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="text-sm space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Payment ID</p>
                            <p className="font-medium text-gray-900 dark:text-white">{payment.id.slice(0, 8)}...</p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Status</p>
                            <p className={`font-medium capitalize ${
                              payment.status === 'completed' 
                                ? 'text-green-600 dark:text-green-400' 
                                : payment.status === 'pending'
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}>
                              {payment.status}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Payment Method</p>
                            <p className="font-medium text-gray-900 dark:text-white flex items-center">
                              <CreditCard className="h-4 w-4 mr-1 text-gray-400 dark:text-gray-500" />
                              <span className="capitalize">{payment.payment_method.replace('_', ' ')}</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Payment Date</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {payment.paid_at ? format(new Date(payment.paid_at), 'PP') : 'Pending'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="border-t dark:border-gray-600 pt-3 mt-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Trip Date & Time</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {payment.trip?.datetime 
                                  ? format(new Date(payment.trip.datetime), 'PPp') 
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Amount</p>
                              <p className="font-medium text-xl text-gray-900 dark:text-white">
                                {formatCurrency(payment.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border-t dark:border-gray-600 pt-3 mt-3">
                          <a 
                            href="#" 
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center justify-center"
                          >
                            <ArrowUpRight className="h-4 w-4 mr-1" />
                            View Full Trip Details
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;