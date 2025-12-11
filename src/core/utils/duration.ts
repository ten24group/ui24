/**
 * Duration formatting utilities.
 * Provides consistent duration display across table and detail views.
 */

import { IFieldTypeProperties } from '../types/field-config';

/** Duration unit type - matches backend DurationFieldMetadata.durationUnit */
export type DurationUnit = NonNullable<IFieldTypeProperties[ 'durationUnit' ]>;

/**
 * Formats a duration value to human-readable string.
 * 
 * @param value - The duration value in the specified unit
 * @param unit - The unit of the input value (default: 'seconds')
 * @returns Human-readable duration string (e.g., "1h 30m 45s", "250ms")
 * 
 * @example
 * formatDuration(1500, 'ms')      // "1.5s"
 * formatDuration(90, 'seconds')   // "1m 30s"
 * formatDuration(2.5, 'hours')    // "2h 30m 0s"
 */
export function formatDuration(value: unknown, unit: DurationUnit = 'seconds'): string {
  if (value === null || value === undefined) {
    return '—';
  }

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) {
    return '—';
  }

  // Convert to milliseconds first based on input unit
  let ms: number;
  switch (unit) {
    case 'ms':
      ms = numValue;
      break;
    case 'minutes':
      ms = numValue * 60 * 1000;
      break;
    case 'hours':
      ms = numValue * 60 * 60 * 1000;
      break;
    case 'seconds':
    default:
      ms = numValue * 1000;
      break;
  }

  // Format as human-readable
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const remainingMs = ms % 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  if (s > 0 && remainingMs >= 100) return `${s}.${Math.floor(remainingMs / 100)}s`;
  if (s > 0) return `${s}s`;
  return `${Math.round(ms)}ms`;
}

