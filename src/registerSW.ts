import { Workbox } from 'workbox-window';

export function registerSW() {
  // Expanded check to catch all WebContainer environments including local-credentialless.webcontainer-api.io
  const isWebContainerEnv = 
    window.location.hostname.includes('stackblitz') || 
    window.location.origin.includes('stackblitz.io') || 
    window.location.hostname.includes('webcontainer-api.io') ||
    window.location.hostname.includes('local-credentialless.webcontainer-api.io');
  
  // Check if in StackBlitz environment or WebContainer - Don't register service worker in these environments
  if ('serviceWorker' in navigator && !isWebContainerEnv) {
    const wb = new Workbox('/service-worker.js');

    wb.addEventListener('installed', (event) => {
      if (event.isUpdate) {
        // Create update notification using vanilla JavaScript
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        
        const message = document.createElement('p');
        message.textContent = 'A new version of the application is available.';
        
        const reloadButton = document.createElement('button');
        reloadButton.textContent = 'Reload';
        reloadButton.onclick = () => window.location.reload();
        reloadButton.className = 'bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors';
        
        notification.appendChild(message);
        notification.appendChild(reloadButton);
        
        document.body.appendChild(notification);
      }
    });

    wb.addEventListener('activated', (event) => {
      // Get all open windows/tabs
      if (event.isUpdate) {
        console.log('Service Worker has been updated and activated');
      } else {
        console.log('Service Worker has been installed and activated');
      }
    });

    wb.addEventListener('waiting', (event) => {
      console.log('Service Worker is waiting to be activated');
    });

    // Register the service worker
    wb.register()
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  } else {
    console.log('Service Worker is not supported or disabled in this environment');
  }
}

// Add a function to dynamically generate the proper manifest URLs for the cache
export function getCacheableIconsByRole(role: string | null): string[] {
  // Default - cache both icon sets
  const baseIcons = [
    '/manifest.json',
    '/manifest-admin.json',
    '/manifest-partner.json'
  ];
  
  // Add role-specific icons
  if (role === 'partner') {
    return [
      ...baseIcons,
      '/icons/partner/72x72.png',
      '/icons/partner/96x96.png',
      '/icons/partner/128x128.png',
      '/icons/partner/144x144.png',
      '/icons/partner/152x152.png',
      '/icons/partner/192x192.png',
      '/icons/partner/384x384.png',
      '/icons/partner/512x512.png',
      '/icons/partner/maskable-icon-512x512.png'
    ];
  } else {
    // Admin, support, or unknown role
    return [
      ...baseIcons,
      '/icons/admin/72x72.png',
      '/icons/admin/96x96.png',
      '/icons/admin/128x128.png',
      '/icons/admin/144x144.png',
      '/icons/admin/152x152.png',
      '/icons/admin/192x192.png',
      '/icons/admin/384x384.png',
      '/icons/admin/512x512.png',
      '/icons/admin/maskable-icon-512x512.png'
    ];
  }
}