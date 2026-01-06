/**
 * Duration and TTL formatting utilities.
 * Provides consistent duration and time-to-live display across table and detail views.
 * Supports multiple time units (ms, seconds, minutes, hours, days, months, years).
 */

import { IFieldTypeProperties } from '../types/field-config';

/** Duration unit type - matches backend DurationFieldMetadata.durationUnit */
export type DurationUnit = NonNullable<IFieldTypeProperties[ 'durationUnit' ]>;

/** TTL unit type - matches backend TTLFieldMetadata.ttlUnit */
export type TTLUnit = NonNullable<IFieldTypeProperties[ 'ttlUnit' ]>;

/** Duration format type */
export type DurationFormat = NonNullable<IFieldTypeProperties[ 'durationFormat' ]>;

/** TTL format type */
export type TTLFormat = NonNullable<IFieldTypeProperties[ 'ttlFormat' ]>;

/**
 * Formats a duration value to human-readable string.
 * Supports multiple time units and display formats.
 * 
 * @param value - The duration value in the specified unit
 * @param unit - The unit of the input value (default: 'seconds')
 * @param format - Display format: 'auto', 'long', 'short', 'compact' (default: 'auto')
 * @returns Human-readable duration string
 * 
 * @example
 * formatDuration(1500, 'ms', 'auto')          // "1.5s"
 * formatDuration(90, 'seconds', 'auto')       // "1m 30s"
 * formatDuration(2.5, 'hours', 'auto')        // "2h 30m"
 * formatDuration(93784, 'seconds', 'long')    // "1d 2h 3m 4s"
 * formatDuration(93784, 'seconds', 'short')   // "1d 2h"
 * formatDuration(93784, 'seconds', 'compact') // "1d"
 */
export function formatDuration(
  value: unknown,
  unit: DurationUnit = 'seconds',
  format: DurationFormat = 'auto'
): string {
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
    case 'days':
      ms = numValue * 24 * 60 * 60 * 1000;
      break;
    case 'seconds':
    default:
      ms = numValue * 1000;
      break;
  }

  // Handle very small durations (< 1 second)
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  // Calculate time components
  const totalSeconds = Math.floor(ms / 1000);
  const years = Math.floor(totalSeconds / (365 * 24 * 3600));
  const months = Math.floor((totalSeconds % (365 * 24 * 3600)) / (30 * 24 * 3600));
  const days = Math.floor((totalSeconds % (30 * 24 * 3600)) / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Build parts array
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  if (parts.length === 0) {
    return '0s';
  }

  // Apply format
  switch (format) {
    case 'compact':
      // Show only most significant unit
      return parts[ 0 ];
    case 'short':
      // Show top 2 units
      return parts.slice(0, 2).join(' ');
    case 'long':
      // Show all non-zero units
      return parts.join(' ');
    case 'auto':
    default:
      // Auto: Show appropriate units based on magnitude
      if (years > 0 || months > 0) {
        // For year/month durations, show top 3 units
        return parts.slice(0, 3).join(' ');
      } else if (days > 0) {
        // For day durations, show days + hours + minutes
        return parts.slice(0, 3).join(' ');
      } else if (hours > 0) {
        // For hour durations, show hours + minutes + seconds
        return parts.slice(0, 3).join(' ');
      } else {
        // For minute/second durations, show minutes + seconds
        return parts.slice(0, 2).join(' ');
      }
  }
}

/**
 * Formats a TTL (Time To Live) value to human-readable string.
 * TTL is typically a Unix timestamp representing when an item expires.
 * This function calculates the remaining time until expiration.
 * 
 * @param value - The TTL timestamp value
 * @param unit - The unit of the TTL timestamp (default: 'seconds' for Unix timestamps)
 * @param format - Display format: 'auto', 'long', 'short', 'compact' (default: 'auto')
 * @returns Human-readable time remaining (e.g., "5d 3h 15m", "expired", "23h 45m 12s")
 * 
 * @example
 * // Unix timestamp in seconds (common DynamoDB TTL format)
 * formatTTL(1767013339345, 'ms', 'auto')      // "5d 3h 15m" (time until expiration)
 * formatTTL(1735680000, 'seconds', 'long')    // "5d 3h 15m 22s"
 * formatTTL(1735680000, 'seconds', 'short')   // "5d 3h"
 * formatTTL(1735680000, 'seconds', 'compact') // "5d"
 * 
 * @example
 * // Already expired
 * formatTTL(1609459200, 'seconds')   // "expired" (if current time > TTL)
 */
export function formatTTL(
  value: unknown,
  unit: TTLUnit = 'seconds',
  format: TTLFormat = 'auto'
): string {
  if (value === null || value === undefined) {
    return '—';
  }

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) {
    return '—';
  }

  // Convert TTL timestamp to milliseconds
  let ttlMs: number;
  switch (unit) {
    case 'ms':
      ttlMs = numValue;
      break;
    case 'minutes':
      ttlMs = numValue * 60 * 1000;
      break;
    case 'hours':
      ttlMs = numValue * 60 * 60 * 1000;
      break;
    case 'seconds':
    default:
      ttlMs = numValue * 1000;
      break;
  }

  // Calculate remaining time (TTL - now)
  const now = Date.now();
  const remainingMs = ttlMs - now;

  // DEBUG: Log the actual values
  console.log('🔥 TTL DEBUG:', {
    inputValue: numValue,
    unit,
    ttlMs,
    now,
    remainingMs,
    remainingDays: Math.floor(remainingMs / (24 * 60 * 60 * 1000))
  });

  // If already expired
  if (remainingMs <= 0) {
    return 'expired';
  }

  // Calculate time components
  const totalSeconds = Math.floor(remainingMs / 1000);
  const years = Math.floor(totalSeconds / (365 * 24 * 3600));
  const months = Math.floor((totalSeconds % (365 * 24 * 3600)) / (30 * 24 * 3600));
  const days = Math.floor((totalSeconds % (30 * 24 * 3600)) / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Build parts array
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  if (parts.length === 0) {
    return 'expired';
  }

  // Apply format
  switch (format) {
    case 'compact':
      // Show only most significant unit
      return parts[ 0 ];
    case 'short':
      // Show top 2 units
      return parts.slice(0, 2).join(' ');
    case 'long':
      // Show all non-zero units
      return parts.join(' ');
    case 'auto':
    default:
      // Auto: Show appropriate units based on remaining time
      if (years > 0 || months > 0) {
        // For year/month TTL, show top 3 units
        return parts.slice(0, 3).join(' ');
      } else if (days > 0) {
        // For day TTL, show days + hours + minutes
        return parts.slice(0, 3).join(' ');
      } else if (hours > 0) {
        // For hour TTL, show hours + minutes + seconds
        return parts.slice(0, 3).join(' ');
      } else if (minutes > 5) {
        // For longer minutes, show minutes + seconds
        return parts.slice(0, 2).join(' ');
      } else {
        // For short TTL (< 5 minutes), show all remaining units
        return parts.join(' ');
      }
  }
}
