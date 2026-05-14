import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

/**
 * Unified Storage Layer — EvaraTDS Production Standard
 * 
 * Uses @capacitor/preferences on Native (Android/iOS) for reliable persistence
 * even when the WebView is cleared. Falls back to localStorage on Web.
 */

const isNative = Capacitor.isNativePlatform();

export const storage = {
  /**
   * Set a value in storage
   */
  async set(key: string, value: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (isNative) {
      await Preferences.set({ key, value: stringValue });
    } else {
      localStorage.setItem(key, stringValue);
    }
  },

  /**
   * Get a value from storage
   */
  async get<T = string>(key: string): Promise<T | null> {
    let value: string | null = null;

    if (isNative) {
      const result = await Preferences.get({ key });
      value = result.value;
    } else {
      value = localStorage.getItem(key);
    }

    if (!value) return null;

    try {
      // Try to parse as JSON, if it fails, return as string
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  /**
   * Remove a key
   */
  async remove(key: string): Promise<void> {
    if (isNative) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },

  /**
   * Clear all app data
   */
  async clear(): Promise<void> {
    if (isNative) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
  }
};
