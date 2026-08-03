import { useEffect, useState } from 'react';

export interface TelemetryEventData {
  device_id: string;
  tds: number;
  temperature?: number;
  voltage?: number;
  status: string;
  recorded_at: string;
}

/**
 * Custom React Hook for subscribing to real-time Server-Sent Events (SSE) from the backend.
 * Provides live telemetry readings without constant polling.
 */
export function useLiveEvents() {
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryEventData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const eventSource = new EventSource(`${apiBase}/api/events/live`);

    eventSource.addEventListener('connected', () => {
      setIsConnected(true);
    });

    eventSource.addEventListener('telemetry', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as TelemetryEventData;
        setLatestTelemetry(data);
      } catch (err) {
        console.error('❌ Error parsing live SSE telemetry data:', err);
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  return { latestTelemetry, isConnected };
}
