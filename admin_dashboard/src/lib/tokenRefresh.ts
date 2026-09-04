/**
 * Token Refresh & Session Management Service
 * Fix #11: Refresh auth token before expiry and restore session on app start
 *
 * Implements:
 * - Automatic token refresh 5 minutes before expiry
 * - Session restoration on app start
 * - Token expiry tracking
 * - Logout handling
 */

// import { auth } from './firebase';
import type { User } from 'firebase/auth';
import { storage } from './storage';

interface TokenInfo {
  token: string;
  expiresAt: number;
  issuedAt: number;
}

const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh 5 minutes before expiry
let refreshTimeoutId: number | null = null;
let tokenRefreshListeners: Array<(token: string) => void> = [];

/**
 * Initialize token refresh on login
 */
export async function initTokenRefresh(user: User): Promise<void> {
  try {
    console.log('[TOKEN] Initializing token refresh for user:', user.email);
    
    // Get current ID token
    const token = await user.getIdToken();
    
    // Decode and store token info
    const tokenInfo = decodeToken(token);
    await storage.set('auth_token_info', JSON.stringify(tokenInfo));
    
    console.log(`[TOKEN] Token expires at: ${new Date(tokenInfo.expiresAt).toLocaleString()}`);

    // Schedule refresh
    await scheduleTokenRefresh(user);
  } catch (error) {
    console.error('[TOKEN] Failed to initialize token refresh:', error);
  }
}

/**
 * Manually refresh the token
 */
export async function refreshAuthToken(user: User): Promise<string> {
  try {
    console.log('[TOKEN-REFRESH] Refreshing token...');
    
    const newToken = await user.getIdToken(true); // Force refresh
    
    const tokenInfo = decodeToken(newToken);
    await storage.set('auth_token_info', JSON.stringify(tokenInfo));
    
    console.log(`✅ [TOKEN-REFRESH] Token refreshed, new expiry: ${new Date(tokenInfo.expiresAt).toLocaleString()}`);
    
    // Notify listeners
    tokenRefreshListeners.forEach(listener => listener(newToken));
    
    // Reschedule next refresh
    await scheduleTokenRefresh(user);

    return newToken;
  } catch (error) {
    console.error('❌ [TOKEN-REFRESH] Failed to refresh token:', error);
    throw error;
  }
}

/**
 * Schedule token refresh
 */
async function scheduleTokenRefresh(user: User): Promise<void> {
  // Clear existing timeout
  if (refreshTimeoutId !== null) {
    clearTimeout(refreshTimeoutId);
  }

  try {
    // Must go through the storage abstraction, not localStorage directly —
    // on native (Android/iOS) auth_token_info is written via Capacitor
    // Preferences, not localStorage, so a raw localStorage read here always
    // returned null on native and refresh never got scheduled, silently
    // logging users out ~5 minutes before their real token expiry.
    const tokenInfo = await storage.get<TokenInfo>('auth_token_info');
    if (!tokenInfo) {
      console.warn('[TOKEN] No token info found, cannot schedule refresh');
      return;
    }

    const now = Date.now();
    const expiresIn = tokenInfo.expiresAt - now;
    
    // Refresh 5 minutes before expiry
    const refreshIn = expiresIn - TOKEN_REFRESH_INTERVAL;
    
    if (refreshIn > 0) {
      console.log(`[TOKEN] Scheduling refresh in ${Math.round(refreshIn / 1000 / 60)} minutes`);
      
      refreshTimeoutId = window.setTimeout(() => {
        console.log('[TOKEN] Auto-refresh triggered');
        refreshAuthToken(user).catch(err => {
          console.error('[TOKEN] Auto-refresh failed:', err);
          // Try again in 1 minute
          scheduleTokenRefresh(user);
        });
      }, refreshIn);
    } else if (refreshIn > -60000) {
      // Token expires within next minute - refresh immediately
      console.log('[TOKEN] Token expiring soon, refreshing immediately');
      refreshAuthToken(user).catch(err => {
        console.error('[TOKEN] Immediate refresh failed:', err);
      });
    } else {
      // Token already expired
      console.warn('[TOKEN] Token already expired');
    }
  } catch (error) {
    console.error('[TOKEN] Failed to schedule refresh:', error);
  }
}

/**
 * Decode JWT token to get expiration
 */
function decodeToken(token: string): TokenInfo {
  try {
    // Split JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decode payload — parts.length === 3 is guaranteed above, so parts[1] exists.
    const payload = JSON.parse(atob(parts[1]!));
    
    const expiresAt = (payload.exp || 0) * 1000; // Convert to milliseconds
    const issuedAt = (payload.iat || 0) * 1000;

    return { token, expiresAt, issuedAt };
  } catch (error) {
    console.error('[TOKEN] Failed to decode token:', error);
    throw error;
  }
}

/**
 * Get remaining token validity time in seconds
 */
export async function getTokenTimeRemaining(): Promise<number> {
  try {
    // storage.get<T>() already JSON-parses the stored value — do not
    // JSON.parse() it again here (that would throw on the already-parsed
    // object and silently caught below, making this always return 0).
    const tokenInfo = await storage.get<TokenInfo>('auth_token_info');
    if (!tokenInfo) return 0;

    const remaining = tokenInfo.expiresAt - Date.now();
    
    return Math.max(0, Math.floor(remaining / 1000));
  } catch (error) {
    console.error('[TOKEN] Failed to get remaining time:', error);
    return 0;
  }
}

/**
 * Check if token is still valid
 */
export async function isTokenValid(): Promise<boolean> {
  try {
    const remaining = await getTokenTimeRemaining();
    return remaining > 0;
  } catch {
    return false;
  }
}

/**
 * Subscribe to token refresh events
 */
export function onTokenRefreshed(callback: (token: string) => void): () => void {
  tokenRefreshListeners.push(callback);
  
  // Return unsubscribe function
  return () => {
    tokenRefreshListeners = tokenRefreshListeners.filter(listener => listener !== callback);
  };
}

/**
 * Restore session on app start
 */
export async function restoreSession(): Promise<boolean> {
  try {
    console.log('[SESSION] Attempting to restore session...');
    
    // Firebase automatically restores the session via onAuthStateChanged
    // This is just for additional verification
    
    const isValid = await isTokenValid();
    
    if (!isValid) {
      console.log('[SESSION] Token expired, user needs to re-login');
      await storage.set('session_status', 'expired');
      return false;
    }

    console.log('✅ [SESSION] Session restored successfully');
    await storage.set('session_status', 'active');
    return true;
  } catch (error) {
    console.error('❌ [SESSION] Failed to restore session:', error);
    return false;
  }
}

/**
 * Clear session on logout
 * ISSUE-012: Comprehensive cache clearing for security
 * Clears ALL cached data, not just token, to prevent data leakage to next user
 */
export async function clearSession(): Promise<void> {
  try {
    console.log('[SESSION] Clearing session and all cache...');
    
    // Clear timeout
    if (refreshTimeoutId !== null) {
      clearTimeout(refreshTimeoutId);
      refreshTimeoutId = null;
    }

    // Clear all token data from Capacitor storage and localStorage
    console.log('[SESSION] Clearing Capacitor storage...');
    await storage.clear(); // Clears ALL Capacitor storage on native, ALL localStorage on web
    
    // Also explicitly clear localStorage for web platform
    console.log('[SESSION] Clearing localStorage...');
    localStorage.clear();

    // Clear offline cache (device cache, alerts, sensor data)
    console.log('[SESSION] Clearing offline cache...');
    const { clearOfflineCache } = await import('./offlineStorage');
    await clearOfflineCache();

    // Clear in-memory query cache from React Query
    console.log('[SESSION] Clearing query cache...');
    const { clearQueryCache } = await import('./queryClient');
    clearQueryCache();

    console.log('✅ [SESSION] Session and all cache completely cleared for logout');
  } catch (error) {
    console.error('❌ [SESSION] Failed to clear session:', error);
    // Don't rethrow - logout should succeed even if cache clearing fails
  }
}

/**
 * Get session status
 */
export async function getSessionStatus(): Promise<'active' | 'expired' | 'cleared' | 'unknown'> {
  try {
    const status = await storage.get('session_status');
    return (status as any) || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Log token status for debugging
 */
export async function debugTokenStatus(): Promise<void> {
  try {
    const remaining = await getTokenTimeRemaining();
    const status = await getSessionStatus();
    const tokenInfo = await storage.get<TokenInfo>('auth_token_info');

    console.log('[TOKEN-DEBUG]', {
      remaining_seconds: remaining,
      session_status: status,
      token_info: tokenInfo ? {
        issued_at: new Date(tokenInfo.issuedAt).toLocaleString(),
        expires_at: new Date(tokenInfo.expiresAt).toLocaleString(),
      } : null
    });
  } catch (error) {
    console.error('[TOKEN-DEBUG] Failed:', error);
  }
}

export default {
  initTokenRefresh,
  refreshAuthToken,
  getTokenTimeRemaining,
  isTokenValid,
  onTokenRefreshed,
  restoreSession,
  clearSession,
  getSessionStatus,
  debugTokenStatus,
};
