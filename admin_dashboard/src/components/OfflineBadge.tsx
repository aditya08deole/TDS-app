/**
 * OfflineBadge - Persistent indicator of offline mode
 * Shows when app is working without network connection
 * ISSUE-017: Add persistent offline indicator
 */

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineBadge() {
  // @ts-ignore
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  useEffect(() => {
    // Set up online/offline listeners
    const handleOnline = () => {
      console.log('📡 App went back online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('🔌 App went offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check cache age periodically
    const interval = setInterval(async () => {
      if (!isOnline) {
        try {
          const { getOfflineStatus } = await import('../lib/offlineStorage');
          const status = await getOfflineStatus();
          if (status.cacheAge !== null) {
            setCacheAge(status.cacheAge);
          }
        } catch (error) {
          console.error('Failed to get offline status:', error);
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  if (isOnline) {
    return null; // Don't show badge when online
  }

  // Format cache age
  let ageText = '';
  if (cacheAge !== null) {
    const seconds = Math.floor(cacheAge / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      ageText = `(${minutes} min ago)`;
    } else {
      ageText = `(${seconds} sec ago)`;
    }
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 
                   rounded-lg bg-orange-500/10 border border-orange-500/30 
                   backdrop-blur-sm"
      role="status"
      aria-label="Offline mode"
    >
      <WifiOff className="w-4 h-4 text-orange-500 animate-pulse" />
      <div className="text-sm">
        <span className="font-medium text-orange-500">Offline Mode</span>
        {ageText && <span className="text-orange-400/70 text-xs ml-2">{ageText}</span>}
      </div>
    </div>
  );
}

/**
 * Online indicator badge (opposite of offline badge)
 * Shows confirmation when app reconnects after being offline
 */
export function OnlineIndicator() {
  // @ts-ignore
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowConfirmation(true);
      // Hide confirmation after 2 seconds
      const timer = setTimeout(() => setShowConfirmation(false), 2000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowConfirmation(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showConfirmation) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 
                   rounded-lg bg-green-500/10 border border-green-500/30 
                   backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 
                   duration-300"
      role="status"
      aria-label="Back online"
    >
      <Wifi className="w-4 h-4 text-green-500" />
      <span className="text-sm font-medium text-green-500">Back online!</span>
    </div>
  );
}
