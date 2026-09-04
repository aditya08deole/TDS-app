/**
 * Firebase Remote Config — Industry Standard Dynamic Configuration
 *
 * Allows runtime updates of app config (like the backend API URL)
 * without requiring an APK rebuild or Play Store update.
 *
 * Free tier: Unlimited fetches on Firebase Spark plan.
 */
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { app } from './firebase';

/**
 * Detect if the app is running inside a Capacitor native container
 * (iOS or Android APK). In that environment, `window.location.hostname`
 * resolves to "localhost" but it's actually a WebView — the device cannot
 * reach the dev server, so we must always use the Railway production URL.
 */
const isCapacitorNative = typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
   window.location.protocol === 'ionic:' ||
   (window as any)?.Capacitor?.isNativePlatform?.());

/** Railway production backend — the single source of truth for native builds */
const RAILWAY_URL = 'https://graceful-vitality-production-e097.up.railway.app';

// Fallback values — used if Remote Config is unavailable (e.g., no internet on first launch)
const DEFAULTS: { api_url: string } = {
  api_url: isCapacitorNative
    ? RAILWAY_URL                                               // native APK → always Railway
    : import.meta.env.DEV
      ? 'http://localhost:5000'                                 // local dev → local server
      : (import.meta.env.VITE_API_URL || RAILWAY_URL),         // web prod → env var or Railway
};

let _resolvedApiUrl: string | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Initialize Remote Config and fetch latest values.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initRemoteConfig(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const remoteConfig = getRemoteConfig(app);

      // Set default values so the app works without internet
      remoteConfig.defaultConfig = DEFAULTS;

      // Cache for 1 hour in production, 0 in dev for instant updates
      remoteConfig.settings.minimumFetchIntervalMillis =
        import.meta.env.DEV ? 0 : 3600000; // 1 hour

      // Fetch & activate — non-blocking, falls back to defaults on error
      await fetchAndActivate(remoteConfig);

      const fetchedUrl = getValue(remoteConfig, 'api_url').asString();
      _resolvedApiUrl = fetchedUrl || DEFAULTS.api_url;

      console.log(`✅ Remote Config loaded. API: ${_resolvedApiUrl}`);
    } catch {
      // Gracefully fall back to default — app still works
      _resolvedApiUrl = DEFAULTS.api_url;
      console.warn('⚠️ Remote Config unavailable, using fallback API URL:', _resolvedApiUrl);
    }
  })();

  return _initPromise;
}

/**
 * Get the resolved API base URL.
 * Always call `initRemoteConfig()` before using this.
 */
export function getApiBaseUrl(): string {
  return _resolvedApiUrl || DEFAULTS.api_url;
}
