import { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type UserData = Database['public']['Tables']['users']['Row'];

/**
 * Returns the appropriate icon path based on user role
 * @param userData The user data object containing the role
 * @param iconName The base name of the icon (e.g., "192x192.png")
 * @returns The full path to the icon
 */
export function getRoleBasedIconPath(userData: UserData | null, iconName: string): string {
  if (!userData) {
    // Default to admin icons when user data is not available
    return `/icons/admin/${iconName}`;
  }
  
  // Use partner folder for partner role, admin folder for all other roles
  const folder = userData.user_role === 'partner' ? 'partner' : 'admin';
  
  return `/icons/${folder}/${iconName}`;
}

/**
 * Gets the app name based on user role
 */
export function getAppName(userData: UserData | null): string {
  if (!userData) return 'Royal Transfer EU Portal';
  
  switch (userData.user_role) {
    case 'partner':
      return 'RT Partner Portal';
    case 'admin':
      return 'RT Admin Portal';
    case 'support':
      return 'RT Support Portal';
    default:
      return 'Royal Transfer EU Portal';
  }
}

/**
 * Gets the manifest URL based on user role
 */
export function getManifestUrl(userData: UserData | null): string {
  if (!userData) return '/manifest.json';
  
  if (userData.user_role === 'partner') {
    return '/manifest-partner.json';
  }
  
  return '/manifest-admin.json';
}