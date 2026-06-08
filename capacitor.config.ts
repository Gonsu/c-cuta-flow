import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.optimizacionRed.gpsnav',
  appName: 'UFPS Transit',
  webDir: 'dist',
  backgroundColor: '#8A1538',
  server: {
    url: 'https://52447adc-a349-4b44-9ccd-d31ddbf14c68.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#8A1538',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#8A1538',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#8A1538',
      overlaysWebView: true,
    },
  },
};

export default config;
