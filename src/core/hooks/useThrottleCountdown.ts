import { useState, useEffect, useCallback, useRef } from 'react';
import { OperationExecutor } from '../services/OperationExecutor';

/**
 * Hook that provides countdown state for throttled operations (#64).
 * Checks for existing cooldown on mount and polls while active.
 *
 * @param operationExecutor - The OperationExecutor instance to check cooldowns on
 * @param operationKey - The operation key (typically the apiUrl)
 * @param enabled - Whether throttle tracking is enabled (true when throttle.cooldownMs is set)
 * @param showCountdown - Whether to display countdown text (from throttle.showCountdown)
 * @returns { isThrottled, remainingSeconds, buttonText, startPolling }
 */
export function useThrottleCountdown(
  operationExecutor: OperationExecutor | null,
  operationKey: string | undefined,
  enabled: boolean = false,
  showCountdown: boolean = true
) {
  const [remainingMs, setRemainingMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const checkCooldown = useCallback(() => {
    if (!operationExecutor || !operationKey || !enabled) {
      setRemainingMs(0);
      stopPolling();
      return;
    }
    const remaining = operationExecutor.getCooldownRemaining(operationKey);
    setRemainingMs(remaining);

    if (remaining <= 0) {
      stopPolling();
    }
  }, [operationExecutor, operationKey, enabled, stopPolling]);

  // Start polling (call after an execution to begin countdown display)
  const startPolling = useCallback(() => {
    if (!enabled || !operationKey) return;
    checkCooldown();
    stopPolling();
    intervalRef.current = setInterval(checkCooldown, 1000);
  }, [enabled, operationKey, checkCooldown, stopPolling]);

  // Check for existing cooldown on mount and when deps change.
  // This handles the case where a modal opens while a previous operation is still in cooldown.
  useEffect(() => {
    if (!operationExecutor || !operationKey || !enabled) return;

    const remaining = operationExecutor.getCooldownRemaining(operationKey);
    if (remaining > 0) {
      setRemainingMs(remaining);
      // Start polling to count down
      stopPolling();
      intervalRef.current = setInterval(checkCooldown, 1000);
    }

    return stopPolling;
  }, [operationExecutor, operationKey, enabled, checkCooldown, stopPolling]);

  const isThrottled = remainingMs > 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const buttonText = isThrottled && showCountdown ? `Wait ${remainingSeconds}s` : undefined;

  return { isThrottled, remainingSeconds, buttonText, startPolling };
}
