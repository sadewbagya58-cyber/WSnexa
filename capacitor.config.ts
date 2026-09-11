import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://w-snexa.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.wsnexa.app',
  appName: 'WSNexa',
  webDir: 'mobile-dist',
  server: {
    url: serverUrl,
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'w-snexa.vercel.app',
      '*.vercel.app',
      '*.supabase.co',
      'localhost',
      '10.0.2.2',
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
