import { useEffect, useState, useRef } from 'react';

export interface TelemetryEventData {
  device_id: string;
  tds: number;
  temperature?: number;
  voltage?: number;
  status: string;
  recorded_at: string;
}

const MAX_RECONNECT_DELAY_MS = 30_000; // cap at 30 seconds
const BASE_RECONNECT_DELAY_MS = 1_000; // start at 1 second

/**
 * Custom React Hook for subscribing to real-time Server-Sent Events (SSE) from the backend.
 * Provides live telemetry readings without constant polling.
 * Auto-reconnects with exponential backoff after network drops.
 */
export function useLiveEvents() {
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryEventData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;

      const apiBase = import.meta.env.VITE_API_URL || '';
      const es = new EventSource(`${apiBase}/api/events/live`);
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        if (isCancelled) return;
        setIsConnected(true);
        retryCountRef.current = 0; // reset backoff on successful connection
      });

      es.addEventListener('telemetry', (e: MessageEvent) => {
        if (isCancelled) return;
        try {
          const data = JSON.parse(e.data) as TelemetryEventData;
          setLatestTelemetry(data);
        } catch (err) {
          console.error('❌ Error parsing live SSE telemetry data:', err);
        }
      });

      es.onerror = () => {
        if (isCancelled) return;
        setIsConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s ... up to 30s
        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * Math.pow(2, retryCountRef.current),
          MAX_RECONNECT_DELAY_MS
        );
        retryCountRef.current += 1;

        console.warn(`[SSE] Connection lost. Reconnecting in ${delay / 1000}s (attempt ${retryCountRef.current})...`);
        retryTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      isCancelled = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  return { latestTelemetry, isConnected };
}
