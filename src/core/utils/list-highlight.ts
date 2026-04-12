/**
 * Post-save “recent” UX: response id extraction, DOM/CSS helpers, and mutation-touch config helpers.
 * Handoff storage lives in `recent-save-handoff-store.ts`.
 */

import type { IRecentMutationTouchConfig } from '../types/field-config';

/** Default duration for row highlight, banner, etc. (~2.5 min). */
export const UI24_DEFAULT_RECENT_SAVE_UI_MS = 150_000;

export type RecentMutationTouchInput = boolean | IRecentMutationTouchConfig | undefined;

export function resolveRecentMutationTouchConfig(
  config: RecentMutationTouchInput,
): { enabled: boolean; durationMs: number } {
  const d = UI24_DEFAULT_RECENT_SAVE_UI_MS;
  if (config === false) return { enabled: false, durationMs: d };
  if (config === undefined || config === true) return { enabled: true, durationMs: d };
  return {
    enabled: config.enabled !== false,
    durationMs: config.durationMs ?? d,
  };
}

/** CSS class: highlighted table row */
export const UI24_RECENT_SAVE_HIGHLIGHT_ROW_CLASS = 'ui24-table-row--recent-save-highlight';

/** CSS class: highlighted card in card grid */
export const UI24_RECENT_SAVE_HIGHLIGHT_CARD_CLASS = 'ui24-card--recent-save-highlight';

/**
 * Card grid: `Col` sets this attribute to the record id for scroll-into-view.
 * Use as `[UI24_RECENT_HIGHLIGHT_DATA_ATTR]="id"` in JSX spread.
 */
export const UI24_RECENT_HIGHLIGHT_DATA_ATTR = 'data-ui24-recent-highlight';

function extractRecordIdFromPlainObject(
  o: Record<string, unknown>,
  entityName?: string
): string | undefined {
  const candidates: string[] = [];
  if (entityName) {
    const lower = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    candidates.push(`${lower}Id`, `${entityName}Id`);
  }
  candidates.push('id', 'entityId');
  for (const k of candidates) {
    const v = o[ k ];
    if (v != null && String(v).length > 0) return String(v);
  }
  for (const k of Object.keys(o)) {
    if ((k.endsWith('Id') || k.endsWith('ID')) && o[ k ] != null && String(o[ k ]).length > 0) {
      return String(o[ k ]);
    }
  }
  return undefined;
}

/**
 * Best-effort ID from a mutation success payload (already unwrapped by responseKey).
 * Also checks one level of nesting (`{ post: { postId } }`, `{ data: { id } }`) and the first array element.
 */
export function extractRecordIdFromMutationResponse(
  data: unknown,
  entityName?: string
): string | undefined {
  if (data == null) return undefined;

  if (Array.isArray(data) && data.length > 0) {
    const first = data[ 0 ];
    if (first != null && typeof first === 'object') {
      return extractRecordIdFromMutationResponse(first, entityName);
    }
    return undefined;
  }

  if (typeof data !== 'object') return undefined;
  const o = data as Record<string, unknown>;

  const direct = extractRecordIdFromPlainObject(o, entityName);
  if (direct) return direct;

  for (const v of Object.values(o)) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      const nested = extractRecordIdFromPlainObject(v as Record<string, unknown>, entityName);
      if (nested) return nested;
    }
  }

  return undefined;
}

/**
 * ID for post-save handoff: prefer response body, then route params (`:id`, `{entity}Id`)
 * when the API returns a minimal payload (common on PATCH).
 */
export function resolveRecordIdForRecentSaveHandoff(
  data: unknown,
  entityName: string | undefined,
  routeParams?: Record<string, unknown>
): string | undefined {
  const fromPayload = extractRecordIdFromMutationResponse(data, entityName);
  if (fromPayload) return fromPayload;
  if (!routeParams || typeof routeParams !== 'object') return undefined;
  const rp = routeParams as Record<string, unknown>;
  if (rp.id != null && String(rp.id).length > 0) return String(rp.id);
  if (entityName) {
    const lower = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    const named = rp[ `${lower}Id` ] ?? rp[ `${entityName}Id` ];
    if (named != null && String(named).length > 0) return String(named);
  }
  return undefined;
}

/**
 * List/card rows from {@link useTable} store the Ant Design row key under a synthetic field
 * (`__recordIdentifierKey__`) whose value is `JSON.stringify([{ [dataIndex]: id }, …])`.
 * The recent-mutation registry and API responses use the **plain** entity id, so comparing
 * `record.__raw__[__recordIdentifierKey__]` fails (undefined). This extracts the same string
 * the backend uses.
 */
export function getStableTableRecordId(
  record: Record<string, unknown>,
  recordIdentifierKey: string
): string {
  const synthetic = record[ recordIdentifierKey ];
  if (typeof synthetic === 'string' && synthetic.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(synthetic) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            for (const v of Object.values(entry as Record<string, unknown>)) {
              if (v != null && String(v).trim().length > 0) {
                return String(v);
              }
            }
          }
        }
      }
    } catch {
      /* fall through */
    }
  }

  const raw = record.__raw__;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const fromRaw = extractRecordIdFromPlainObject(raw as Record<string, unknown>);
    if (fromRaw) return fromRaw;
  }

  if (synthetic != null && typeof synthetic === 'string' && !synthetic.trim().startsWith('[')) {
    return synthetic;
  }
  if (typeof synthetic === 'number' || typeof synthetic === 'boolean') {
    return String(synthetic);
  }
  return '';
}

/** Normalize identifier props / route ids for comparison with handoff id. */
export function normalizeRecordIdentifier(
  id: string | number | Array<string | number> | null | undefined
): string | null {
  if (id == null || id === '') return null;
  if (Array.isArray(id)) return id.length ? String(id[ 0 ]) : null;
  return String(id);
}

/**
 * All plausible record ids for matching {@link isRecentlyTouchedRecord} on a detail page.
 * Merges explicit `identifiers`, react-router params (`gameId`, `dynamicID`, …), config routeParams,
 * and the loaded entity payload (same extraction as post-save handoff).
 */
export function collectDetailPageRecordIdCandidates(
  identifier: string | number | Array<string | number> | null | undefined,
  resolvedData: Record<string, unknown> | null | undefined,
  entityName: string | undefined,
  routeParams: Record<string, unknown>,
  urlParams: Record<string, string | undefined>
): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined) => {
    if (s != null && String(s).trim().length > 0) out.add(String(s).trim());
  };

  add(normalizeRecordIdentifier(identifier));

  if (resolvedData && typeof resolvedData === 'object') {
    add(extractRecordIdFromMutationResponse(resolvedData, entityName));
  }

  const merged: Record<string, unknown> = { ...routeParams, ...urlParams };
  add(resolveRecordIdForRecentSaveHandoff(null, entityName, merged));

  for (const [ k, v ] of Object.entries(merged)) {
    if (v == null || v === '') continue;
    const s = String(v);
    if (s === 'undefined') continue;
    if (k === 'id' || k === 'dynamicID' || /Id$/i.test(k)) add(s);
  }

  return Array.from(out);
}

/** Escape for use in CSS attribute selectors (`querySelector`). */
export function escapeCssAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
