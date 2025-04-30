import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Loader2, 
  Search, 
  RefreshCw, 
  Database, 
  Table as TableIcon, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Download
} from 'lucide-react';

const DatabaseBrowser: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
  });

  const { toast } = useToast();
  const { userData } = useAuth();

  const isAdmin = userData?.user_role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchTables();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData();
      fetchRowCount();
    }
  }, [selectedTable, pagination.page, pagination.pageSize]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      
      // Get list of tables from Supabase using information_schema.tables
      const { data, error } = await supabase
        .rpc('run_sql_query', { 
          sql_query: `SELECT table_name AS tablename 
                     FROM information_schema.tables 
                     WHERE table_schema = 'public' 
                     ORDER BY table_name ASC`
        });
      
      if (error) throw error;
      
      // Extract table names
      const tableNames = data.map(item => item.tablename);
      setTables(tableNames);
      
      // If there's at least one table, select it by default
      if (tableNames.length > 0 && !selectedTable) {
        setSelectedTable(tableNames[0]);
      }
    } catch (error: any) {
      console.error('Error fetching tables:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch database tables.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async () => {
    if (!selectedTable) return;
    
    try {
      setDataLoading(true);
      
      let query = `SELECT * FROM ${selectedTable} LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`;
      
      if (searchQuery) {
        // Get columns for this table to build search query
        const { data: columnData, error: columnError } = await supabase
          .rpc('get_table_columns', { table_name: selectedTable });
          
        if (columnError) throw columnError;
        
        // Build WHERE clause for search - simple text search on all columns
        if (columnData && columnData.length) {
          const searchConditions = columnData
            .map(col => {
              // Only search text and varchar columns
              if (col.data_type.includes('char') || col.data_type === 'text') {
                return `${col.column_name}::text ILIKE '%${searchQuery}%'`;
              }
              return null;
            })
            .filter(Boolean)
            .join(' OR ');
            
          if (searchConditions) {
            query = `SELECT * FROM ${selectedTable} WHERE ${searchConditions} LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`;
          }
        }
      }
      
      const { data, error } = await supabase.rpc('run_sql_query', { sql_query: query });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Get column names from the first row
        setTableColumns(Object.keys(data[0]));
        // Set table data
        setTableData(data);
      } else {
        setTableColumns([]);
        setTableData([]);
      }
    } catch (error: any) {
      console.error('Error fetching table data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch table data.",
      });
      setTableData([]);
      setTableColumns([]);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchRowCount = async () => {
    if (!selectedTable) return;
    
    try {
      const { data, error } = await supabase.rpc('run_sql_query', { 
        sql_query: `SELECT COUNT(*) FROM ${selectedTable}` 
      });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setRowCount(parseInt(data[0].count));
      } else {
        setRowCount(0);
      }
    } catch (error) {
      console.error('Error fetching row count:', error);
      setRowCount(null);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    fetchTableData();
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setPagination({ ...pagination, page: 1 });
    setSearchQuery('');
    setExpandedRecord(null);
  };

  const handleRefresh = () => {
    if (selectedTable) {
      fetchTableData();
      fetchRowCount();
    }
  };

  const toggleRecordExpansion = (index: number) => {
    if (expandedRecord === index) {
      setExpandedRecord(null);
    } else {
      setExpandedRecord(index);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "The text has been copied to your clipboard.",
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy text to clipboard.",
      });
    }
  };

  const exportTableData = () => {
    if (!tableData.length) return;
    
    // Convert the data to CSV
    const csvHeader = tableColumns.join(',');
    const csvRows = tableData.map(row => 
      tableColumns.map(col => {
        const value = row[col];
        // Handle different data types
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        return `"${value}"`;
      }).join(',')
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedTable}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate total pages
  const totalPages = rowCount ? Math.ceil(rowCount / pagination.pageSize) : 0;

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 p-6 rounded-lg">
        <div className="flex items-start">
          <Database className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2" />
          <div>
            <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300">Admin Access Required</h3>
            <p className="mt-2 text-yellow-600 dark:text-yellow-400">
              You need administrator privileges to access the database browser. Please contact an administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white">Database Browser</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Browse database tables and records for debugging purposes.
        </p>
      </div>

      {/* Table selection and controls */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Table selector */}
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Table
          </label>
          <select
            value={selectedTable || ''}
            onChange={(e) => handleTableSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 dark:text-white"
          >
            {tables.map(tableName => (
              <option key={tableName} value={tableName}>{tableName}</option>
            ))}
          </select>
        </div>

        {/* Search field */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search in string fields..."
              className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="md:col-span-1 flex flex-col justify-end">
          <div className="flex space-x-2">
            <button
              onClick={handleRefresh}
              disabled={!selectedTable || dataLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${dataLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportTableData}
              disabled={!tableData.length || dataLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center disabled:opacity-50"
            >
              <Download className="w-5 h-5 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      {selectedTable && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex items-center justify-between">
            <div className="flex items-center">
              <TableIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
              <h3 className="font-medium text-gray-900 dark:text-white">
                {selectedTable}
                {rowCount !== null && <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({rowCount} records)</span>}
              </h3>
            </div>
            
            {dataLoading && (
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            )}
          </div>
          
          <div className="overflow-x-auto">
            {dataLoading && tableData.length === 0 ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading table data...</p>
              </div>
            ) : tableData.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No records found.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {/* Row expander column */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-10"></th>
                    
                    {/* Data columns */}
                    {tableColumns.map((column) => (
                      <th
                        key={column}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {tableData.map((row, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {/* Row expander */}
                        <td className="px-2 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleRecordExpansion(rowIndex)}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                          >
                            {expandedRecord === rowIndex ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                        
                        {/* Data cells */}
                        {tableColumns.map((column) => {
                          const cellValue = row[column];
                          let displayValue = '';
                          
                          // Format the cell value based on its type
                          if (cellValue === null || cellValue === undefined) {
                            displayValue = 'null';
                          } else if (typeof cellValue === 'object') {
                            displayValue = '{...}';
                          } else if (typeof cellValue === 'boolean') {
                            displayValue = cellValue ? 'true' : 'false';
                          } else {
                            displayValue = String(cellValue);
                            
                            // Truncate long text
                            if (displayValue.length > 50) {
                              displayValue = displayValue.substring(0, 47) + '...';
                            }
                          }
                          
                          // Colorize based on content type
                          let cellClass = "px-6 py-4 whitespace-nowrap text-sm";
                          
                          if (cellValue === null) {
                            cellClass += " text-gray-400 dark:text-gray-500 italic";
                          } else if (typeof cellValue === 'boolean') {
                            cellClass += " text-purple-600 dark:text-purple-400";
                          } else if (typeof cellValue === 'number') {
                            cellClass += " text-blue-600 dark:text-blue-400";
                          } else if (typeof cellValue === 'object') {
                            cellClass += " text-green-600 dark:text-green-400";
                          } else {
                            cellClass += " text-gray-900 dark:text-white";
                          }
                          
                          return (
                            <td key={column} className={cellClass}>
                              {displayValue}
                            </td>
                          );
                        })}
                      </tr>
                      
                      {/* Expanded row for object details */}
                      {expandedRecord === rowIndex && (
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          <td colSpan={tableColumns.length + 1} className="px-6 py-4">
                            <div className="bg-white dark:bg-gray-800 rounded-md p-4 border border-gray-200 dark:border-gray-600">
                              <div className="mb-2 flex justify-between items-center">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Record Details</h4>
                                <button
                                  onClick={() => copyToClipboard(JSON.stringify(row, null, 2))}
                                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                                  title="Copy JSON"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                              <pre className="p-2 bg-gray-50 dark:bg-gray-900 rounded-md text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                                {JSON.stringify(row, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, rowCount || 0)} to {Math.min(pagination.page * pagination.pageSize, rowCount || 0)} of {rowCount} records
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {pagination.page} of {totalPages}
                </span>
                
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
                
                <select
                  value={pagination.pageSize}
                  onChange={(e) => {
                    setPagination({ page: 1, pageSize: parseInt(e.target.value) });
                  }}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value="10">10 / page</option>
                  <option value="20">20 / page</option>
                  <option value="50">50 / page</option>
                  <option value="100">100 / page</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseBrowser;