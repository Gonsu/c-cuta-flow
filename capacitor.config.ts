import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.optimizacionRed.gpsnav',
  appName: 'UFPS Transit',
  webDir: 'dist',
  server: {
    url: 'https://52447adc-a349-4b44-9ccd-d31ddbf14c68.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#8A1538',
      showSpinner: false,
    },
  },
};

export default config;
