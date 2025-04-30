import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Save, ChevronLeft, ChevronRight, MoreVertical, Edit, UserX, UserCheck, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  user_role: string;
  is_suspended: boolean;
}

interface PendingChange {
  user_role?: string;
  is_suspended?: boolean;
  name?: string;
  email?: string;
  phone?: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState<{userId: string, suspend: boolean} | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { userData, refreshSession } = useAuth();
  const initLoadDone = useRef(false);

  // When component mounts, ensure the session is refreshed to get updated JWT claims
  useEffect(() => {
    const initData = async () => {
      if (userData?.user_role === 'admin' && !initLoadDone.current) {
        // Refresh session to ensure JWT claims are up to date
        await refreshSession();
        initLoadDone.current = true;
        fetchUsers();
      }
    };
    
    initData();
  }, [userData]);

  // When page changes, re-fetch data
  useEffect(() => {
    if (initLoadDone.current && userData?.user_role === 'admin') {
      fetchUsers();
    }
  }, [currentPage, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Verify admin role before querying
      if (userData?.user_role !== 'admin') {
        throw new Error('Admin permissions required');
      }

      console.log('Fetching users with JWT claims:', supabase.auth.getSession());
      
      // Start with a base query
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });
      
      // Apply search filter if provided
      if (searchQuery.trim() !== '') {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }
      
      // Apply role filter if not 'all'
      if (roleFilter !== 'all') {
        // Map 'driver' filter to 'partner' role in database
        const dbRole = roleFilter === 'driver' ? 'partner' : roleFilter;
        query = query.eq('user_role', dbRole);
      }
      
      // Apply status filter if not 'all'
      if (statusFilter !== 'all') {
        query = query.eq('is_suspended', statusFilter === 'suspended');
      }
      
      // Get the total count first
      const { count, error: countError } = await query;
      
      if (countError) throw countError;
      setTotalCount(count || 0);
      
      // Then get the paginated results
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * usersPerPage, currentPage * usersPerPage - 1);

      if (error) {
        console.error('Error fetching users list:', error);
        throw error;
      }
      
      console.log('Fetched users:', data?.length || 0);
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error in fetchUsers:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch users. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        user_role: newRole
      }
    }));
  };

  const confirmToggleUserStatus = (userId: string, currentStatus: boolean) => {
    setShowSuspendConfirm({userId, suspend: !currentStatus});
  };

  const executeToggleUserStatus = () => {
    if (!showSuspendConfirm) return;
    
    const { userId, suspend } = showSuspendConfirm;
    
    setPendingChanges(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        is_suspended: suspend
      }
    }));
    
    setShowSuspendConfirm(null);
  };

  const confirmDeleteUser = (userId: string) => {
    setShowDeleteConfirm(userId);
  };

  const executeDeleteUser = async () => {
    if (!showDeleteConfirm) return;
    
    const userId = showDeleteConfirm;
    setIsDeleting(true);
    
    try {
      // Get the current session for the JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Use the Supabase Edge Function to delete the user completely
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }
      
      // Update the local state to remove the deleted user
      setUsers(users.filter(user => user.id !== userId));
      
      // Show success notification
      toast({
        title: "User Deleted",
        description: result.message || "The user has been permanently deleted.",
      });
      
      // Update total count
      setTotalCount(prev => prev - 1);
      
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || "There was an error deleting this user. They may have related records.",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditModalOpen(true);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!editingUser) return;

    setEditingUser({
      ...editingUser,
      [name]: value
    });

    setPendingChanges(prev => ({
      ...prev,
      [editingUser.id]: {
        ...prev[editingUser.id],
        [name]: value
      }
    }));
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const confirmSaveChanges = () => {
    // If we're in the edit modal, close it first and show confirm dialog
    if (isEditModalOpen) {
      setIsEditModalOpen(false);
    }
    // Show confirm dialog
    setShowSaveConfirm(true);
  };

  const saveChanges = async () => {
    setIsSaving(true);
    const updates = [];
    let hasError = false;

    try {
      for (const [userId, changes] of Object.entries(pendingChanges)) {
        const { error } = await supabase
          .from('users')
          .update(changes)
          .eq('id', userId);

        if (error) {
          console.error(`Error updating user ${userId}:`, error);
          hasError = true;
          continue;
        }

        updates.push(userId);
      }

      // Update local state
      setUsers(users.map(user => {
        if (pendingChanges[user.id]) {
          return {
            ...user,
            ...pendingChanges[user.id]
          };
        }
        return user;
      }));

      // Clear pending changes for successful updates
      const newPendingChanges = { ...pendingChanges };
      updates.forEach(userId => delete newPendingChanges[userId]);
      setPendingChanges(newPendingChanges);

      toast({
        variant: hasError ? "destructive" : "default",
        title: hasError ? "Partial Success" : "Success",
        description: hasError 
          ? "Some changes were saved, but others failed. Please try again."
          : "All changes were saved successfully.",
      });
      
      // Refresh the user list after saving changes
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving changes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
      setIsEditModalOpen(false);
      setShowSaveConfirm(false);
    }
  };

  // Handle search form submission
  const handleSearch = () => {
    setCurrentPage(1); // Reset to page 1 when searching
    fetchUsers();
  };

  const filteredUsers = users;
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const totalPages = Math.ceil(totalCount / usersPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (loading && !users.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-xl font-semibold dark:text-white">User Management</h2>
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
          {/* Search field */}
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 w-full md:w-64"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1); // Reset to first page when changing filter
            }}
            className="w-full md:w-auto px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="customer">Customer</option>
            <option value="driver">Driver</option>
            <option value="support">Support</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1); // Reset to first page when changing filter
            }}
            className="w-full md:w-auto px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            onClick={handleSearch}
            className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {loading && users.length > 0 && (
        <div className="text-center p-4">
          <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
          <p className="mt-2 text-gray-600 dark:text-gray-400">Refreshing...</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="max-h-16 h-16 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={pendingChanges[user.id]?.user_role ?? user.user_role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className={`text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                          pendingChanges[user.id]?.user_role ? 'bg-yellow-50 dark:bg-yellow-900/30' : ''
                        }`}
                      >
                        <option value="customer">Customer</option>
                        <option value="admin">Admin</option>
                        <option value="partner">Driver</option>
                        <option value="support">Support</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        (pendingChanges[user.id]?.is_suspended ?? user.is_suspended)
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      }`}>
                        {(pendingChanges[user.id]?.is_suspended ?? user.is_suspended) ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="relative" style={{ height: '24px' }}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                              aria-label="User actions"
                            >
                              <MoreVertical className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 z-50">
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => confirmToggleUserStatus(
                                user.id, 
                                pendingChanges[user.id]?.is_suspended ?? user.is_suspended
                              )}
                              className={(pendingChanges[user.id]?.is_suspended ?? user.is_suspended)
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                              }
                            >
                              {(pendingChanges[user.id]?.is_suspended ?? user.is_suspended) ? (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reactivate
                                </>
                              ) : (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Suspend
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => confirmDeleteUser(user.id)}
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading users...' : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalCount > usersPerPage && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {Math.min((currentPage - 1) * usersPerPage + 1, totalCount)} to {Math.min(currentPage * usersPerPage, totalCount)} of {totalCount} users
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded border ${
                currentPage === 1 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                  : 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-gray-200 dark:border-gray-700'
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded dark:text-white">
              {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className={`px-3 py-1 rounded border ${
                currentPage >= totalPages 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                  : 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-gray-200 dark:border-gray-700'
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Edit User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editingUser.name}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={editingUser.email}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={editingUser.phone || ''}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveChanges}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend/Reactivate Confirmation Modal */}
      {showSuspendConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {showSuspendConfirm.suspend ? 'Suspend User' : 'Reactivate User'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {showSuspendConfirm.suspend 
                    ? 'Are you sure you want to suspend this user? They will not be able to log in until reactivated.'
                    : 'Are you sure you want to reactivate this user? They will regain access to their account.'}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSuspendConfirm(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeToggleUserStatus}
                className={`px-4 py-2 rounded-md text-white ${showSuspendConfirm.suspend ? 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600' : 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600'}`}
              >
                {showSuspendConfirm.suspend ? 'Yes, Suspend User' : 'Yes, Reactivate User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Delete User</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to permanently delete this user? This action cannot be undone.
                </p>
                <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                  Warning: This will delete all associated data and cannot be recovered.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteUser}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors flex items-center"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Yes, Delete User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Changes Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Confirm Changes</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to save all changes? This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Yes, Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Changes Button */}
      {hasPendingChanges && (
        <div className="fixed bottom-8 right-8 z-40">
          <button
            onClick={confirmSaveChanges}
            disabled={isSaving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserManagement;