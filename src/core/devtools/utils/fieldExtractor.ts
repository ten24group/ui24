/**
 * Shared field extraction utility for DevTools panels.
 *
 * Canonical implementation — used by FieldInspectorPanel.
 * Entity-agnostic: works with any page config, not just entity-backed pages.
 */

import type { BridgeEntry, BridgeEntryType } from '../store/snapshot';
import { conditionEvaluator } from '../../utils/ConditionEvaluator';
import type { NewEvaluationContext } from '../../types/evaluation';
import type { Condition } from '../../types/evaluation';

// ── Types ──────────────────────────────────────────────────────

export type FieldSource = 'form' | 'detail' | 'table';

export interface ValidationRule {
  message?: string;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ExtractedField {
  /** Stable key for React lists: `${pageLabel}-${source}-${name}-${index}` */
  key: string;
  name: string;
  fieldType?: string;
  label?: string;
  visibility?: unknown;
  enablement?: unknown;
  required?: unknown;
  hidden?: boolean;
  /** Ant Design form validation rules */
  validationRules?: ValidationRule[];
  source: FieldSource;
  /** The label of the page (bridge entry) this field belongs to */
  pageLabel: string;
  /** The full raw config object for this field */
  fullConfig: Record<string, unknown>;
}

// ── Field source config (for display) ──────────────────────────

export const FIELD_SOURCE_CONFIG: Record<FieldSource, { color: string; label: string }> = {
  form:   { color: 'blue',   label: 'Form' },
  detail: { color: 'purple', label: 'Detail' },
  table:  { color: 'green',  label: 'Table' },
};

// ── Core extraction ────────────────────────────────────────────

function inferSource(configKey: string): FieldSource {
  if (configKey.includes('form')) return 'form';
  if (configKey.includes('list') || configKey === 'columns') return 'table';
  if (configKey.includes('detail')) return 'detail';
  return 'form'; // default: top-level propertiesConfig → form
}

function extractFromArray(
  arr: unknown[],
  source: FieldSource,
  pageLabel: string,
  results: ExtractedField[],
): void {
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const name = String(f.name || f.column || f.dataIndex || f.key || f.id || '');
    if (!name) continue;

    // Extract validation rules: check `rules`, `validationRules`, and legacy `required`
    const rulesRaw = f.rules ?? f.validationRules;
    let validationRules: ValidationRule[] | undefined;
    if (Array.isArray(rulesRaw) && rulesRaw.length > 0) {
      validationRules = rulesRaw as ValidationRule[];
    } else if (f.required) {
      // Synthesize a minimal rule from `required: true` so it shows up in the panel
      validationRules = [{ required: true, message: `${String(f.label ?? f.title ?? name)} is required` }];
    }

    results.push({
      key: `${pageLabel}-${source}-${name}-${i}`,
      name,
      fieldType: (f.fieldType ?? f.type) as string | undefined,
      label: (f.label ?? f.title) as string | undefined,
      visibility: f.visibility,
      enablement: f.enablement ?? f.editable,
      required: f.required as boolean | undefined,
      hidden: f.hidden as boolean | undefined,
      validationRules,
      source,
      pageLabel,
      fullConfig: f,
    });
  }
}

/**
 * Extract fields from a single page config object.
 * Handles top-level `propertiesConfig`, `columns`, and nested
 * `formPageConfig`, `listPageConfig`, `detailsPageConfig`, `detailPageConfig`.
 */
export function extractFieldsFromConfig(
  config: Record<string, unknown>,
  pageLabel: string,
): ExtractedField[] {
  const results: ExtractedField[] = [];

  // Top-level propertiesConfig
  if (Array.isArray(config.propertiesConfig)) {
    extractFromArray(config.propertiesConfig, 'form', pageLabel, results);
  }

  // Top-level columns
  if (Array.isArray(config.columns)) {
    extractFromArray(config.columns, 'table', pageLabel, results);
  }

  // Nested sub-configs
  const SUB_CONFIG_KEYS = ['formPageConfig', 'listPageConfig', 'detailsPageConfig', 'detailPageConfig'];
  for (const key of SUB_CONFIG_KEYS) {
    const sub = config[key] as Record<string, unknown> | undefined;
    if (!sub || typeof sub !== 'object') continue;

    const source = inferSource(key);
    if (Array.isArray(sub.propertiesConfig)) {
      extractFromArray(sub.propertiesConfig, source, pageLabel, results);
    }
    if (Array.isArray(sub.columns)) {
      extractFromArray(sub.columns, 'table', pageLabel, results);
    }
    // columnsConfig.columns
    const cc = sub.columnsConfig as Record<string, unknown> | undefined;
    if (cc && Array.isArray(cc.columns)) {
      extractFromArray(cc.columns, 'table', pageLabel, results);
    }
  }

  return results;
}

/**
 * Extract fields from all page entries in the DevTools bridge store.
 */
export function extractFieldsFromStore(
  store: ReadonlyMap<string, BridgeEntry>,
): ExtractedField[] {
  const results: ExtractedField[] = [];
  for (const entry of Array.from(store.values())) {
    if (entry.type !== ('page' as BridgeEntryType) && entry.type !== ('pageData' as BridgeEntryType)) continue;
    const data = entry.data as Record<string, unknown> | null;
    if (!data) continue;
    const config = (data.config ?? data) as Record<string, unknown>;
    results.push(...extractFieldsFromConfig(config, entry.label));
  }
  return results;
}

/**
 * Get the latest page config from the bridge store (for raw JSON display).
 */
export function getLatestPageConfig(
  store: ReadonlyMap<string, BridgeEntry>,
): Record<string, unknown> | null {
  const pages = Array.from(store.values()).filter(e => e.type === ('page' as BridgeEntryType));
  if (pages.length === 0) return null;
  const latest = pages.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
  return (latest.data as Record<string, unknown>)?.config as Record<string, unknown> ?? latest.data as Record<string, unknown>;
}

// ── Condition evaluation helper ────────────────────────────────

/**
 * Safely evaluate a condition value in the current evaluation context.
 * Returns `true` (visible/enabled), `false` (hidden/disabled), or `null` (no condition set).
 */
export function evaluateCondition(
  condition: unknown,
  ctx: NewEvaluationContext,
): boolean | null {
  if (condition == null) return null;
  if (typeof condition === 'boolean') return condition;
  try {
    return conditionEvaluator.evaluateSync(condition as Condition, ctx);
  } catch {
    return null;
  }
}
