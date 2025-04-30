import React, { useState, useEffect } from 'react';
import { Copy, Loader2, AlertCircle, Trash2, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { format } from 'date-fns';

interface InviteLink {
  id: string;
  code: string;
  role: 'admin' | 'support' | 'partner';
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by: string | null;
  created_by: string;
  note: string | null;
  status: 'active' | 'used' | 'expired';
  creator?: {
    name: string;
    email: string;
  };
  used_by_user?: {
    name: string;
    email: string;
  };
}

const DevTools = () => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'support' | 'partner'>('admin');
  const [expiresIn, setExpiresIn] = useState('24');
  const [note, setNote] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const fetchInviteLinks = async () => {
    try {
      setIsRefreshing(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('invite_links')
        .select(`
          *,
          creator:users!invite_links_created_by_fkey(name, email),
          used_by_user:users!invite_links_used_by_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInviteLinks(data || []);
    } catch (err) {
      console.error('Error fetching invite links:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch invite links",
      });
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInviteLinks();
  }, []);

  const generateInviteLink = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('Not authenticated');
      }

      // Generate a random code
      const code = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));

      // Insert the invite link
      const { error: insertError } = await supabase
        .from('invite_links')
        .insert({
          code,
          role: selectedRole,
          expires_at: expiresAt.toISOString(),
          created_by: userData.user.id,
          note: note.trim() || null,
          status: 'active'
        });

      if (insertError) throw insertError;

      // Generate the full URL
      const signupUrl = new URL('/customer-signup', window.location.origin);
      signupUrl.searchParams.set('invite', code);
      
      setGeneratedLink(signupUrl.toString());
      
      toast({
        title: "Success",
        description: "Invite link generated successfully!",
      });
      
      // Reset the note field
      setNote('');

      // Refresh the list
      fetchInviteLinks();
    } catch (err) {
      console.error('Error generating invite link:', err);
      setError('Failed to generate invite link. Please try again.');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate invite link",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast({
        title: "Success",
        description: "Link copied to clipboard!",
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy link",
      });
    }
  };

  const markInviteLinkAsExpired = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invite_links')
        .update({ status: 'expired' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invite link marked as expired",
      });

      // Refresh the list
      fetchInviteLinks();
    } catch (err) {
      console.error('Error updating invite link:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update invite link",
      });
    }
  };

  // Filter invite links based on search query
  const filteredInviteLinks = inviteLinks.filter(link => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    
    return (
      link.code.toLowerCase().includes(query) ||
      link.role.toLowerCase().includes(query) ||
      (link.note && link.note.toLowerCase().includes(query)) ||
      (link.creator?.name && link.creator.name.toLowerCase().includes(query)) ||
      (link.creator?.email && link.creator.email.toLowerCase().includes(query)) ||
      (link.used_by_user?.name && link.used_by_user.name.toLowerCase().includes(query)) ||
      (link.used_by_user?.email && link.used_by_user.email.toLowerCase().includes(query)) ||
      (link.status && link.status.toLowerCase().includes(query))
    );
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6 dark:text-white">Developer Tools</h2>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-transparent dark:border-gray-700">
        <h3 className="text-lg font-medium mb-4 dark:text-white">Sign-Up Link Generator</h3>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-4 rounded-md mb-4 flex items-start">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="ml-2">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'support' | 'partner')}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="admin">Admin</option>
              <option value="support">Support Agent</option>
              <option value="partner">Partner</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expires In (hours)
            </label>
            <input
              type="number"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              min="1"
              max="168"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this invite link"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[80px]"
            />
          </div>

          <button
            onClick={generateInviteLink}
            disabled={isGenerating}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : 'Generate Link'}
          </button>

          {generatedLink && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Generated Link
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-l-md bg-gray-50 dark:bg-gray-600 dark:text-white"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Copy className="w-5 h-5 dark:text-white" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This link will expire in {expiresIn} hours and can only be used once.
              </p>
            </div>
          )}
        </div>

        {/* Active Invite Links */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium dark:text-white">Invite Links History</h3>
            <button
              onClick={() => fetchInviteLinks()}
              disabled={isRefreshing}
              className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Search field */}
          <div className="mb-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, role, note, creator..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : filteredInviteLinks.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No invite links found</p>
          ) : (
            <div className="space-y-4">
              {filteredInviteLinks.map((link) => (
                <div key={link.id} className={`border rounded-lg p-4 ${
                  link.status === 'expired' ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700' : 
                  link.status === 'used' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' : 
                  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium dark:text-white">Role: <span className="capitalize">{link.role}</span></p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          link.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 
                          link.status === 'used' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 
                          'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {link.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Code: {link.code}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Created: {format(new Date(link.created_at), 'PPp')}
                      </p>
                      {link.expires_at && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Expires: {format(new Date(link.expires_at), 'PPp')}
                        </p>
                      )}
                      {link.creator && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Created by: {link.creator.name} ({link.creator.email})
                        </p>
                      )}
                      {link.used_at && (
                        <>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Used: {format(new Date(link.used_at), 'PPp')}
                          </p>
                          {link.used_by_user && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Used by: {link.used_by_user.name} ({link.used_by_user.email})
                            </p>
                          )}
                        </>
                      )}
                      {link.note && (
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                          <p className="font-medium">Note:</p>
                          <p>{link.note}</p>
                        </div>
                      )}
                    </div>
                    {link.status === 'active' && (
                      <button
                        onClick={() => markInviteLinkAsExpired(link.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        title="Mark as expired"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevTools;