import type { DisplayOverrideEntry, DisplayOverrideStorage } from '../types/display-override';

/**
 * The channel identifier ui24's admin surfaces (Details, etc.) pass when resolving display
 * overrides. `channel` is a caller-supplied, arbitrary string (see fw24
 * `BaseService.resolveFieldWithDisplayOverrides({ channel })`) — it is NOT derived from a
 * field's own `displayOverride.channels` allowlist, which only constrains which channel values
 * an entity author may legally key entries under (schema validation), not which channel a given
 * UI surface resolves with.
 *
 * ui24 currently has exactly one consumer surface (the admin Details view), so it always
 * resolves with this fixed channel: an entry stored under `fieldPath@admin` applies here, an
 * entry stored under `fieldPath@<other-channel>` (e.g. `fieldPath@public`) does not, and an
 * entry stored under the plain `fieldPath` key (no `@channel` suffix) applies regardless of
 * channel, per `resolveWithDisplayOverrides`'s fallback lookup.
 */
export const ADMIN_DISPLAY_OVERRIDE_CHANNEL = 'admin';

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
