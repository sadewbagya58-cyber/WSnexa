import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wsnexa.app',
  appName: 'WSNexa',
  webDir: 'mobile-dist',
  server: {
    url: 'https://w-snexa.vercel.app',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'w-snexa.vercel.app',
      '*.supabase.co',
      'wfdzjyhgcrcgnjtfgoef.supabase.co',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#09090b',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
