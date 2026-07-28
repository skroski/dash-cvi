import { useState, useEffect, useCallback, useRef } from 'react';

export interface PauseInfo {
  ttl: number; // seconds remaining: -1 = indefinite, >= 0 = limited
}

// Map: phone (digits only, e.g. "5511984601081") → PauseInfo
export type PauseStatusMap = Map<string, PauseInfo>;

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useRedisPauseStatus(): PauseStatusMap {
  const [statusMap, setStatusMap] = useState<PauseStatusMap>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/redis-pause-status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.error('[useRedisPauseStatus] API returned', response.status);
        return;
      }

      const data = await response.json();

      if (!data?.success || !data?.data) return;

      const map: PauseStatusMap = new Map();

      for (const [phone, info] of Object.entries(
        data.data as Record<string, { ttl: number }>
      )) {
        // phone from Redis is already "5511XXXXXXXX" (digits + country code)
        // normalize: keep only digits
        const normalizedPhone = phone.replace(/\D/g, '');
        map.set(normalizedPhone, { ttl: info.ttl });
      }

      setStatusMap(map);
    } catch (err) {
      console.error('[useRedisPauseStatus] Unexpected error:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  return statusMap;
}

/**
 * Formats seconds into a human-readable string.
 * e.g. 3661 → "1h 1min", 90 → "1min 30s", -1 → "indefinido"
 */
export function formatTtlDuration(ttl: number): string {
  if (ttl < 0) return 'indefinido'; // no expiry
  if (ttl === 0) return '< 1s';

  const days = Math.floor(ttl / 86400);
  const hours = Math.floor((ttl % 86400) / 3600);
  const minutes = Math.floor((ttl % 3600) / 60);
  const seconds = ttl % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  if (minutes > 0) return seconds > 0 ? `${minutes}min ${seconds}s` : `${minutes}min`;
  return `${seconds}s`;
}
