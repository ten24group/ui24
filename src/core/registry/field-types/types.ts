/**
 * Props interfaces for built-in field type renderers.
 * 
 * Built-in form renderers extend IFormField — the existing field config type that
 * already has all field-type-specific properties properly typed (min, max, step,
 * currencySymbol, marks, status, etc. via IFieldTypeProperties).
 * 
 * Detail/table renderers receive pre-formatted values and the field config.
 */

import type { IFormField, IBaseFieldConfig } from '../../types/field-config';
import type { GetSignedUploadUrlAPIConfig } from '../../common/FileUploader';

/**
 * Props for built-in form field renderers.
 * Extends IFormField so all field config properties are available and properly typed.
 * These components are rendered INSIDE <Form.Item> — antd injects value/onChange automatically.
 *
 * Uses Partial because renderers receive a subset of the full config depending on field type.
 *
 * Overrides ConditionalValue<string> fields to plain string — by the time props reach
 * a renderer, the condition system (useResolveBatch) has already resolved them.
 */
export interface BuiltInFormFieldProps extends Partial<IFormField> {
  // --- Overrides for resolved conditional values ---
  // IBaseFieldConfig declares these as `string | ConditionalValue<string>`.
  // The form rendering pipeline resolves them via useResolveBatch before
  // passing to renderers, so they are always plain strings here.
  label?: string;
  placeholder?: string;
  helpText?: string;
  renderer?: string;

  // --- Props injected by antd Form.Item via cloneElement ---
  // These are NOT in IFormField but are injected at runtime by Form.Item.
  // Renderers MUST forward these to their underlying antd components.
  value?: any;
  onChange?: (...args: any[]) => void;
  checked?: boolean;
  id?: string;

  // --- Rich content / code editor properties ---
  theme?: string;
  readOnly?: boolean;
  codeLanguage?: 'json' | 'html' | 'javascript' | 'handlebars' | 'text' | 'markdown';
  height?: number;
  darkTheme?: boolean;
  lineNumbers?: boolean;
  validateJson?: boolean;
  uploadFile?: (file: File) => Promise<string>;

  /** Format config from app settings (date/time formats) */
  formatConfig?: Record<string, string>;

  /**
   * Computed dependency filters from `dependsOn` config.
   * When a field declares `dependsOn: ['country']`, the form rendering layer
   * watches those field values and passes them here for cascading options.
   */
  dependencyFilters?: Record<string, unknown>;
}

/**
 * Props for built-in detail field renderers.
 * These receive the formatted value and render a read-only display.
 * Config is typed as Partial<IBaseFieldConfig> which includes IFieldTypeProperties
 * for field-specific properties like status, color, progressType, etc.
 */
export interface BuiltInDetailFieldProps {
  /** The formatted value to display */
  value: unknown;
  /** Field label */
  label?: string;
  /** Full field config with all field-type-specific properties */
  config: Partial<IBaseFieldConfig>;
  /** Route params (for link/URL construction) */
  routeParams?: Record<string, string>;
  /** Full record data (for template evaluation) */
  record?: Record<string, unknown>;
}

/**
 * Props for built-in table column renderers.
 * These receive raw value and full record for cell rendering.
 */
export interface BuiltInTableFieldProps {
  /** Cell value */
  value: unknown;
  /** Full row record */
  record: Record<string, unknown>;
  /** Column config with field-type-specific properties */
  column: Partial<IBaseFieldConfig>;
  /** Row index */
  rowIndex: number;
  /** Route params */
  routeParams?: Record<string, string>;
}
