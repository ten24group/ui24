import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Countdown hook for error-specific retry delay (#58).
 *
 * After a failed form submission, call `startRetryCountdown(delaySeconds)` to
 * disable the submit button and display "Retry in Xs" until the countdown expires.
 *
 * This is intentionally separate from `useThrottleCountdown`:
 *   - throttle = cooldown after any execution (success OR failure)
 *   - retry countdown = pause specifically after an error before the user can retry
 *
 * @example
 * const { isRetrying, retryText, startRetryCountdown } = useRetryCountdown();
 *
 * // In onError callback:
 * if (errorHandling?.retryDelay) startRetryCountdown(errorHandling.retryDelay);
 *
 * // In button props:
 * <Button disabled={isRetrying}>{retryText ?? 'Save'}</Button>
 */
export function useRetryCountdown() {
  const [remainingMs, setRemainingMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Start a countdown for `delaySeconds` seconds. Replaces any in-progress countdown. */
  const startRetryCountdown = useCallback(
    (delaySeconds: number) => {
      if (delaySeconds <= 0) return;
      const expiresAt = Date.now() + delaySeconds * 1000;
      setRemainingMs(delaySeconds * 1000);
      stopPolling();
      intervalRef.current = setInterval(() => {
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
          setRemainingMs(0);
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          setRemainingMs(remaining);
        }
      }, 250); // 250 ms for a smooth single-second tick
    },
    [stopPolling]
  );

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  const isRetrying = remainingMs > 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const retryText = isRetrying ? `Retry in ${remainingSeconds}s` : undefined;

  return { isRetrying, remainingSeconds, retryText, startRetryCountdown };
}
