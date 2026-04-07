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

export interface ResolveWithDisplayOverridesParams {
  storedValue: unknown;
  overrideMap: DisplayOverrideStorage | undefined;
  fieldPath: string;
  /** When set, tries `fieldPath@channel` before `fieldPath`. */
  channel?: string;
}

export interface ResolveWithDisplayOverridesResult {
  resolvedValue: unknown;
  valueFromOverride: boolean;
  entry?: DisplayOverrideEntry | null;
}

/**
 * Merge stored field data with an optional per-path override map.
 * Visibility-only entries do not replace the value; callers may use `entry?.kind === 'visibility'`.
 */
export function resolveWithDisplayOverrides(
  params: ResolveWithDisplayOverridesParams
): ResolveWithDisplayOverridesResult {
  const { storedValue, overrideMap, fieldPath, channel } = params;
  if (!overrideMap || typeof overrideMap !== 'object') {
    return { resolvedValue: storedValue, valueFromOverride: false };
  }

  const keysToTry: string[] = [];
  if (channel) keysToTry.push(`${fieldPath}@${channel}`);
  keysToTry.push(fieldPath);

  for (const key of keysToTry) {
    if (!Object.prototype.hasOwnProperty.call(overrideMap, key)) continue;
    const raw = (overrideMap as Record<string, unknown>)[ key ];
    const entry = normalizeEntry(raw);
    if (!entry) continue;

    const kind = entry.kind ?? 'value';
    if (kind === 'visibility' || kind === 'format') {
      return { resolvedValue: storedValue, valueFromOverride: false, entry };
    }
    if (entry.value !== undefined) {
      return { resolvedValue: entry.value, valueFromOverride: true, entry };
    }
  }

  return { resolvedValue: storedValue, valueFromOverride: false };
}
