/**
 * Display overrides — optional per-entity metadata for admin presentation maps stored separately from canonical fields.
 * Aligns with fw24 `display-override-types` / generated UI config. ui24 does not import fw24 at runtime.
 */

/** One entry in the override map (stored JSON). */
export interface DisplayOverrideEntry {
  value?: unknown;
  channel?: string;
  kind?: 'value' | 'visibility' | 'format';
  visible?: boolean;
}

export type DisplayOverrideStorage = Record<string, DisplayOverrideEntry | unknown>;

/**
 * One overridable target — defined only on `displayOverrides.fields` (entity schema).
 * Codegen merges this onto matching field rows as `displayOverride`.
 */
export interface DisplayOverrideFieldConfig {
  path: string;
  channels?: string[];
  label?: string;
  chrome?: 'tag' | 'badge' | 'outline' | 'none';
  helpText?: string;
}

/** Entity-level UI wiring for the override map attribute on the record. */
export interface DisplayOverridesUIConfig {
  storageAttribute: string;
  label?: string;
  channels?: string[];
  allowListItemPaths?: boolean;
  fields?: DisplayOverrideFieldConfig[];
  auto?: boolean;
  autoMode?: 'editableVisible' | 'allNonRelation';
  excludePaths?: string[];
  defaultChrome?: 'tag' | 'badge' | 'outline' | 'none';
}

/** Runtime shape attached to each field after merge (generated JSON + Details). */
export interface DisplayOverrideFieldUi {
  path: string;
  channels?: string[];
  label?: string;
  chrome?: 'tag' | 'badge' | 'outline' | 'none';
  helpText?: string;
}
