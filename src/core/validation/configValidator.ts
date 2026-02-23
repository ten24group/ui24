/**
 * Config Validation (#9)
 *
 * Standalone, framework-agnostic validation module for ui24 page configs.
 * Runs at config load time (ConfigLoader.tsx) so issues are surfaced immediately —
 * not only when DevTools opens.
 *
 * The ConfigWarningsPanel re-uses this module's types. Both feed from the same
 * central validation result store.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Dot-path to the offending field/property, e.g. "team.listPage.columns[3].fieldType" */
  path: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/** Top-level condition keys recognised by the condition evaluator. */
const CONDITION_TOP_KEYS = new Set([
  'and', 'or', 'not', 'ref', 'custom',
  'actor', 'record', 'formValues', 'selectedRecords',
  'queryParams', 'context', 'featureFlags', 'device', 'tenant',
]);

/** Condition-bearing field properties checked for valid condition syntax. */
const CONDITION_BEARING_PROPS = [
  'visibility', 'enablement',
  'isVisible', 'isEditable', 'isCreatable', 'isListable',
  'visible', 'editable', 'hidden', 'disabled',
] as const;

/** fieldTypes that require an options source in form context. */
const SELECT_FIELD_TYPES = new Set([
  'select', 'multiSelect', 'multi-select', 'multiselect', 'radio', 'checkbox', 'autocomplete',
]);

/**
 * fw24 framework schema types not registered in FieldTypeRegistry.
 * Skip "unknown fieldType" warnings for these.
 */
const FRAMEWORK_SCHEMA_TYPES = new Set([
  'map', 'json', 'list', 'list-item', 'object',
  'string', 'number', 'boolean', 'any',
]);

/** List-page column context — options are not required here. */
const LIST_PAGE_KEYS = new Set([
  'columns', 'listPageConfig', 'columnsConfig',
]);

// ── Condition shape validators ──────────────────────────────────

function validateConditionShape(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    return `Must be an object or boolean — got ${Array.isArray(value) ? 'array' : typeof value}.`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'Empty condition {}. Must have at least one key.';
  const unknownKeys = keys.filter(k => !CONDITION_TOP_KEYS.has(k));
  if (unknownKeys.length === keys.length) {
    return `Unrecognized condition keys: ${unknownKeys.slice(0, 3).map(k => `"${k}"`).join(', ')}.`;
  }
  if ('and' in obj && !Array.isArray(obj.and)) return '"and" must be an array.';
  if ('or' in obj && !Array.isArray(obj.or)) return '"or" must be an array.';
  if ('not' in obj && (obj.not === null || typeof obj.not !== 'object')) return '"not" must be an object.';
  if ('ref' in obj && typeof obj.ref !== 'string') return '"ref" must be a string.';
  return null;
}

function validateConditionalValueShape(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (!('rules' in obj)) return null;
  if (!Array.isArray(obj.rules)) return 'ConditionalValue "rules" must be an array.';
  for (let i = 0; i < (obj.rules as unknown[]).length; i++) {
    const rule = (obj.rules as unknown[])[i];
    if (!rule || typeof rule !== 'object') {
      return `rules[${i}] must be an object.`;
    }
    const r = rule as Record<string, unknown>;
    if (!('when' in r)) return `rules[${i}] missing "when".`;
    const err = validateConditionShape(r.when);
    if (err) return `rules[${i}].when: ${err}`;
  }
  return null;
}

// ── Field-level validation ──────────────────────────────────────

function validateFields(
  fields: unknown[],
  basePath: string,
  knownFieldTypes: Set<string>,
  isListContext: boolean,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenNames = new Map<string, number>();

  fields.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const f = item as Record<string, unknown>;
    const name = String(f.name || f.column || f.dataIndex || f.key || '');
    const fieldPath = `${basePath}[${idx}]${name ? `(${name})` : ''}`;

    if (!name) {
      issues.push({
        severity: 'warning',
        path: fieldPath,
        message: 'Field is missing a name/column/dataIndex.',
        suggestion: 'Every field must have a name, column, or dataIndex.',
      });
    }

    // Duplicate field names
    if (name) {
      seenNames.set(name, (seenNames.get(name) ?? 0) + 1);
      if (seenNames.get(name) === 2) {
        issues.push({
          severity: 'warning',
          path: fieldPath,
          message: `Duplicate field "${name}".`,
          suggestion: 'Remove the duplicate or use unique names.',
        });
      }
    }

    // Unknown fieldType
    const ft = f.fieldType as string | undefined;
    if (ft && !knownFieldTypes.has(ft) && !FRAMEWORK_SCHEMA_TYPES.has(ft)) {
      issues.push({
        severity: 'warning',
        path: `${fieldPath}.fieldType`,
        message: `Unknown fieldType "${ft}".`,
        suggestion: `Registered types: ${Array.from(knownFieldTypes).slice(0, 10).join(', ')}…`,
      });
    }

    // Condition syntax on visibility/enablement props
    for (const prop of CONDITION_BEARING_PROPS) {
      const condVal = f[prop];
      if (condVal === undefined || condVal === null) continue;
      const cvErr = validateConditionalValueShape(condVal);
      if (cvErr) {
        issues.push({
          severity: 'warning',
          path: `${fieldPath}.${prop}`,
          message: `Invalid ConditionalValue: ${cvErr}`,
        });
        continue;
      }
      if (typeof condVal === 'object' && !Array.isArray(condVal) && 'rules' in (condVal as object)) {
        continue; // valid ConditionalValue
      }
      const condErr = validateConditionShape(condVal);
      if (condErr) {
        issues.push({
          severity: 'warning',
          path: `${fieldPath}.${prop}`,
          message: `Invalid condition: ${condErr}`,
          suggestion: 'Use { actor: { groups: { inList: ["admin"] } } } or { and: [...] }.',
        });
      }
    }

    // apiConfig validation
    const apiConfig = f.apiConfig as Record<string, unknown> | undefined;
    if (apiConfig && typeof apiConfig === 'object') {
      if (!apiConfig.apiUrl && !apiConfig.staticOptions) {
        issues.push({
          severity: 'warning',
          path: `${fieldPath}.apiConfig`,
          message: `apiConfig missing both apiUrl and staticOptions.`,
          suggestion: 'Set apiConfig.apiUrl or apiConfig.staticOptions.',
        });
      }
      if (apiConfig.apiUrl && typeof apiConfig.apiUrl !== 'string') {
        issues.push({
          severity: 'error',
          path: `${fieldPath}.apiConfig.apiUrl`,
          message: 'apiUrl must be a string.',
        });
      }
    } else if (ft && SELECT_FIELD_TYPES.has(ft) && !isListContext) {
      // `options` is the single canonical property on PropertyConfig for option sources.
      // It accepts an inline array OR an IFieldOptionsAPIConfig object.
      const hasOptions = f.options != null;
      if (!hasOptions) {
        issues.push({
          severity: 'warning',
          path: `${fieldPath}.options`,
          message: `Select field "${name || ft}" has no options source.`,
          suggestion: 'Add options.apiConfig or options: [{label, value}] for inline lists.',
        });
      }
    }
  });

  return issues;
}

// ── Page config traversal ───────────────────────────────────────

function traversePageConfig(
  config: Record<string, unknown>,
  basePath: string,
  knownFieldTypes: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const checkFields = (fields: unknown, path: string) => {
    if (!Array.isArray(fields)) return;
    const isListCtx = LIST_PAGE_KEYS.has(path.split('.').pop() ?? '');
    issues.push(...validateFields(fields, path, knownFieldTypes, isListCtx));
  };

  // ── Custom page configs (properties/columns/fields at top level) ──────────
  checkFields(config.properties, `${basePath}.properties`);
  checkFields(config.columns, `${basePath}.columns`);
  checkFields(config.fields, `${basePath}.fields`);

  // ── Entity page configs (fw24 code-gen structure) ────────────────────────
  // List page: listPageConfig.columnsConfig.columns
  if (config.listPageConfig && typeof config.listPageConfig === 'object') {
    const lpc = config.listPageConfig as Record<string, unknown>;
    if (lpc.columnsConfig && typeof lpc.columnsConfig === 'object') {
      const cc = lpc.columnsConfig as Record<string, unknown>;
      checkFields(cc.columns, `${basePath}.listPageConfig.columnsConfig.columns`);
    }
  }

  // Form / detail / create / update / view pages: each has propertiesConfig
  for (const pageKey of [
    'formPageConfig',
    'detailsPageConfig',
    'createPageConfig',
    'updatePageConfig',
    'viewPageConfig',
  ] as const) {
    const pc = config[pageKey];
    if (!pc || typeof pc !== 'object') continue;
    const pageConf = pc as Record<string, unknown>;

    // Top-level propertiesConfig array
    checkFields(pageConf.propertiesConfig, `${basePath}.${pageKey}.propertiesConfig`);
    // Also handles custom page shape where properties sit directly under the page
    checkFields(pageConf.properties, `${basePath}.${pageKey}.properties`);

    // Sections inside a page config (accordion / tabs / grouped layouts)
    if (Array.isArray(pageConf.sections)) {
      pageConf.sections.forEach((section: unknown, i: number) => {
        if (!section || typeof section !== 'object') return;
        const s = section as Record<string, unknown>;
        const sPath = `${basePath}.${pageKey}.sections[${i}]`;
        checkFields(s.propertiesConfig, `${sPath}.propertiesConfig`);
        checkFields(s.properties, `${sPath}.properties`);
        // Nested sub-sections (one level deep — accordion inside accordion)
        if (Array.isArray(s.sections)) {
          s.sections.forEach((sub: unknown, j: number) => {
            if (!sub || typeof sub !== 'object') return;
            const ss = sub as Record<string, unknown>;
            checkFields(ss.propertiesConfig, `${sPath}.sections[${j}].propertiesConfig`);
            checkFields(ss.properties, `${sPath}.sections[${j}].properties`);
          });
        }
      });
    }
  }

  // ── Top-level sections (custom pages that are pure section configs) ───────
  if (config.sections && Array.isArray(config.sections)) {
    config.sections.forEach((section: unknown, i: number) => {
      if (!section || typeof section !== 'object') return;
      const s = section as Record<string, unknown>;
      const sPath = `${basePath}.sections[${i}]`;
      checkFields(s.propertiesConfig, `${sPath}.propertiesConfig`);
      checkFields(s.properties, `${sPath}.properties`);
      checkFields(s.fields, `${sPath}.fields`);
      if (Array.isArray(s.sections)) {
        s.sections.forEach((sub: unknown, j: number) => {
          if (!sub || typeof sub !== 'object') return;
          const ss = sub as Record<string, unknown>;
          checkFields(ss.propertiesConfig, `${sPath}.sections[${j}].propertiesConfig`);
          checkFields(ss.properties, `${sPath}.sections[${j}].properties`);
        });
      }
    });
  }

  return issues;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validates a full pages config object (as loaded from S3 / static JSON).
 *
 * @param pagesConfig - The top-level config object (pageKey → page config)
 * @param knownFieldTypes - Set of registered fieldType keys (from FieldTypeRegistry)
 * @returns Array of validation issues (empty = valid)
 */
export function validatePagesConfig(
  pagesConfig: Record<string, unknown>,
  knownFieldTypes: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [pageKey, pageConfig] of Object.entries(pagesConfig)) {
    if (!pageConfig || typeof pageConfig !== 'object') continue;
    issues.push(
      ...traversePageConfig(pageConfig as Record<string, unknown>, pageKey, knownFieldTypes)
    );
  }

  return issues;
}

// ============================================================================
// VALIDATION RESULTS STORE
// ============================================================================
// Simple module-level store (mirrors DevTools snapshot pattern).
// No React dependency — safe to call before React renders.

let _validationIssues: ValidationIssue[] = [];
const _validationListeners = new Set<() => void>();

function emitValidation() {
  _validationListeners.forEach(fn => fn());
}

/** Store validation results (called by ConfigLoader after loading). */
export function setValidationIssues(issues: ValidationIssue[]): void {
  _validationIssues = issues;
  emitValidation();
}

/** Get current validation issues snapshot. */
export function getValidationIssues(): ValidationIssue[] {
  return _validationIssues;
}

/** Subscribe to validation result changes. Returns unsubscribe fn. */
export function subscribeToValidation(listener: () => void): () => void {
  _validationListeners.add(listener);
  return () => _validationListeners.delete(listener);
}
