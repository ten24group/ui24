import { IApiConfig, IDualApiConfig } from "../core/context";
import { FieldType, PropertyType } from "../core/types/field-types";
import type { Template, Condition, ConditionalValue, IFieldTypeProperties } from "../core/types";
import { IModalConfig, IResponseDisplayConfig } from "../modal/Modal";
import { IActionDrawerConfig } from "../modal/Drawer";
import type { IRelationFieldConfig } from "./renderers/RelationFieldRenderer";
import { ISectionsConfig } from "../pages/PostAuth/SectionsRenderer";
import type { IEntityConfigReference } from "../core/hooks/useEntityConfig";
import type { ViewConfig } from "../core/common/ViewSwitcher/types";

/**
 * Pagination configuration for tables.
 * Controls page size options, total display, quick jumper, and position.
 */
export interface IPaginationConfig {
  /** Available page size options. @default [10, 20, 50, 100] */
  pageSizeOptions?: number[];
  /** Show total record count. @default true */
  showTotal?: boolean;
  /** Show quick jumper input (offset mode only). @default false */
  showQuickJumper?: boolean;
  /** Position of pagination controls. @default 'bottom' */
  position?: 'top' | 'bottom' | 'both';
}

/**
 * Expandable row configuration for tables.
 * 
 * Matches backend type from fw24/src/entity/base-entity.ts (ITableExpandableConfig)
 */
export interface ITableExpandableConfig {
  mode: 'nested-table' | 'details' | 'custom' | 'json';
  relationField?: string;
  tableConfig?: {
    apiUrl: string;
    apiMethod?: 'GET' | 'POST';
    responseKey?: string;
    columns?: ReadonlyArray<string> | Array<string>;
    pageSize?: number;
    showPagination?: boolean;
    defaultFilters?: ITableFilters;
    showViewAll?: boolean;
    viewAllModalWidth?: number | string;
  };
  detailsConfig?: {
    fields?: ReadonlyArray<string> | Array<string>;
    numColumns?: number;
  };
  customConfig?: {
    pageType: 'list' | 'details' | 'form' | 'dashboard' | 'accordion';
    pageConfig?: ITableFilters;
  };
  rowExpandable?: Condition;
  defaultExpanded?: boolean;
  expandIcon?: string;
  indentSize?: number;
}

/**
 * Type-safe filter values.
 * Used in defaultFilters and filter state.
 */
export interface ITableFilters {
  readonly [ key: string ]: string | number | boolean | null | undefined |
  ReadonlyArray<string | number | boolean | null>;
}


/**
 * Sort configuration for tables
 * 
 * Used in both backend (entity schema) and frontend (UI config)
 * 
 * Three formats supported:
 * 
 * 1. Object (single column sort for search):
 *    { field: 'createdAt', order: 'desc' }
 * 
 * 2. Array (multi-column sort for search):
 *    [{ field: 'publishDate', order: 'desc' }, { field: 'likeCount', order: 'desc' }]
 * 
 * 3. Order string (DynamoDB index order indication):
 *    'asc' | 'desc'
 *    Note: For DynamoDB, this indicates the expected index order direction,
 *    not an actual sort parameter (DynamoDB returns data in index PK/SK order)
 */
export type SortConfig =
  | { field: string; order: 'asc' | 'desc' }           // Single column sort (search mode)
  | Array<{ field: string; order: 'asc' | 'desc' }>    // Multi-column sort (search mode)
  | 'asc' | 'desc';                                     // Index order direction (DynamoDB mode)

/**
 * Extended IApiConfig for table use with defaultSort
 */
export interface ITableApiConfig extends IApiConfig {
  defaultSort?: SortConfig;
}

/**
 * Extended IDualApiConfig for table use with defaultSort
 */
export interface IDualTableApiConfig {
  search: ITableApiConfig;
  database: ITableApiConfig;
}

/**
 * Table configuration interface
 * 
 * For single endpoint (backward compatible):
 * ```typescript
 * {
 *   apiConfig: {
 *     apiUrl: "/api/posts",
 *     apiMethod: "GET",
 *     useSearch: true // or false
 *     defaultSort: { field: 'createdAt', order: 'desc' }
 *   }
 * }
 * ```
 * 
 * For dual endpoints (search + database):
 * ```typescript
 * {
 *   apiConfig: {
 *     search: {
 *       apiUrl: "/api/search/posts",
 *       apiMethod: "GET",
 *       responseKey: "items",
 *       defaultSort: [{ field: 'publishDate', order: 'desc' }]
 *     },
 *     database: {
 *       apiUrl: "/api/posts",
 *       apiMethod: "GET",
 *       responseKey: "data",
 *       defaultSort: 'desc'  // DynamoDB index order
 *     }
 *   }
 * }
 * ```
 */

/**
 * Filter segment (quick filter tab) configuration.
 * Matches backend type from fw24/src/entity/base-entity.ts (IFilterSegment)
 */
export interface IFilterSegment {
  id: string;
  label: string;
  icon?: string;
  filters: Record<string, any>;
  default?: boolean;
  visibility?: Condition;
  badge?: number | string;
  badgeStatus?: 'success' | 'processing' | 'error' | 'warning' | 'default';
}

/**
 * Filter segment group configuration.
 * Groups related segments together with a label (e.g., "By Status", "By League").
 * Each group manages its own filter state independently.
 * Matches backend type from fw24/src/entity/base-entity.ts (IFilterSegmentGroup)
 */
export interface IFilterSegmentGroup {
  id: string;
  label: string;
  segments: IFilterSegment[];
  defaultSegmentId?: string;
  maxVisible?: number;
}

/**
 * Table configuration interface.
 * Generated by FW24 backend from entity schema.
 * 
 * Row actions are merged into propertiesConfig[identifier].actions
 * Bulk actions come from entitySchema.model.listPageConfig.tableConfig.bulkActions
 * Row selection comes from entitySchema.model.listPageConfig.tableConfig.rowSelection
 */
/**
 * Empty state configuration for tables.
 * Supports two variants: noData (zero records) and noResults (filters active, no matches).
 */
export interface ITableEmptyStateConfig {
  /** Custom illustration URL (applies to both noData and noResults variants) */
  image?: string;
  noData?: {
    title?: string;
    description?: string;
    action?: { label: string; url?: string };
  };
  noResults?: {
    title?: string;
    showClearFilters?: boolean;
  };
}

export interface ITableConfig {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: ITableApiConfig | IDualTableApiConfig;
  records?: Array<any>;
  routeParams?: Record<string, any>;
  defaultFilters?: Record<string, any>; // Pre-applied filters (supports placeholders like ":teamId")
  entityName?: string;  // Entity name from backend config generation

  /**
   * Empty state configuration for when the table has no data.
   * Customizes the message and actions shown when there are no records.
   */
  emptyState?: ITableEmptyStateConfig;

  /**
   * Conditional row formatting rules.
   * Each rule's condition is evaluated against the row record.
   * When matched, the specified className/style is applied to the entire row.
   */
  rowFormatting?: Array<IFormattingRule>;
  bulkActions?: ReadonlyArray<IPageAction>;  // Actions shown when multiple rows selected (from backend tableConfig.bulkActions)
  rowSelection?: {
    readonly enabled: boolean;
    /** Selection type: 'checkbox' for multi-select, 'radio' for single-select */
    readonly type?: 'checkbox' | 'radio';
    readonly visibility?: Condition;  // Conditional row selection
  };  // Row selection configuration (from backend tableConfig.rowSelection)
  /**
   * Expandable row configuration.
   * From backend: entitySchema.model.listPageConfig.tableConfig.expandable
   * 
   * Allows displaying nested data (e.g., to-many relations) within table rows.
   * Uses existing Table component for nested-table mode, providing full table features.
   */
  expandableConfig?: ITableExpandableConfig;

  /**
   * Filter segments (quick filter tabs).
   * From backend: entitySchema.model.listPageConfig.tableConfig.segments
   * 
   * Supports two formats:
   * 1. Flat array (legacy): Single group of segments
   * 2. Grouped array: Multiple independent segment groups
   * 
   * Displayed as tabs above the table for quick access to common filter sets.
   * Supports placeholder resolution (`:actor.actorId`, `:startOfToday`, etc.)
   * 
   * Segment selection is reactive: UI automatically updates when filters change from any source
   * (URL, column filters, applied filters removal, or segment clicks).
   */
  segments?: Array<IFilterSegment | IFilterSegmentGroup>;

  /**
   * Controls how column data is fetched from the API.
   * From backend: entitySchema.model.listPageConfig.tableConfig.fetchStrategy
   * 
   * - `'eager'` (default): Fetches all `isListable` columns in a single request.
   * - `'lazy'`: Only fetches visible columns initially. Refetches when users show hidden columns.
   * 
   * @default 'eager'
   */
  fetchStrategy?: 'eager' | 'lazy';

  /**
   * Default number of records per page.
   * From backend: entitySchema.model.listPageConfig.tableConfig.pageSize
   * 
   * Users can change this via the pagination controls (options: 10, 20, 50, 100).
   * 
   * @default 10
   */
  pageSize?: number;

  /**
   * Additional sections to display below or alongside the main table.
   * From backend: entitySchema.model.listPageConfig.sectionsConfig
   * 
   * Enables multi-section list pages with tabs or accordion UI.
   * Sections have access to table state (selected records, filters) via routeParams.
   */
  sectionsConfig?: ISectionsConfig;

  onDataChange?: (data: {
    selectedRecords?: ReadonlyArray<Record<string, unknown>>;
    filters?: ITableFilters;
    searchQuery?: string;
    pageType?: string;
    entityName?: string;
    selectedRowKeys?: ReadonlyArray<React.Key>;
  }) => void;

  /**
   * Whether to show the table toolbar (search, refresh, column settings, filters).
   * @default true
   */
  showToolbar?: boolean;

  /**
   * Whether to show pagination controls.
   * @default true
   */
  showPagination?: boolean;

  /**
   * Pagination configuration.
   * Controls page size options, total display, quick jumper, and position.
   * 
   * Note: `pageSize` remains at the top level of ITableConfig (not duplicated here).
   */
  pagination?: IPaginationConfig;

  /**
   * Table density (row padding) settings.
   * Maps to antd Table `size` prop.
   */
  density?: {
    default: 'default' | 'compact' | 'comfortable';
    allowToggle?: boolean;
    /** Persist user preference to localStorage (keyed by entityName) */
    persist?: boolean;
  };

  /**
   * Column resize settings.
   * When enabled, column headers become resizable by dragging.
   */
  columnResizing?: {
    enabled: boolean;
    /** Persist column widths to localStorage (keyed by entityName) */
    persist?: boolean;
    /** Minimum column width in pixels (default: 60) */
    minWidth?: number;
  };

  /**
   * Pinned (frozen) columns configuration.
   * Maps to antd Table `fixed: 'left' | 'right'` on columns.
   * When pinned columns exist, horizontal scroll is enabled via `scroll={{ x: 'max-content' }}`.
   */
  pinnedColumns?: {
    left?: string[];
    right?: string[];
  };

  /**
   * Context menu (right-click) configuration for table rows.
   * Items follow the same shape as IPageAction (reuses action infrastructure).
   */
  contextMenu?: {
    items: Array<IPageAction & { divider?: boolean }>;
  };

  /**
   * Display mode toggle (table rows vs card grid).
   * For basic table/card toggle. Use `viewSwitcher` for the unified multi-view system.
   */
  displayMode?: {
    default: 'table' | 'card';
    /** Allow user to toggle between views */
    allowToggle?: boolean;
    /** Card view configuration */
    cardConfig?: {
      /** Number of columns in the card grid (default: responsive) */
      columns?: number;
      /** Field name for card title */
      titleField: string;
      /** Field name for card description */
      descriptionField?: string;
      /** Field name for card image/avatar */
      imageField?: string;
      /** Additional fields to show as summary on the card */
      summaryFields?: string[];
    };
    /** Persist user view preference to localStorage */
    remember?: boolean;
  };

  /**
   * Unified view switcher configuration.
   * When provided, replaces the basic `displayMode` toggle with a multi-view toolbar.
   * Supports: table, card-grid, kanban, calendar, map.
   * Only renders views for which implementations exist (table + card-grid currently).
   */
  viewSwitcher?: ViewConfig;

  /**
   * Loading state configuration (#57).
   * Controls how loading states are displayed before data is ready.
   * @default { type: 'skeleton' }
   */
  loading?: {
    type: 'skeleton' | 'spinner';
    rows?: number;
  };
}

/**
 * Conditional formatting rule for cell or row styling.
 * When the condition matches the row record, the style/className is applied.
 */
export interface IFormattingRule {
  /** Condition evaluated against row data */
  when: Condition;
  /** Inline CSS styles to apply */
  style?: React.CSSProperties;
  /** CSS class name to apply */
  className?: string;
  /** Badge configuration (for cell formatting) */
  badge?: { status: string };
  /** Icon configuration (for cell formatting) */
  icon?: { name: string; color?: string };
}

export interface ITablePropertiesConfig extends IFieldTypeProperties {
  name: string;
  dataIndex: string;
  actions?: Array<IPageAction>;

  /**
   * Conditional cell formatting rules.
   * Each rule's condition is evaluated against the row record.
   * When matched, the specified style/className/badge is applied to the cell.
   */
  formatting?: Array<IFormattingRule>;
  hidden?: boolean;
  /**
   * Controls initial visibility of the column in list pages.
   * - true: Column is visible by default
   * - false: Column is hidden by default but available in Column Settings
   * - undefined: Falls back to !hidden for backward compatibility
   * From backend: tableConfig.columns[].defaultVisible
   */
  defaultVisible?: boolean;
  /** Condition for conditional visibility of this column */
  visibility?: Condition;
  isFilterable?: boolean;
  isIdentifier?: boolean;
  isSortable?: boolean;
  fieldType?: FieldType;
  type?: PropertyType;  // Data type from entity schema (list, map, object)
  placeholder?: string;
  helpText?: string;
  /**
   * Group title for column grouping.
   * Columns with the same groupTitle will be grouped under a common header.
   * From backend: tableConfig.columns[].groupTitle
   */
  groupTitle?: string;

  /**
   * Composite column configuration — renders multiple fields in one column.
   * 
   * @example
   * composite: { fields: ['firstName', 'lastName', 'email'], layout: 'stacked' }
   * // or with template:
   * composite: { fields: ['firstName', 'lastName'], template: '{firstName} {lastName}' }
   */
  composite?: {
    /** Field names to extract from the record */
    fields: string[];
    /** Optional template for formatting (supports {field} placeholders) */
    template?: Template;
    /** Layout: 'stacked' = vertical, 'inline' = horizontal with separator */
    layout?: 'stacked' | 'inline';
  };

  /**
   * Template for rendering column values.
   * Supports nested paths and composite templates.
   * If provided, overrides default rendering.
   * 
   * @example
   * // Simple string template
   * template: '{firstName} {lastName}'
   * 
   * @example
   * // Complex template with nested paths
   * template: {
   *   composite: ['jerseyNumber', 'name', 'team.name'],
   *   template: '#{jerseyNumber} {name} ({team.name})'
   * }
   */
  template?: Template;

  /**
   * Custom renderer key for this field/column.
   * When specified, the frontend uses this key to look up a registered custom renderer
   * via ExtensionRegistry.getFieldRenderer() or getColumnRenderer().
   * Supports ConditionalValue for dynamic renderer selection based on context.
   * 
   * @example
   * renderer: 'address-picker'
   * // or conditional:
   * renderer: { rules: [{ when: { device: { isMobile: { eq: true } } }, value: 'compact-view' }], default: 'full-view' }
   */
  renderer?: string | ConditionalValue<string>;

  /**
   * Configuration passed to the custom renderer.
   * Only used when `renderer` is specified.
   */
  rendererConfig?: Readonly<Record<string, unknown>>;

  /**
   * Relation field configuration for rendering related entities.
   * 
   * When present, this column will be rendered using RelationFieldRenderer
   * instead of the standard template renderer, providing:
   * - Template-based display using duplicated relation data
   * - Fallback templates for ID-only data
   * - Links to related entities
   * - Modal viewing with lazy config resolution
   * - Custom actions
   * 
   * Priority: relationConfig > template > fieldType-based rendering
   * 
   * Backend auto-generates this from entity relation definitions.
   * 
   * @example
   * // To-one relation (team field showing team name with link/modal)
   * relationConfig: {
   *   routePattern: '/view-team/:teamId',
   *   identifierMapping: { source: 'teamId', target: 'teamId' },
   *   modalConfigRef: { entityName: 'team', pageType: 'view' },
   *   displayConfig: {
   *     template: '{teamName}',
   *     fallback: { template: 'Team: {teamId}' }
   *   }
   * }
   * 
   * @example
   * // To-many relation (games field showing count with modal list)
   * relationConfig: {
   *   routePattern: '/list-game',
   *   modalConfigRef: {
   *     entityName: 'game',
   *     pageType: 'list',
   *     overrideConfig: { defaultFilters: { teamId: ':teamId' } }
   *   },
   *   displayConfig: {
   *     showLink: false,
   *     showModalIcon: true
   *   }
   * }
   */
  relationConfig?: IRelationFieldConfig;

  // Filter configuration options
  filterConfig?: {
    defaultOperator?: string; // Default filter operator (e.g., 'contains', 'eq', 'in')
    availableOperators?: string[]; // Restrict available operators for this column
    predefinedOptions?: Array<{ label: string; value: string }>; // For dropdown/select filters
    filterType?: 'text' | 'select' | 'datetime' | 'number' | 'boolean'; // Filter input type
  };
}

/**
 * Page action type
 * Supports buttons, dropdowns with modals/navigation
 * Note: items cannot have nested items (max 1 level of nesting)
 */
/**
 * Page action type
 * Supports buttons, dropdowns, modals, and navigation
 * 
 * Patterns:
 * 1. Navigation: { url: "/view-user/:id" }
 * 2. Modal with inline config: { openInModal: true, modalConfig: {...} }
 * 3. Modal with route resolution: { openInModal: true, url: "/view-user/:id" }
 */
export type IPageAction = {

  id?: string;

  label: string;

  /**
   * Dynamic label template (evaluated from routeParams or record context).
   * If provided, overrides static `label` field.
   * Can be a simple string like '{teamName}' or complex object.
   */
  template?: Template;

  /**
   * Tooltip text (shown on hover).
   * Can be static string or dynamic template evaluated from routeParams/record context.
   * 
   * @example
   * // Static tooltip
   * tooltip: 'View all child spans'
   * 
   * @example
   * // Dynamic tooltip
   * tooltip: 'View trace for {correlationId}'
   * 
   * @example
   * // Complex template
   * tooltip: {
   *   composite: ['teamName', 'status'],
   *   template: 'Edit {teamName} (Status: {status})'
   * }
   */
  tooltip?: Template;

  url?: string;
  icon?: string;
  type?: 'button' | 'dropdown';
  items?: Array<Omit<IPageAction, 'items'>>;  // Items cannot have sub-items

  /** Open action in modal instead of navigating */
  openInModal?: boolean;

  /** Modal configuration (inline config or resolved from url) */
  modalConfig?: IModalConfig;

  /** 
   * Entity config reference for modal route resolution (when using openInModal without modalConfig).
   * Provides overrideConfig support for defaultFilters, hideSegments, etc.
   * Used by OpenRouteInModal component.
   * 
   * @example
   * {
   *   openInModal: true,
   *   modalConfigRef: {
   *     entityName: 'observabilityLog',
   *     pageType: 'list',
   *     overrideConfig: {
   *       defaultFilters: { parentId: ':id' },
   *       hideSegments: ['hierarchy-group']
   *     }
   *   }
   * }
   */
  modalConfigRef?: IEntityConfigReference;

  /** Custom modal width. Default: auto-detect from page type */
  modalWidth?: number | string;

  /** Override resolved page title when opened in modal */
  modalTitle?: string;

  /** Hide this action when rendered inside a modal. Default: false */
  hideInModal?: boolean;

  /** Only open in modal on specified screen size. Default: always */
  openInModalCondition?: 'sm' | 'md' | 'lg' | 'xl';

  // =========================================================================
  // DRAWER SUPPORT
  // =========================================================================

  /** Open action in drawer (slide-out panel) instead of navigating */
  openInDrawer?: boolean;

  /**
   * Drawer configuration (when openInDrawer is true).
   * Uses shared IActionDrawerConfig type from Drawer.tsx (matches IModalConfig pattern).
   * 
   * @see {@link IActionDrawerConfig} for full type definition
   */
  drawerConfig?: IActionDrawerConfig;

  /** Entity config reference for drawer route resolution */
  drawerConfigRef?: IEntityConfigReference;

  /**
   * Visibility condition for conditional rendering.
   * Supports the full Condition type: named refs, feature flags, device,
   * inline field checks, logical operators, and app-defined context.
   * Supports the full Condition type including named refs, inline checks, etc.
   */
  visibility?: Condition;

  /**
   * Enablement condition — evaluated separately from visibility.
   * When false, the action renders as disabled.
   * Supports the full Condition type.
   */
  enablement?: Condition;

  /**
   * Tooltip message shown when the action is disabled by an enablement condition.
   */
  disabledMessage?: string;

  /**
   * Link target attribute for external URLs.
   * Only applicable when url is set and action navigates to an external link.
   * Default: '_blank' for URLs starting with http:// or https://
   * 
   * @example
   * // Open external link in new tab
   * {
   *   label: 'View on Platform',
   *   url: '{platformPostUrl}',
   *   target: '_blank'
   * }
   */
  target?: '_blank' | '_self' | '_parent' | '_top';

  // =========================================================================
  // CLIPBOARD COPY ACTION (#60)
  // =========================================================================

  /**
   * Copy action configuration. When set, clicking the action copies data to clipboard.
   * Works with single records (row actions) and multiple records (bulk actions).
   *
   * @example
   * // Copy record as JSON
   * { label: 'Copy JSON', icon: 'copy', copyConfig: { format: 'json' } }
   *
   * @example
   * // Copy specific fields as CSV
   * { label: 'Export CSV', icon: 'download', copyConfig: { format: 'csv', fields: ['name', 'email'] } }
   *
   * @example
   * // Copy using template
   * { label: 'Copy Name', icon: 'copy', copyConfig: { format: 'text', template: '{firstName} {lastName}' } }
   */
  copyConfig?: {
    /** Output format */
    format: 'json' | 'csv' | 'text';
    /** Restrict to specific fields (default: all fields). Only for json/csv. */
    fields?: string[];
    /** Template for text format (supports {field} placeholders) */
    template?: Template;
  };
};

export interface IActionIndexValue {
  [ key: string ]: Array<IPageAction>;
}

export interface IRecord {
  [ key: string ]: any;
  /** Original unformatted record data, used for accurate condition evaluation */
  __raw__?: Record<string, unknown>;
}
