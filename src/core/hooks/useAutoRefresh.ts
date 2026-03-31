import { useEffect, useRef, useState, useCallback } from 'react';

export type AutoRefreshInterval = 10 | 20 | 30 | 60 | 120 | 300; // seconds: 10s, 20s, 30s, 1m, 2m, 5m

export interface UseAutoRefreshOptions {
  onRefresh: () => void;
  enabled?: boolean;
  defaultInterval?: AutoRefreshInterval;
}

export interface UseAutoRefreshReturn {
  isEnabled: boolean;
  interval: AutoRefreshInterval;
  timeUntilRefresh: number;
  toggleEnabled: () => void;
  setInterval: (interval: AutoRefreshInterval) => void;
  manualRefresh: () => void;
}

/**
 * Hook for automatic periodic refresh functionality
 * 
 * Features:
 * - Configurable refresh intervals (10s to 5m)
 * - Enable/disable toggle
 * - Countdown timer display
 * - Manual refresh trigger
 * - Pause on document visibility change
 * - Clean cleanup on unmount
 * 
 * @example
 * const { isEnabled, interval, timeUntilRefresh, toggleEnabled, setInterval } = useAutoRefresh({
 *   onRefresh: fetchData,
 *   enabled: false,
 *   defaultInterval: 30
 * });
 */
export const useAutoRefresh = ({
  onRefresh,
  enabled = false,
  defaultInterval = 30
}: UseAutoRefreshOptions): UseAutoRefreshReturn => {
  const [ isEnabled, setIsEnabled ] = useState(enabled);
  const [ intervalSeconds, setIntervalSeconds ] = useState<AutoRefreshInterval>(defaultInterval);
  const [ timeUntilRefresh, setTimeUntilRefresh ] = useState<number>(defaultInterval);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);

  // Keep onRefresh ref up to date
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [ onRefresh ]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start auto-refresh — single interval drives both countdown and refresh
  // to prevent the two timers from drifting apart.
  const start = useCallback(() => {
    cleanup();

    setTimeUntilRefresh(intervalSeconds);

    let remaining = intervalSeconds;
    countdownIntervalRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        onRefreshRef.current();
        remaining = intervalSeconds;
      }
      setTimeUntilRefresh(remaining);
    }, 1000);
  }, [ intervalSeconds, cleanup ]);

  // Effect to start/stop based on enabled state and interval
  useEffect(() => {
    if (isEnabled) {
      start();
    } else {
      cleanup();
      setTimeUntilRefresh(intervalSeconds);
    }

    return cleanup;
  }, [ isEnabled, intervalSeconds, start, cleanup ]);

  // Pause auto-refresh when document is hidden (user switched tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isEnabled) {
        cleanup();
      } else if (!document.hidden && isEnabled) {
        start();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ isEnabled, start, cleanup ]);

  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  const changeInterval = useCallback((newInterval: AutoRefreshInterval) => {
    setIntervalSeconds(newInterval);
    setTimeUntilRefresh(newInterval);
  }, []);

  const manualRefresh = useCallback(() => {
    onRefreshRef.current();
    if (isEnabled) {
      start();
    }
  }, [ isEnabled, start ]);

  return {
    isEnabled,
    interval: intervalSeconds,
    timeUntilRefresh,
    toggleEnabled,
    setInterval: changeInterval,
    manualRefresh
  };
};
