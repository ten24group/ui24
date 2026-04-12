import type { Dayjs } from 'dayjs';
import { dayjsCustom } from '../dayjs';

/**
 * Whether the IANA zone id is the canonical UTC zone (not “offset 0” elsewhere).
 * Used to decide if a separate “UTC” line is meaningful vs “Original” in source zone.
 */
export function isUtcZoneId(zone: string | null | undefined): boolean {
  if (zone == null || String(zone).trim() === '') return true;
  const u = String(zone).trim().toUpperCase();
  if (u === 'UTC' || u === 'GMT') return true;
  if (u === 'ETC/UTC' || u === 'ETC/GMT') return true;
  if (u === 'ETC/GMT+0' || u === 'ETC/GMT-0') return true;
  return false;
}

/**
 * Browser IANA timezone (e.g. "America/New_York") or "UTC" if unavailable.
 */
export function guessBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function isNumericTimestampString(s: string): boolean {
  const t = s.trim();
  // Epoch ms is typically 13 digits; avoid interpreting "2024" or small numbers as timestamps
  if (!/^\d+$/.test(t)) return false;
  if (t.length >= 12) return true;
  return t.startsWith('0') && t.length > 1;
}

/**
 * Parse a stored date/time value to a UTC Dayjs instant for formatting.
 *
 * - Epoch ms numbers and numeric strings → UTC instant
 * - ISO strings with Z/offset → that instant
 * - Legacy values whose string form starts with "0" (older timestamp encoding) → parsed as ms
 * - Naive date/time strings → interpreted in `sourceZone` (field timezone or UTC)
 */
export function parseTemporalToUtc(
  value: string | number | Date | Dayjs | null | undefined,
  sourceZone = 'UTC'
): Dayjs | null {
  if (value === null || value === undefined || value === '') return null;

  if (dayjsCustom.isDayjs?.(value)) {
    const d = value as Dayjs;
    return d.isValid() ? d.utc() : null;
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return dayjsCustom.utc(value);
  }

  if (value instanceof Date) {
    return dayjsCustom.utc(value);
  }

  const sRaw = String(value);
  if (sRaw === '') return null;

  if (isNumericTimestampString(sRaw)) {
    const n = parseInt(sRaw, 10);
    if (sRaw.startsWith('0') && sRaw.length > 1) {
      return dayjsCustom.utc(new Date(n).toISOString());
    }
    return dayjsCustom.utc(n);
  }

  const s = sRaw.trim();

  if (/[zZ]$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s)) {
    return dayjsCustom(s).utc();
  }

  try {
    const ymdOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (ymdOnly) {
      const d = dayjsCustom.tz(`${s} 00:00:00`, sourceZone).utc();
      return d.isValid() ? d : null;
    }

    const d = dayjsCustom.tz(s, sourceZone).utc();
    return d.isValid() ? d : null;
  } catch {
    return null;
  }
}
