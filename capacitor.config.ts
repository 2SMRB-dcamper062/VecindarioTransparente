import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vecindariotransparente.app',
  appName: 'VecindarioTransparente',
  webDir: 'dist',
  server: {
    url: 'https://passenger-script-strung.ngrok-free.dev/',
    cleartext: true,
    allowNavigation: ['passenger-script-strung.ngrok-free.dev']
  }
};

export default config;