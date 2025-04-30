import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Component to dynamically update PWA manifest based on user role
const DynamicPWAManifest: React.FC = () => {
  const { userData } = useAuth();
  
  useEffect(() => {
    if (!userData) return;
    
    // Get the current URL path
    const currentPath = window.location.pathname;
    
    // Determine which icon set to use based on path or user role
    let roleFolder = 'admin'; // Default
    
    // If we're in the partner section or user is a partner (not an admin in partner view)
    if (currentPath.startsWith('/partner') || (userData.user_role === 'partner')) {
      roleFolder = 'partner';
    }
    
    // Get the current manifest link element
    const existingManifest = document.querySelector('link[rel="manifest"]');
    
    if (existingManifest) {
      // Remove existing manifest link
      existingManifest.remove();
    }
    
    // Create new manifest link with role-specific path
    const newManifest = document.createElement('link');
    newManifest.rel = 'manifest';
    newManifest.href = `/manifest-${roleFolder}.json`;
    document.head.appendChild(newManifest);
    
    // Update apple touch icon as well
    const existingAppleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (existingAppleIcon) {
      existingAppleIcon.remove();
    }
    
    const newAppleIcon = document.createElement('link');
    newAppleIcon.rel = 'apple-touch-icon';
    newAppleIcon.href = `/icons/${roleFolder}/192x192.png`;
    document.head.appendChild(newAppleIcon);
    
    console.log(`PWA manifest updated for path: ${currentPath}, using ${roleFolder} icons`);
  }, [userData, window.location.pathname]);
  
  return null; // This component doesn't render anything
};

export default DynamicPWAManifest;