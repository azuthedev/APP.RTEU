import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Component to dynamically update PWA manifest based on user role
const DynamicPWAManifest: React.FC = () => {
  const { userData } = useAuth();
  
  useEffect(() => {
    if (!userData) return;
    
    // Determine which icon set to use based on user role
    const roleFolder = userData.user_role === 'partner' ? 'partner' : 'admin';
    
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
    
    console.log(`PWA manifest updated for role: ${userData.user_role}, using ${roleFolder} icons`);
  }, [userData]);
  
  return null; // This component doesn't render anything
};

export default DynamicPWAManifest;