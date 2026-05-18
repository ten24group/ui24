import { IApiConfig, IDualApiConfig } from "../core/context";
import { FieldType, PropertyType } from "../core/types/field-types";
import type { Template, Condition, ConditionalValue, IFieldTypeProperties } from "../core/types";
import { IModalConfig, IResponseDisplayConfig } from "../modal/Modal";
import { IActionDrawerConfig } from "../modal/Drawer";
import type { IRelationFieldConfig } from "./renderers/RelationFieldRenderer";
import type { IEntityConfigReference } from "../core/hooks/useEntityConfig";
import type { ViewConfig } from "../core/common/ViewSwitcher/types";
import type { IErrorHandlingConfig, IRetryConfig } from "../core/common/ErrorFallback";
import type { IViewsConfig } from "./hooks/useTableViews";
import type { ITableDataChangePayload, IPageConfigBase, IMaskingConfig, IDerivedFieldConfig } from "../core/types/field-config";
import type { IDataQualityConfig } from "../core/common/DataQualityIndicator";

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
 * Union type for table API configs (used for type safety in view switcher layouts)
 */
export type TableApiConfigUnion = IApiConfig | ITableApiConfig | IDualTableApiConfig;

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
 * List export configuration for entity table toolbars.
 * Consumed by FW24 `tableConfig.exportConfig` on list pages.
 */
export interface IExportConfig {
  /** When false, hides the list export toolbar button. Defaults to true. */
  enabled?: boolean;
  /** Supported download formats. Defaults to csv + xlsx. */
  formats?: Array<'csv' | 'xlsx'>;
  /** Maximum records for "all filtered" export. Defaults to 10000. */
  maxRecords?: number;
  /** Page size per export fetch request. Defaults to 500. */
  pageSize?: number;
}

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

export interface ITableConfig extends IPageConfigBase {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: ITableApiConfig | IDualTableApiConfig;
  dataSource?: Array<Record<string, unknown>>;
  defaultFilters?: Record<string, unknown>;

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
    /**
     * When true, selected rows are preserved when navigating across pages (#30).
     * Shows "N selected (across all pages)" counter when selection spans pages.
     */
    readonly persistAcrossPages?: boolean;
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

  onDataChange?: (data: ITableDataChangePayload) => void;

  /**
   * List export configuration (CSV / Excel) for the table toolbar.
   * Enabled by default when an API URL is configured.
   */
  exportConfig?: IExportConfig;

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
   * Unified view switcher configuration (#119).
   * When provided, replaces the basic `displayMode` toggle with a multi-view toolbar.
   * Supports: table, card-grid, kanban, calendar, map, tree.
   * All views share the same data source — switching views does not refetch data.
   */
  viewSwitcher?: ViewConfig;

  /** Error handling configuration (#58). Custom messages per status code, fallback mode. */
  errorHandling?: IErrorHandlingConfig;
  /** Retry configuration (#58). Controls retry button and automatic retry behavior. */
  retry?: IRetryConfig;

  /**
   * Deep linking configuration (#21).
   * When enabled, table state (filters, sort, page, search, segment) is
   * synced bidirectionally with the URL query string.
   */
  deepLink?: {
    enabled: boolean;
    /** Which state slices to include in the URL (default: all) */
    include?: Array<'filters' | 'sort' | 'page' | 'segment' | 'search'>;
    /** Optional prefix for URL params to avoid collisions */
    prefix?: string;
  };

  /** Saved views configuration (#19) */
  views?: IViewsConfig;

  /** Data quality configuration (#65) — adds a completeness column when showInList is true */
  dataQuality?: IDataQualityConfig;

  /**
   * After save, highlight the row when its id is in the global recent-mutation registry (see
   * `OperationExecutor` / `recentMutationTouch` for TTL). SessionStorage keeps ids across refresh.
   * Set to `false` to disable row/card styling for this table. Omit or `true` to show highlights.
   */
  recentSaveHighlight?: boolean;

  /**
   * Virtual scrolling configuration (#29).
   * When enabled, antd Table renders only the visible rows in the DOM.
   * Dramatically improves performance for large datasets (hundreds to thousands of rows).
   *
   * Requires a fixed `scroll.y` height; rows are rendered in a virtualized container.
   * Use this for in-memory datasets or when rendering the full page at once is acceptable.
   *
   * Note: Virtual scroll does not work with pagination in the traditional sense —
   * it works best when all data is loaded at once (combine with large pageSize or no pagination).
   *
   * @example
   * virtualScroll: { enabled: true, height: 600 }
   */
  virtualScroll?: {
    /** Whether virtual scrolling is enabled */
    enabled: boolean;
    /** Visible area height in pixels. Required for virtual scroll to work. Default: 500 */
    height?: number;
  };

  /**
   * Summary row configuration (#27).
   * Renders an aggregation row at the bottom of the table (antd Table `summary` prop).
   *
   * @example
   * summary: {
   *   columns: [
   *     { dataIndex: 'amount', aggregation: 'sum', prefix: 'Total: $' },
   *     { dataIndex: 'items', aggregation: 'count', label: 'Count' },
   *   ]
   * }
   */
  summary?: ITableSummaryConfig;

  /**
   * Drag-to-reorder row configuration (#62).
   * When enabled, renders a drag handle column. User can reorder rows by dragging.
   * Best suited for fully-loaded, non-paginated lists.
   * 
   * @example
   * rowDrag: {
   *   enabled: true,
   *   onOrderChange: { apiUrl: '/items/reorder', apiMethod: 'POST' },
   *   orderField: 'sortOrder',
   * }
   */
  rowDrag?: {
    enabled: boolean;
    /**
     * API config for persisting the new order after drag.
     * Receives `{ ids: string[] }` as the request body (ordered list of record IDs).
     */
    onOrderChange?: IApiConfig;
    /** Field name on the record that stores the sort order (used to display current order) */
    orderField?: string;
  };
}

/**
 * Conditional formatting rule for cell or row styling.
 * When the condition matches the row record, the style/className is applied.
 */
/** Summary row column configuration — defines how each column contributes to the summary row (#27) */
export interface ITableSummaryColumnConfig {
  /** The column dataIndex this aggregation applies to */
  dataIndex: string;
  /** Aggregation function */
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  /** Text prefix shown before the value (e.g. 'Total: $') */
  prefix?: string;
  /** Text suffix shown after the value (e.g. ' items') */
  suffix?: string;
  /** Override label shown when aggregation is 'count' (default: count of rows) */
  label?: string;
  /** Number of decimal places for numeric display. Default: 2 for avg, 0 for sum/min/max/count */
  precision?: number;
}

/** Summary row configuration — renders an aggregation footer in the table (#27) */
export interface ITableSummaryConfig {
  /** Columns to aggregate. Only listed columns appear in the summary row. */
  columns: ITableSummaryColumnConfig[];
  /**
   * Optional label shown in the first column cell of the summary row (e.g. 'Totals').
   * When provided, takes priority over any aggregation configured on the first column.
   */
  label?: string;
}

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
  masking?: IMaskingConfig;
  derived?: IDerivedFieldConfig;

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
  /**
   * Action presentation type.
   * - 'button': standard button (default)
   * - 'dropdown': labeled button with dropdown arrow + items
   * - 'more': icon-only ellipsis button — for secondary/grouped actions (#18)
   */
  type?: 'button' | 'dropdown' | 'more';
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
   * Permission shorthand (#102). Auto-expanded to:
   *   visibility: { actor: { permissions: { [permission]: { eq: true } } } }
   * Merged with any explicit `visibility` condition via AND.
   */
  permission?: string;

  /**
   * Visibility condition for conditional rendering.
   * Supports the full Condition type: named refs, feature flags, device,
   * inline field checks, logical operators, and app-defined context.
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

  /**
   * Clone / duplicate action configuration (#43).
   * Navigates to a create form pre-filled with the current record's data,
   * omitting identity/timestamp fields so the user is creating a new record.
   *
   * @example
   * // Simple: navigate to the entity's standard create page
   * { label: 'Clone', icon: 'copy', cloneConfig: { createUrl: '/create-template' } }
   *
   * @example
   * // With field exclusions
   * { label: 'Duplicate', icon: 'copy', cloneConfig: { createUrl: '/create-post', excludeFields: ['slug', 'publishedAt'] } }
   *
   * @example
   * // Only clone specific fields
   * { label: 'Use as Template', icon: 'template', cloneConfig: { createUrl: '/create-template', includeFields: ['title', 'body', 'tags'] } }
   */
  cloneConfig?: {
    /** URL of the create form to navigate to */
    createUrl: string;
    /**
     * Fields to exclude from the pre-filled values.
     * These are merged with the default system exclusions:
     * identifiers (e.g. 'id', 'entityId', fields ending in 'Id'),
     * and timestamp fields ('createdAt', 'updatedAt').
     */
    excludeFields?: string[];
    /**
     * Whitelist: only pre-fill these fields (takes precedence over excludeFields).
     */
    includeFields?: string[];
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
