import React, { ReactNode } from 'react';
import { FieldType, PropertyType } from './field-types';
import { IModalConfig } from '../../modal/Modal';
import { GetSignedUploadUrlAPIConfig } from '../common';
import { IEntityConfigReference } from '../hooks';
import type { Condition, ConditionalValue } from './evaluation';
import type { IApiConfig } from '../context/ApiContext';
import type { ISectionsConfig } from '../../pages/PostAuth/SectionsRenderer';
import type { IColumnsConfig } from '../forms/shared/utils';
import type { IDataQualityConfig } from '../common/DataQualityIndicator';
import type { IErrorHandlingConfig, IRetryConfig } from '../common/ErrorFallback';
import type { DisplayOverridesUIConfig, DisplayOverrideFieldUi } from './display-override';

export interface IDetailApiConfig {
  detailApiConfig?: IApiConfig;
}

export interface IDataSourceMixin<T = Record<string, unknown>> {
  dataSource?: T;
}

/**
 * Template configuration interface for complex string interpolation.
 * Supports nested field access with dot notation (e.g., 'team.name').
 */
export interface ITemplateConfig {
  /** Array of field paths to extract (supports dot notation) */
  composite: Array<string>;
  /** Template string with {fieldPath} placeholders */
  template: string;
}

/**
 * Template type for dynamic text rendering across the system.
 * Used in actions, tables, modals, breadcrumbs, relations, and messages.
 * 
 * @example 
 * // Simple string template
 * template: '{firstName} {lastName}'
 * 
 * @example 
 * // Complex template with nested paths
 * const template: Template = { 
 *    composite: ['firstName', 'lastName', 'team.name'], 
 *    template: '{firstName} {lastName} ({team.name})' 
 * }
 */
export type Template = string | ITemplateConfig;

/**
 * Single option for select, radio, checkbox, etc.
 */
export interface IOptions {
  label: string;
  value: string | number;
}

/**
 * Quick-create UX enhancement for select fields (#44).
 *
 * Works **alongside** `addNewOptionConfig` — it does not replace it.
 * When `enabled`, a contextual `+ Create "[term]"` button appears inside the
 * dropdown whenever the user's search returns no results.  Clicking it opens
 * the entity's own create form (resolved via `addNewOptionConfig`) with the
 * search term already pre-filled into `prefillField`.
 *
 * The entity form handles all validation, required fields, and submission —
 * nothing is duplicated here.
 *
 * @example
 * // fw24 entity field metadata:
 * addNewOptionConfig: { entityName: 'team', pageType: 'create' },
 * quickCreate: {
 *   enabled: true,
 *   prefillField: 'teamName',  // entity field pre-filled with the search term
 *   openIn: 'drawer',          // open as a side drawer (default: 'modal')
 * }
 */
export interface IQuickCreateConfig {
  /**
   * Activates the contextual "+ Create '[term]'" button when the search
   * returns no results.  Requires `addNewOptionConfig` to be set.
   * @default false
   */
  enabled?: boolean;

  /**
   * Entity field name to pre-fill with the current search term when the
   * create form opens.  Defaults to the `label` field from
   * `apiConfig.optionMapping` when omitted.
   */
  prefillField?: string;

  /**
   * Container for the entity create form.
   * - `'modal'`  — centred modal (default, existing behaviour)
   * - `'drawer'` — right-side sliding drawer
   * @default 'modal'
   */
  openIn?: 'modal' | 'drawer';
}

/**
 * Validation types supported by the form system
 */
export type IPreDefinedValidations = "required" | "email" | `match:${string}`;

/**
 * Column definition for inline-table field type.
 */
export interface IInlineTableColumnConfig {
  /** Object key to extract the cell value from */
  key: string;
  /** Column header label (falls back to `key` when omitted) */
  label?: string;
  /** Fixed column width in pixels */
  width?: number;
  /** Horizontal alignment (default: 'left') */
  align?: 'left' | 'center' | 'right';
}

/**
 * Configuration for inline-table field type.
 * Renders an array-of-objects as a compact, read-only Ant Design table.
 */
export interface IInlineTableConfig {
  /** Column definitions */
  columns: IInlineTableColumnConfig[];
  /** Ant Design table size (default: 'small') */
  size?: 'small' | 'middle' | 'large';
  /** Whether to show column headers (default: true) */
  showHeader?: boolean;
  /** Whether to show cell borders (default: true) */
  bordered?: boolean;
  /** Maximum visible rows before scroll (default: unlimited) */
  maxRows?: number;
  /**
   * Client-side pagination (inline-table never calls APIs itself).
   * - `true` => enabled with defaults
   * - `false` => disabled
   * - object => enabled with overrides
   */
  pagination?: boolean | {
    /** Rows per page (default: 25) */
    pageSize?: number;
    /** Show page-size selector (default: true) */
    showSizeChanger?: boolean;
    /** Allowed page sizes (default: [10, 25, 50, 100]) */
    pageSizeOptions?: number[];
  };
  /**
   * Value presentation mode for detail view.
   * - `table`: table only (default)
   * - `json`: JSON only
   * - `tabs`: switch between table and JSON
   */
  viewMode?: 'table' | 'json' | 'tabs';
  /** Tab labels used when `viewMode: 'tabs'`. */
  tabLabels?: {
    table?: string;
    json?: string;
  };
}

/**
 * Field-specific properties for all field types.
 * 100% parity with backend PropertyConfig in fw24/src/ui-config-gen/templates/custom-page.ts
 * 
 * These properties configure the behavior and appearance of specific field types
 * across forms, details, and tables.
 */
export interface IFieldTypeProperties {
  // Number field properties
  min?: number;
  max?: number;
  step?: number;
  precision?: number;

  // Currency field properties
  currencySymbol?: string;
  symbolPosition?: 'prefix' | 'suffix';

  // Slider field properties
  marks?: Record<number, string | { label: string; style?: React.CSSProperties }>;
  vertical?: boolean;

  // Duration field properties
  /** Input unit of the stored duration value. Renderer converts to human-readable. Default: 'seconds' */
  durationUnit?: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
  /** 
   * Display format for duration. Default: 'auto' (shows largest relevant units)
   * - 'auto': Automatically shows days/hours/minutes/seconds as needed
   * - 'long': Shows all units (e.g., "2d 3h 15m 30s")
   * - 'short': Shows only 2 most significant units (e.g., "2d 3h")
   * - 'compact': Shows single most significant unit (e.g., "2d")
   */
  durationFormat?: 'auto' | 'long' | 'short' | 'compact';

  // TTL field properties
  /** Input unit of the stored TTL value (Unix timestamp). Renderer shows remaining time. Default: 'seconds' */
  ttlUnit?: 'ms' | 'seconds' | 'minutes' | 'hours';
  /** 
   * Display format for TTL. Default: 'auto'
   * - 'auto': Automatically shows appropriate units based on remaining time
   * - 'long': Shows all units (e.g., "2d 3h 15m 30s remaining")
   * - 'short': Shows only 2 most significant units
   * - 'compact': Shows single most significant unit with suffix
   */
  ttlFormat?: 'auto' | 'long' | 'short' | 'compact';
  /**
   * Auto-refresh TTL display every N seconds. Default: 0 (disabled)
   * Useful for countdown timers. Recommended: 1-60 seconds
   */
  ttlAutoRefresh?: number;

  // Badge field properties
  status?: 'success' | 'processing' | 'error' | 'warning' | 'default';
  color?: string;
  count?: number;
  text?: string;

  // Tag field properties (icon name as string, matching backend)
  icon?: string;

  // Progress field properties
  progressType?: 'line' | 'circle' | 'dashboard';

  // Avatar field properties
  shape?: 'circle' | 'square';
  size?: number | 'large' | 'small' | 'default';

  // Icon field properties
  library?: 'antd' | 'fontawesome' | 'material' | 'custom';

  // Boolean/Switch field properties
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;

  // Clipboard
  /** When true, shows a copy-to-clipboard icon on hover (detail/table views) */
  copyable?: boolean;

  // Progressive Disclosure (#40)
  /**
   * Disclosure tier for this field. Fields with higher tiers are hidden until
   * the user expands the form. Requires `disclosure` config on the form.
   * - 'basic' (default): Always visible
   * - 'advanced': Hidden until user clicks "Show advanced fields"
   * - 'expert': Hidden until user clicks a second time
   */
  tier?: 'basic' | 'advanced' | 'expert';

  // Embed field properties
  /** Configuration for embedded external content (iframe or markdown) */
  embedConfig?: {
    type: 'iframe' | 'markdown';
    /** Height of the embed container in pixels (default: 400) */
    height?: number;
    /** Sandbox attribute for iframe security (default: 'allow-scripts allow-same-origin') */
    sandbox?: string;
  };

  // Link field properties
  target?: '_blank' | '_self' | '_parent' | '_top';

  // Video/Audio field properties
  controls?: boolean;
  autoplay?: boolean;

  // QRCode field properties
  errorLevel?: 'L' | 'M' | 'Q' | 'H';
  logoImage?: string;

  // Text format properties (for url, phone, email)
  format?: 'url' | 'phone' | 'email' | 'text' | 'decimal' | 'integer' | 'currency' | 'percentage' | 'ssn' | 'zip' | 'zipPlus4' | 'creditCard' | 'date' | 'ein';
  mask?: string;
  maxLength?: number;

  /** Additional mask options when `mask` or `format` is specified */
  maskOptions?: {
    /** Whether to show placeholder characters when the field is empty (default: false) */
    lazy?: boolean;
    /** Character used for unfilled mask positions (default: '_') */
    placeholderChar?: string;
  };

  // Inline table field properties
  inlineTableConfig?: IInlineTableConfig;

  // Timeline field properties
  timelineConfig?: {
    /** Layout mode: 'left' (default), 'right', or 'alternate' */
    mode?: 'left' | 'right' | 'alternate';
    /** Reverse the order of items */
    reverse?: boolean;
    /** Maximum number of items to show (default: all) */
    maxItems?: number;
    /** 
     * Field mapping for extracting timeline item data from array elements.
     * If data is an array of objects, specify which fields to use.
     */
    itemMapping?: {
      /** Field for item label/title (default: 'name') */
      labelField?: string;
      /** Field for timestamp (default: 'ts' or 'timestamp') */
      timestampField?: string;
      /** Field for description (optional) */
      descriptionField?: string;
      /** Field for color/type (optional) - values: 'success', 'error', 'warning', 'info' */
      typeField?: string;
      /** Field for custom icon (optional) */
      iconField?: string;
    };
    /** Show timestamps (default: true) */
    showTimestamp?: boolean;
    /** Timestamp format (default: 'MMM D, h:mm:ss A') */
    timestampFormat?: string;
  };
}

/**
 * Rich help configuration for contextual field descriptions.
 * Single source of truth — used by IBaseFieldConfig.help, HelpText, HelpIcon.
 */
export interface IHelpConfig {
  /** Description text displayed based on placement */
  description?: string;
  /** Short tooltip text shown on hover (for 'tooltip' placement) */
  tooltip?: string;
  /** URL to external documentation */
  docsUrl?: string;
  /** How to display the help: below field (default), as tooltip on label, or as popover */
  placement?: 'below' | 'tooltip' | 'popover';
}

/** Built-in masking patterns for common PII types (#51) */
export type MaskingPattern = 'ssn' | 'email' | 'phone' | 'card' | 'custom';

/** Display masking configuration for PII / sensitive data (#51) */
export interface IMaskingConfig {
  enabled: boolean;
  pattern: MaskingPattern;
  /** Custom regex + replacement for 'custom' pattern */
  customPattern?: { match: string; replace: string };
  /** Allow user to reveal the original value */
  allowReveal?: boolean;
  /** Condition that must pass for the reveal button to appear */
  revealCondition?: Condition;
  /** Auto-hide revealed value after N seconds */
  revealDuration?: number;
  /** Log reveal events for audit trail (field name + timestamp emitted via callback) */
  auditReveal?: boolean;
}

/** Derived / computed field configuration (#35) */
export interface IDerivedFieldConfig {
  /** Template string using existing Template system (e.g. '{firstName} {lastName}') */
  template?: Template;
  /** Simple arithmetic expression (e.g. 'quantity * unitPrice') */
  expression?: string;
  /** Conditional value mapping */
  conditions?: Array<{ when: Condition; value: unknown }>;
  /** Fields to watch for recomputation (form mode) */
  watchFields?: string[];
}

/**
 * Base field configuration - shared properties across all field types
 */
export interface IBaseFieldConfig extends IFieldTypeProperties {
  // Identification
  id?: string;
  name?: string;  // Field name / property path (supports dot notation)
  column?: string; // Column name (legacy, prefer 'name')
  label: string | ConditionalValue<string>;

  // Display
  placeholder?: string | ConditionalValue<string>;
  helpText?: string | ConditionalValue<string>;
  hidden?: boolean;

  /**
   * Rich help configuration for contextual field descriptions.
   * Supports tooltip, popover, and below-field placement.
   * When specified, takes precedence over `helpText` for rendering.
   */
  help?: IHelpConfig;

  // Condition system
  /** Condition for conditional visibility (hides the field when false) */
  visibility?: Condition;
  /** Condition for conditional enablement (disables the field when false) */
  enablement?: Condition;
  /** Message shown when field is disabled by enablement condition */
  disabledMessage?: string;

  // Type & Behavior
  fieldType?: FieldType;
  type?: PropertyType; // For complex types (list, map)
  /** IANA timezone for interpreting / displaying date, datetime, and time fields */
  timezone?: string;

  // Values
  defaultValue?: any; // Default value from backend entity schema (for new records)
  initialValue?: any; // Initial value for editing (from API response)

  // Custom renderer
  /**
   * Custom renderer key for this field.
   * When specified, the frontend uses this key to look up a registered custom renderer
   * via ExtensionRegistry.getFieldRenderer().
   */
  renderer?: string | ConditionalValue<string>;

  /**
   * Configuration passed to the custom renderer.
   * Only used when `renderer` is specified.
   */
  rendererConfig?: Readonly<Record<string, unknown>>;

  /**
   * Field dependency — when the named field(s) change, this field's options are refreshed.
   * The parent field's value is included as a filter parameter in the options API call.
   * 
   * @example
   * // state field depends on country: changing country refetches state options
   * dependsOn: 'country'
   * // or multiple:
   * dependsOn: ['country', 'region']
   */
  dependsOn?: string | string[];

  /**
   * Submit behavior for conditionally hidden fields.
   * - `auto` (default): exclude from payload when hidden by `visibility`; include otherwise.
   * - `include`: always include in payload, even when condition-hidden.
   * - `exclude`: always exclude from payload when condition-hidden.
   */
  submitWhenHidden?: 'auto' | 'include' | 'exclude';

  /** Display masking configuration for PII / sensitive data (#51) */
  masking?: IMaskingConfig;

  /** Derived / computed field configuration (#35) */
  derived?: IDerivedFieldConfig;

  /**
   * Fallback display value shown when the field value is null or undefined (#35).
   * Applied in the rendering pipeline before the renderer receives the value.
   * Overrides per-renderer defaults (e.g. '—').
   *
   * @example nullValue: 'N/A'
   * @example nullValue: '(none)'
   */
  nullValue?: string;

  /**
   * Merged from `model.displayOverrides.fields` during UI config generation.
   * Defines per-path admin labels, chrome, and channel hints for override UX.
   */
  displayOverride?: DisplayOverrideFieldUi;

  // Nested structures (for list/map types)
  properties?: Array<any>;
  items?: {
    type: PropertyType;
    properties?: Array<any>;
  };
}

/**
 * Backend response format for field configuration
 * This is what comes from the entity schema / UI config generator
 */
export interface IFormFieldResponse extends IBaseFieldConfig {
  column: string; // Required in backend response
  validations?: Array<IPreDefinedValidations>;
  options?: Array<IOptions>;

  // Modal/Entity references
  addNewOption?: IModalConfig; // DEPRECATED: Use addNewOptionConfig
  addNewOptionConfig?: IEntityConfigReference;
  /** Inline quick-create form inside the dropdown (#44) */
  quickCreate?: IQuickCreateConfig;

  // File/Image fields
  accept?: string;
  fileNamePrefix?: string;
  listType?: string;
  getSignedUploadUrlAPIConfig?: GetSignedUploadUrlAPIConfig;
  withImageCrop?: boolean;

  // Nested structures
  properties?: Array<IFormFieldResponse>;
  items?: {
    type: PropertyType;
    properties?: Array<IFormFieldResponse>;
  };
}

/**
 * Form-specific field configuration
 * Used internally by Form components after conversion from IFormFieldResponse.
 * 
 * Omits 'icon' from base to allow ReactNode for form-specific rendering.
 * 
 * Note: `label`, `placeholder`, `helpText`, `renderer` may be ConditionalValue<string>
 * from the backend config. They are resolved to plain strings at the Form component level
 * via `useResolveBatch` and passed as `resolvedLabel`, etc. through FormFieldConditionProps.
 */
export interface IFormField extends Omit<IBaseFieldConfig, 'icon'> {
  // Form-specific properties
  namePrefixPath?: any[]; // For nested form fields
  validationRules?: Array<any>; // Ant Design validation rules
  prefixIcon?: ReactNode;
  style?: React.CSSProperties;
  setFormValue?: Function; // Callback for custom value updates

  // Options for select/radio/checkbox
  options?: Array<IOptions>;

  // Modal/Entity references
  addNewOption?: IModalConfig; // DEPRECATED: Use addNewOptionConfig
  addNewOptionConfig?: IEntityConfigReference;
  /** Inline quick-create form inside the dropdown (#44) */
  quickCreate?: IQuickCreateConfig;

  // File/Image fields
  accept?: string;
  fileNamePrefix?: string;
  listType?: string;
  getSignedUploadUrlAPIConfig?: GetSignedUploadUrlAPIConfig;
  withImageCrop?: boolean;

  // Override icon to support ReactNode in forms (for Tag fields, etc.)
  icon?: string | ReactNode;

  // Nested structures
  properties?: Array<IFormField>;
  items?: {
    type: PropertyType;
    properties?: Array<IFormField>;
  };
}

/**
 * Detail page field configuration
 * Used by Details component for displaying data.
 * 
 * Note: `label`, `placeholder`, `helpText`, `renderer` may be ConditionalValue<string>
 * from the backend config. They are resolved to plain strings at the Details level
 * before being used in rendering via `useResolveBatch`.
 */
export interface IDetailFieldConfig extends IBaseFieldConfig {
  // Link configuration
  isLink?: boolean;
  linkConfig?: {
    routePattern: string;
    /** Display text for the link - supports templates like "View {entityName}: {entityId}" */
    displayText?: Template;
  };

  // Modal configuration
  openInModal?: boolean;

  // Raw relation data (from backend schema)
  relation?: {
    entityName: string;
    type: string;
    identifiers: any;
  };

  // Entity config reference for relation fields
  relationConfig?: {
    routePattern: string;
    identifierMapping?:
    | { source: string; target: string; }
    | Array<{ source: string; target: string; }>;
    modalConfigRef?: IEntityConfigReference;
    modalWidth?: number | string;
    modalTitle?: string;
    displayConfig?: {
      /**
       * Template for displaying relation value when hydrated data is available.
       * Supports both simple string templates and complex composite templates.
       * 
       * @example template: '{name}'
       * @example template: { composite: ['name', 'city'], template: '{name} ({city})' }
       */
      template?: Template;

      /**
       * Fallback configuration for when only ID is available (not fully hydrated).
       */
      fallback?: {
        template: string; // Pre-generated by backend, e.g., "Team: {id}"
        linkText?: string; // Text for link action, e.g., "View Team"
        modalButtonText?: string; // Text for modal button, e.g., "Open Team Details"
      };

      /**
       * Icon for the relation field (uses entity metadata or defaults).
       */
      icon?: string;

      /**
       * Whether to show the relation value as a link (default: true).
       */
      showLink?: boolean;

      /**
       * Whether to show the modal icon button (default: true).
       */
      showModalIcon?: boolean;

      /**
       * Action configuration for relation display.
       */
      actions?: boolean | {
        link?: boolean; // Show/hide link action
        modal?: boolean; // Show/hide modal action
        custom?: Array<{
          label: string;
          template?: Template; // Dynamic action label
          icon?: string;
          onClick: string; // Function reference as string
        }>;
      };
    };
  };

  // Entity config reference for addNewOption
  addNewOptionConfig?: IEntityConfigReference;

  /** Set at runtime when the displayed value came from the display-override map (Details). */
  displayOverrideActive?: boolean;
  /** Set at runtime to allow chrome/tooltip to show the effective override value (Details). */
  displayOverrideValue?: unknown;

  // Nested structures
  properties?: Array<IDetailFieldConfig>;
  items?: {
    type: PropertyType;
    properties?: Array<IDetailFieldConfig>;
  };
}

// ── onDataChange payload types (shared across page components) ──

export interface IDetailDataChangePayload {
  record?: Record<string, unknown>;
  pageType?: string;
  entityName?: string;
  dataUpdatedAt?: string;
}

export interface IFormDataChangePayload {
  record?: Record<string, unknown>;
  formValues?: Record<string, unknown>;
  pageType?: string;
  entityName?: string;
  /** Whether the form currently has no validation errors. True by default (untouched fields have no errors). */
  isValid?: boolean;
}

export interface ITableDataChangePayload {
  selectedRecords?: ReadonlyArray<Record<string, unknown>>;
  selectedRowKeys?: ReadonlyArray<React.Key>;
  filters?: Record<string, unknown>;
  searchQuery?: string;
  pageType?: string;
  entityName?: string;
}

// ── Page config shared mixin ──

/** Single inline alert banner configuration */
export interface IPageAlertConfig {
  /** Alert type — maps to antd Alert types */
  type: 'info' | 'warning' | 'error' | 'success';
  /** Main alert message. Supports template interpolation with record/routeParams. */
  message: string;
  /** Optional secondary description text */
  description?: string;
  /** Whether the alert can be dismissed (closes until page refresh) */
  closable?: boolean;
  /**
   * Condition that must evaluate to true for the alert to be shown.
   * Evaluated against the current record, form values, and actor context.
   * Omit to always show the alert.
   */
  visibility?: Condition;
  /** Where the alert is placed relative to the page content */
  placement?: 'top' | 'bottom';
}

/**
 * Post-save global touch registry: enable/disable and TTL.
 * Used by `OperationExecutor.recentMutationTouch` and reserved `recentSaveMarker` page key.
 */
export interface IRecentMutationTouchConfig {
  /** @default true */
  enabled?: boolean;
  /** How long the record id stays in the registry, in ms. @default 150000 (~2.5 min) */
  durationMs?: number;
}

export interface IPageConfigBase {
  entityName?: string;
  routeParams?: Record<string, any>;
  sectionsConfig?: ISectionsConfig;
  loading?: { type: 'skeleton' | 'spinner'; rows?: number };
  errorHandling?: IErrorHandlingConfig;
  retry?: IRetryConfig;
  /**
   * Inline contextual alert banners shown above/below the page content (#16).
   * Each alert is independently condition-evaluated.
   *
   * @example
   * alerts: [
   *   {
   *     type: 'warning',
   *     message: 'This record is archived',
   *     visibility: { record: { status: { eq: 'archived' } } }
   *   },
   *   {
   *     type: 'info',
   *     message: 'Draft mode active — changes are not published',
   *     visibility: { record: { isDraft: { eq: true } } }
   *   }
   * ]
   */
  alerts?: IPageAlertConfig[];
  /** Optional display-overrides UI (storage attribute + field rows); clients merge overrides locally. */
  displayOverrides?: DisplayOverridesUIConfig;

  /**
   * Reserved: optional future banner. Row/detail emphasis after save uses the global touch registry
   * (`touchRecentRecord` from {@link OperationExecutor} success), not this flag.
   */
  recentSaveMarker?: boolean | IRecentMutationTouchConfig;
}

// ── Page config interfaces ──

/**
 * A related-entity tab shown below the main detail card (#91).
 * Renders a sub-table of records related to the current record.
 */
export interface IRelatedTab {
  /** Tab key — must be unique */
  key: string;
  /** Tab label shown in the tab strip */
  label: string;
  /** Icon name for the tab (antd icon) */
  icon?: string;
  /** 
   * The page config key to render inside this tab (maps to a table/detail page config).
   * The current record's ID is available in routeParams for filter injection.
   */
  pageConfigKey: string;
  /** Default filters to inject — supports :param placeholders from the parent record */
  defaultFilters?: Record<string, string>;
  /** Condition for showing this tab (evaluated against the parent record) */
  visibility?: Condition;
}

export interface IDetailsConfig extends IDetailApiConfig, IDataSourceMixin<Record<string, unknown>>, IPageConfigBase {
  pageTitle?: Template;
  identifiers?: string | number | Array<string | number>;
  propertiesConfig: Array<IDetailFieldConfig>;
  columnsConfig?: IColumnsConfig;
  dataQuality?: IDataQualityConfig;
  /**
   * Related-entity tabs rendered below the main detail content (#91).
   * Each tab shows a sub-table of records associated with the current record.
   * 
   * @example
   * relatedTabs: [
   *   {
   *     key: 'orders',
   *     label: 'Orders',
   *     pageConfigKey: 'orders-list',
   *     defaultFilters: { customerId: ':id' },
   *   }
   * ]
   */
  relatedTabs?: IRelatedTab[];

  /**
   * Additional API sources to fetch and merge into the record (#90).
   * Fetched in parallel with the primary detailApiConfig.
   * Results are shallow-merged into the primary record. If `key` is provided,
   * the response is nested under that key (e.g. `record.preferences`).
   *
   * @example
   * dataSources: [
   *   { apiConfig: { apiUrl: '/users/:id/preferences', apiMethod: 'GET' } },
   *   { apiConfig: { apiUrl: '/users/:id/stats', apiMethod: 'GET' }, key: 'stats' },
   * ]
   */
  dataSources?: Array<{
    apiConfig: IApiConfig;
    /** When provided, nests the response under this key in the merged record */
    key?: string;
    /** responseKey to pluck from the API response (same as IApiConfig.responseKey semantics) */
    responseKey?: string;
  }>;
}

export interface IDetailsComponentProps extends IDetailsConfig {
  propertiesConfig: Array<IDetailFieldConfig>;
  detailApiConfig?: IApiConfig;
  identifiers?: string | number;
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, any>;
  onDataChange?: (data: IDetailDataChangePayload) => void;
  refreshRef?: React.RefObject<(() => Promise<void>) | null>;
}

