import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geofield.app',
  appName: '野外调查助手',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SQLite: {
      iosDatabaseLocation: 'Library/FieldSurveyHelper',
      androidIsEncryption: false,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#15803d',
    },
  },
};

export default config;
