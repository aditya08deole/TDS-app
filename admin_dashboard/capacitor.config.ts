import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.evaratds.app',
  appName: 'EvaraTDS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Firebase Authentication
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
    // Push Notifications
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Storage for offline data
    Storage: {
      group: 'group.com.evaratds.app',
    },
    // Filesystem for exports
    Filesystem: {
      directory: 'Documents',
      // Android 10+ requires explicit permissions for file access
      permissions: {
        read: ['READ_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES'],
        write: ['WRITE_EXTERNAL_STORAGE'],
      }
    },
    // Haptics for vibration
    Haptics: {},
    // Geolocation for map
    Geolocation: {
      permissions: ['coarseLocation', 'fineLocation'],
    },
    // App lifecycle
    App: {
      pauseOnEnteringBackground: true,
      resumeOnEnteringForeground: true,
    },
  }
};

export default config;
