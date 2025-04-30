/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_ZENDESK_API_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  readonly VITE_ANALYTICS_ENABLED: string
  readonly VITE_ENVIRONMENT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Extend Window interface for globals
interface Window {
  gtag: (
    command: string,
    action: string,
    params?: {
      [key: string]: any;
    }
  ) => void;
  
  dataLayer: any[];
  
  voiceflow?: {
    chat: {
      load: (config: any) => void;
      open: () => void;
      close: () => void;
      hide: () => void;
      show: () => void;
    }
  };
  
  // Feature flag system
  setFeatureFlag?: (key: string, value: boolean) => boolean;
}