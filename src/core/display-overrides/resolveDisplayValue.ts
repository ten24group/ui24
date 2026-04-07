import type { DisplayOverrideEntry, DisplayOverrideStorage } from '../types/display-override';

function normalizeEntry(raw: unknown): DisplayOverrideEntry | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw) && raw !== null) {
    const o = raw as Record<string, unknown>;
    if ('value' in o || 'kind' in o || 'channel' in o) {
      return raw as DisplayOverrideEntry;
    }
  }
  return { value: raw, kind: 'value' };
}

export interface ResolveDisplayValueParams {
  canonical: unknown;
  overrides: DisplayOverrideStorage | undefined;
  path: string;
  /** When set, tries `path@channel` before `path`. */
  channel?: string;
}

export interface ResolveDisplayValueResult {
  effective: unknown;
  hasOverride: boolean;
  entry?: DisplayOverrideEntry | null;
}

/**
 * Merge canonical field data with an optional per-path override map.
 * Visibility-only entries do not replace the value; callers may use `entry.kind === 'visibility'`.
 */
export function resolveDisplayValueForPath(params: ResolveDisplayValueParams): ResolveDisplayValueResult {
  const { canonical, overrides, path, channel } = params;
  if (!overrides || typeof overrides !== 'object') {
    return { effective: canonical, hasOverride: false };
  }

  const keysToTry: string[] = [];
  if (channel) keysToTry.push(`${path}@${channel}`);
  keysToTry.push(path);

  for (const key of keysToTry) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue;
    const raw = (overrides as Record<string, unknown>)[ key ];
    const entry = normalizeEntry(raw);
    if (!entry) continue;

    const kind = entry.kind ?? 'value';
    if (kind === 'visibility' || kind === 'format') {
      return { effective: canonical, hasOverride: false, entry };
    }
    if (entry.value !== undefined) {
      return { effective: entry.value, hasOverride: true, entry };
    }
  }

  return { effective: canonical, hasOverride: false };
}
