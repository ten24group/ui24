import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Typography, Tag, Empty, Segmented, Alert } from 'antd';
import {
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useDevToolsStore, BridgeEntry, BridgeEntryType } from '../store/snapshot';
import { fieldTypeRegistry } from '../../registry/FieldTypeRegistry';
import { ExtensionRegistry } from '../../registry';
import { panelRoot, filterBar, scrollArea, mono12, tagSmall, colors } from '../utils/devtoolsStyles';
import {
  getValidationIssues,
  subscribeToValidation,
  type ValidationIssue,
} from '../../validation/configValidator';

const { Text } = Typography;

type Severity = 'error' | 'warning' | 'info';

interface ConfigWarning {
  severity: Severity;
  field?: string;
  message: string;
  suggestion?: string;
}

// ── Condition syntax validation ────────────────────────────────

/** Top-level keys valid in a Condition object */
const CONDITION_TOP_KEYS = new Set([
  'and', 'or', 'not', 'ref', 'custom',
  // InlineCondition context categories:
  'actor', 'record', 'formValues', 'selectedRecords',
  'queryParams', 'context', 'featureFlags', 'device', 'tenant',
]);

/** Field config properties that may hold a Condition or ConditionalValue */
const CONDITION_BEARING_PROPS = [
  'isVisible', 'isEditable', 'isCreatable', 'isListable', 'isHidden',
  'visible', 'editable', 'hidden', 'disabled',
] as const;

/** Fieldtype values that require an options source (apiConfig or staticOptions) */
const SELECT_FIELD_TYPES = new Set(['select', 'multiSelect', 'multi-select', 'multiselect', 'radio', 'checkbox']);

/**
 * fw24 platform-level schema types that are handled by the framework's built-in
 * fallback rendering (JSON viewer for map/json/object, array display for list, etc.).
 * These are NOT registered in FieldTypeRegistry because they're not configurable
 * UI field types — they're DynamoDB/ElectroDB data types surfaced in column configs.
 * Skip the "unknown fieldType" warning for these.
 */
const FRAMEWORK_SCHEMA_TYPES = new Set([
  'map', 'json', 'list', 'list-item', 'object',
  // fw24 entity primitive types (can appear in raw column/field configs)
  'string', 'number', 'boolean', 'any',
]);

/**
 * List page sources: field options are NOT needed for displaying a value in a table.
 * Only form pages need options to render a picker. Suppress the "no options" warning
 * for list column contexts.
 */
const LIST_SOURCES = new Set(['columns', 'listPageConfig', 'listPageConfig.columnsConfig']);

/**
 * Validate a raw condition object shape.
 * Returns an error message string on failure, null if valid.
 */
function validateConditionShape(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    return `Must be an object or boolean — got ${Array.isArray(value) ? 'array' : typeof value}. Use { "and": [...] } instead of arrays.`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return 'Empty condition object {}. A condition must have at least one key.';
  }
  const unknownKeys = keys.filter(k => !CONDITION_TOP_KEYS.has(k));
  if (unknownKeys.length === keys.length) {
    // All keys are unrecognized — likely a typo or wrong nesting
    return `Unrecognized condition key(s): ${unknownKeys.slice(0, 3).map(k => `"${k}"`).join(', ')}. Valid keys: and, or, not, ref, actor, record, formValues, …`;
  }
  // Validate structure of compound conditions
  if ('and' in obj && !Array.isArray(obj.and)) {
    return '"and" must be an array of conditions.';
  }
  if ('or' in obj && !Array.isArray(obj.or)) {
    return '"or" must be an array of conditions.';
  }
  if ('not' in obj && (obj.not === null || typeof obj.not !== 'object')) {
    return '"not" must be a condition object.';
  }
  if ('ref' in obj && typeof obj.ref !== 'string') {
    return '"ref" must be a string condition name.';
  }
  return null;
}

/**
 * Validate a ConditionalValue<T> shape: { rules: [{ when, then }], default }.
 * Returns an error message or null.
 */
function validateConditionalValueShape(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (!('rules' in obj)) return null; // not a ConditionalValue
  if (!Array.isArray(obj.rules)) {
    return 'ConditionalValue "rules" must be an array.';
  }
  for (let i = 0; i < (obj.rules as unknown[]).length; i++) {
    const rule = (obj.rules as unknown[])[i];
    if (!rule || typeof rule !== 'object') {
      return `ConditionalValue rules[${i}] must be an object.`;
    }
    const r = rule as Record<string, unknown>;
    if (!('when' in r)) {
      return `ConditionalValue rules[${i}] missing "when" condition.`;
    }
    const whenErr = validateConditionShape(r.when);
    if (whenErr) {
      return `ConditionalValue rules[${i}].when: ${whenErr}`;
    }
  }
  return null;
}

// ── Field-level analysis ───────────────────────────────────────

function getKnownFieldTypes(): Set<string> {
  const known = new Set<string>();
  for (const ft of Object.keys(fieldTypeRegistry.listAll())) known.add(ft);
  for (const c of ExtensionRegistry.listComponents()) {
    if (c.category === 'field') known.add(c.key);
  }
  return known;
}

function analyzeFields(fields: unknown[], source: string, knownTypes: Set<string>, isListContext?: boolean): ConfigWarning[] {
  // Determine context from source name if not explicitly provided
  const _isListContext = isListContext ?? LIST_SOURCES.has(source);
  const warnings: ConfigWarning[] = [];
  const seenNames = new Map<string, number>();

  for (const item of fields) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const name = String(f.name || f.column || f.dataIndex || f.key || '');

    if (!name) {
      warnings.push({
        severity: 'error',
        message: `Empty field name in ${source}`,
        suggestion: 'Every field must have a name, column, or dataIndex.',
      });
      continue;
    }

    seenNames.set(name, (seenNames.get(name) || 0) + 1);
    if (seenNames.get(name) === 2) {
      warnings.push({
        severity: 'warning',
        field: name,
        message: `Duplicate field "${name}" in ${source}`,
        suggestion: 'Remove the duplicate or use unique names.',
      });
    }

    const ft = f.fieldType as string | undefined;
    if (ft && !knownTypes.has(ft) && !FRAMEWORK_SCHEMA_TYPES.has(ft)) {
      warnings.push({
        severity: 'warning',
        field: name,
        message: `Unknown fieldType "${ft}" on field "${name}" in ${source}`,
        suggestion: `Registered types: ${Array.from(knownTypes).slice(0, 10).join(', ')}…`,
      });
    }

    // ── Condition syntax validation ──────────────────────────
    for (const prop of CONDITION_BEARING_PROPS) {
      const condVal = f[prop];
      if (condVal === undefined || condVal === null) continue;

      // Check if it looks like a ConditionalValue<T>
      const cvErr = validateConditionalValueShape(condVal);
      if (cvErr) {
        warnings.push({
          severity: 'warning',
          field: name,
          message: `Invalid ConditionalValue on "${prop}" in field "${name}" (${source}): ${cvErr}`,
          suggestion: 'ConditionalValue must be { rules: [{ when: Condition, then: T }], default: T }.',
        });
        continue;
      }

      // Check raw Condition syntax (skip if it looks like a ConditionalValue)
      if (typeof condVal === 'object' && !Array.isArray(condVal) && 'rules' in (condVal as object)) {
        continue; // already validated as ConditionalValue above
      }
      const condErr = validateConditionShape(condVal);
      if (condErr) {
        warnings.push({
          severity: 'warning',
          field: name,
          message: `Invalid condition on "${prop}" in field "${name}" (${source}): ${condErr}`,
          suggestion: 'Use { "actor": { "groups": { "contains": "admin" } } } or { "and": [...] }.',
        });
      }
    }

    // ── API config validation ────────────────────────────────
    const apiConfig = f.apiConfig as Record<string, unknown> | undefined;
    if (apiConfig && typeof apiConfig === 'object') {
      if (!apiConfig.apiUrl && !apiConfig.staticOptions) {
        warnings.push({
          severity: 'warning',
          field: name,
          message: `Field "${name}" has apiConfig but missing apiUrl and staticOptions`,
          suggestion: 'Set apiConfig.apiUrl (for remote options) or apiConfig.staticOptions (for fixed lists).',
        });
      }
      if (apiConfig.apiUrl && typeof apiConfig.apiUrl !== 'string') {
        warnings.push({
          severity: 'error',
          field: name,
          message: `Field "${name}" apiConfig.apiUrl must be a string`,
          suggestion: 'Ensure apiUrl is a string like "/api/v1/teams".',
        });
      }
    } else if (ft && SELECT_FIELD_TYPES.has(ft) && !_isListContext) {
      // Only warn about missing options in FORM contexts.
      // List/table contexts just display the stored value — they don't need a full options list.
      // Also check all common options source patterns: staticOptions, options, fieldOptions, enumValues.
      const hasOptions =
        f.staticOptions != null ||
        f.options != null ||
        f.fieldOptions != null ||
        f.enumValues != null;
      if (!hasOptions) {
        warnings.push({
          severity: 'warning',
          field: name,
          message: `Select field "${name}" (${ft}) has no options source`,
          suggestion: 'Add apiConfig.apiUrl for remote options, or staticOptions / options for inline lists.',
        });
      }
    }
  }

  return warnings;
}

// ── Page config analysis ────────────────────────────────────────

function analyzePageConfig(pageData: Record<string, unknown>): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];
  const config = (pageData?.config ?? pageData) as Record<string, unknown>;
  const pageType = pageData?.pageType as string | undefined;
  const knownTypes = getKnownFieldTypes();

  if (Array.isArray(config.propertiesConfig)) {
    warnings.push(...analyzeFields(config.propertiesConfig, 'propertiesConfig', knownTypes));
  }
  if (Array.isArray(config.columns)) {
    warnings.push(...analyzeFields(config.columns, 'columns', knownTypes));
  }

  const SUB_CONFIGS = ['formPageConfig', 'listPageConfig', 'detailsPageConfig', 'detailPageConfig'];
  for (const key of SUB_CONFIGS) {
    const sub = config[key] as Record<string, unknown> | undefined;
    if (!sub || typeof sub !== 'object') continue;
    if (Array.isArray(sub.propertiesConfig)) {
      warnings.push(...analyzeFields(sub.propertiesConfig, key, knownTypes));
    }
    if (Array.isArray(sub.columns)) {
      warnings.push(...analyzeFields(sub.columns, key, knownTypes));
    }
    const cc = sub.columnsConfig as Record<string, unknown> | undefined;
    if (cc && Array.isArray(cc.columns)) {
      warnings.push(...analyzeFields(cc.columns, `${key}.columnsConfig`, knownTypes));
    }
  }

  // Structural warnings
  if (pageType === 'form' && !config.propertiesConfig && !('formPageConfig' in config)) {
    warnings.push({
      severity: 'error',
      message: 'Form page missing propertiesConfig or formPageConfig',
      suggestion: 'A form page requires field definitions.',
    });
  }
  if (pageType === 'list' && !config.columns && !('listPageConfig' in config)) {
    warnings.push({
      severity: 'warning',
      message: 'List page missing columns or listPageConfig',
      suggestion: 'Column definitions drive the table display.',
    });
  }
  if (pageType === 'details' && !config.propertiesConfig && !('detailsPageConfig' in config) && !('detailPageConfig' in config)) {
    warnings.push({
      severity: 'warning',
      message: 'Details page missing propertiesConfig or detailsPageConfig',
      suggestion: 'Detail field definitions drive the layout.',
    });
  }

  return warnings;
}

// ── Form data analysis ─────────────────────────────────────────

function analyzeFormData(formData: Record<string, unknown>): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];
  const { formValues, errors } = formData as {
    formValues?: Record<string, unknown>;
    errors?: Record<string, string[]>;
    isDirty?: boolean;
    isValid?: boolean;
  };

  if (errors) {
    const errorFields = Object.entries(errors).filter(([, msgs]) => msgs && msgs.length > 0);
    for (const [field, msgs] of errorFields) {
      warnings.push({
        severity: 'error',
        field,
        message: `Validation error on "${field}": ${msgs[0]}`,
        suggestion: 'Fix validation before submitting.',
      });
    }
  }

  if (formValues) {
    const emptyRequired = Object.entries(formValues).filter(
      ([, v]) => v === null || v === undefined || v === ''
    );
    if (emptyRequired.length > 5) {
      warnings.push({
        severity: 'info',
        message: `${emptyRequired.length} form fields are empty`,
        suggestion: 'Check required field definitions.',
      });
    }
  }

  return warnings;
}

const SEVERITY_CONFIG: Record<Severity, { color: string; borderColor: string; icon: React.ReactNode }> = {
  error:   { color: 'red',    borderColor: '#ff4d4f', icon: <CloseCircleOutlined /> },
  warning: { color: 'orange', borderColor: '#faad14', icon: <WarningOutlined /> },
  info:    { color: 'blue',   borderColor: '#1677ff', icon: <InfoCircleOutlined /> },
};

type SeverityFilter = 'all' | Severity;

// ── Shared hook that computes warnings once ────────────────────

interface FlatWarning extends ConfigWarning {
  pageLabel: string;
}

/** Hook to read load-time validation issues from the configValidator store. */
function useLoadTimeIssues(): ValidationIssue[] {
  return useSyncExternalStore(subscribeToValidation, getValidationIssues);
}

function useAllWarnings(): FlatWarning[] {
  const store = useDevToolsStore();
  const loadTimeIssues = useLoadTimeIssues();

  return useMemo(() => {
    const result: FlatWarning[] = [];

    // Load-time validation results (#9) — shown first as "Load-time" issues
    for (const issue of loadTimeIssues) {
      result.push({
        severity: issue.severity,
        field: issue.path,
        message: issue.message,
        suggestion: issue.suggestion,
        pageLabel: 'Load-time',
      });
    }

    // Runtime per-page analysis from DevTools snapshot store
    for (const entry of Array.from(store.values())) {
      const data = entry.data as Record<string, unknown> | null;
      if (!data) continue;

      if (entry.type === ('page' as BridgeEntryType) || entry.type === ('pageData' as BridgeEntryType)) {
        for (const w of analyzePageConfig(data)) {
          result.push({ ...w, pageLabel: entry.label });
        }
      } else if (entry.type === ('form' as BridgeEntryType)) {
        for (const w of analyzeFormData(data)) {
          result.push({ ...w, pageLabel: entry.label });
        }
      }
    }

    return result;
  }, [store, loadTimeIssues]);
}

// ── Public hook for badge count ────────────────────────────────
export function useConfigWarningCount(): number {
  return useAllWarnings().filter(w => w.severity === 'error' || w.severity === 'warning').length;
}

// ── Panel component ────────────────────────────────────────────
export const ConfigWarningsPanel: React.FC = () => {
  const allWarnings = useAllWarnings();
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return allWarnings;
    return allWarnings.filter(w => w.severity === filter);
  }, [allWarnings, filter]);

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const w of allWarnings) c[w.severity]++;
    return c;
  }, [allWarnings]);

  if (allWarnings.length === 0) {
    return (
      <div style={{ padding: 12 }}>
        <Alert
          type="success"
          showIcon
          message="No config warnings"
          description="Current page configuration looks good."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <Segmented
          size="small"
          value={filter}
          onChange={val => setFilter(val as SeverityFilter)}
          options={[
            { label: `All (${allWarnings.length})`, value: 'all' },
            { label: `Errors (${counts.error})`, value: 'error' },
            { label: `Warnings (${counts.warning})`, value: 'warning' },
            { label: `Info (${counts.info})`, value: 'info' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((w) => {
          const cfg = SEVERITY_CONFIG[w.severity];
          const key = `${w.pageLabel}-${w.severity}-${w.field || ''}-${w.message.slice(0, 40)}`;
          return (
            <div
              key={key}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                borderLeft: `3px solid ${cfg.borderColor}`,
                borderRadius: 4,
                background: 'var(--ant-color-bg-container, #fff)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Tag color={cfg.color} icon={cfg.icon} style={tagSmall}>{w.severity}</Tag>
                {w.field && <Text style={mono12}>{w.field}</Text>}
                <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>{w.pageLabel}</Text>
              </div>
              <Text style={{ fontSize: 12 }}>{w.message}</Text>
              {w.suggestion && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                  {w.suggestion}
                </Text>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
