import type { IApiConfig } from '../../context/ApiContext';

export type ViewType = 'table' | 'card-grid' | 'kanban' | 'calendar' | 'map' | 'tree';

// ─── Card Tag Configuration ────────────────────────────────────────────────────

export interface CardTagField {
  /** Record field whose value becomes the tag text */
  field: string;
  /** Maps field values to antd preset colours (e.g. 'success', 'blue', '#f50') */
  colorMapping?: Record<string, string>;
}

// ─── Card Action ────────────────────────────────────────────────────────────────

export interface CardAction {
  /** Button label */
  label: string;
  /** Navigate URL with `:id` / `:fieldName` placeholders */
  url: string;
  /** antd icon name (optional) */
  icon?: string;
}

// ─── Card Status Mapping ────────────────────────────────────────────────────────

export interface CardStatusConfig {
  /** Maps field values to badge colour + optional label override */
  [ value: string ]: { color: string; label?: string };
}

// ─── Card Grid Config ───────────────────────────────────────────────────────────

export interface CardGridConfig {
  /** Number of columns in the card grid (default: responsive 3) */
  columns?: number;
  /** Field name for card title */
  titleField: string;
  /** Field name for card description */
  descriptionField?: string;
  /** Field name for inline avatar (square thumbnail) */
  imageField?: string;
  /** Field for circular avatar (user photo, team logo) */
  avatarField?: string;
  /** Field for a cover/hero image rendered at the top of the card */
  coverImageField?: string;
  /** Additional fields to show as key-value summary */
  summaryFields?: string[];
  /** Render field values as coloured tags */
  tagFields?: CardTagField[];
  /** Display a formatted date on the card */
  dateField?: string;
  /** Field whose value drives a status badge via statusMapping */
  statusField?: string;
  /** Maps status values to badge colours/labels */
  statusMapping?: CardStatusConfig;
  /** Card-level action buttons with `:id` placeholder support */
  actions?: CardAction[];
  /** Card orientation (default: 'vertical') */
  layout?: 'vertical' | 'horizontal';
  /** Visual separator between main content and summary section */
  showDivider?: boolean;
}

// ─── Kanban Card Config ─────────────────────────────────────────────────────────

export interface KanbanCardConfig {
  titleField: string;
  descriptionField?: string;
  summaryFields?: string[];
  /** Render field values as coloured tags */
  tagFields?: CardTagField[];
  /** Field for inline avatar */
  avatarField?: string;
  /** Display a formatted date on the card */
  dateField?: string;
  /** Field whose value drives a status badge via statusMapping */
  statusField?: string;
  /** Maps status values to badge colours/labels */
  statusMapping?: CardStatusConfig;
  /** Card-level action buttons with `:id` placeholder support */
  actions?: CardAction[];
}

// ─── Kanban View Config (#46) ───────────────────────────────────────────────────

export interface KanbanViewConfig {
  /** Field on the record that determines the column it belongs to */
  groupByField: string;
  /** Column definitions — order and labels */
  columns: Array<{ value: string; label: string; color?: string; wipLimit?: number }>;
  /** Card field mappings */
  card: KanbanCardConfig;
  /** Allow drag-and-drop between columns */
  allowDrag?: boolean;
  /** API called when a card is moved to a different column */
  moveApiConfig?: { apiUrl: string; apiMethod: string };
  /** Navigate here on card click. Supports `:id` / `:idField` placeholders. */
  onClickNavigateTo?: string;
  /** Field used as the record's unique identifier */
  idField?: string;
  /** API config for independent per-column data fetching (enables load-more per column) */
  apiConfig?: IApiConfig;
  /** Items to load per column per page (default: 20, only used with apiConfig) */
  columnPageSize?: number;
  /** Static inline data (priority: apiConfig > data > shared parent records) */
  data?: Array<Record<string, unknown>>;
}

// ─── Calendar View Config (#45) ─────────────────────────────────────────────────

export interface CalendarViewConfig {
  /** Field containing the event start date (ISO string or YYYY-MM-DD) */
  startDateField: string;
  /** Optional end date field for multi-day events */
  endDateField?: string;
  /** Field used as the event badge title */
  titleField: string;
  /** Default calendar panel mode — antd Calendar only supports 'month' and 'year' */
  defaultMode?: 'month' | 'year';
  /** Field whose value drives badge colour via colorMapping */
  colorField?: string;
  /** Maps field values to antd Badge statuses ('success' | 'warning' | 'error' | 'default' | 'processing') */
  colorMapping?: Record<string, string>;
  /** Navigate here when an event is clicked. Supports `:id` / `:idField` placeholders. */
  onEventClickNavigateTo?: string;
  /** Field used as the record's unique identifier */
  idField?: string;
  /** API config for independent date-range-filtered fetching */
  apiConfig?: IApiConfig;
  /** Safety limit for max events to fetch (default: 5000, only used with apiConfig) */
  maxEvents?: number;
  /** Static inline data (priority: apiConfig > data > shared parent records) */
  data?: Array<Record<string, unknown>>;
}

// ─── Tree View Config (#47) ─────────────────────────────────────────────────────

export interface TreeViewConfig {
  /** Field referencing the parent record's id */
  parentField: string;
  /** Field used as the tree node label */
  labelField: string;
  /** How many levels to expand by default (0 = collapsed, Infinity = all) */
  defaultExpandDepth?: number;
  /** Navigate here when a tree node is clicked */
  onNodeClickNavigateTo?: string;
  /** Field used as the record's unique identifier */
  idField?: string;
  /** API config for independent full-dataset fetching */
  apiConfig?: IApiConfig;
  /** Safety limit for max records to fetch (default: 5000, only used with apiConfig) */
  maxRecords?: number;
  /** Static inline data (priority: apiConfig > data > shared parent records) */
  data?: Array<Record<string, unknown>>;
}

// ─── Map View Config (#48) ──────────────────────────────────────────────────────

export interface MapViewConfig {
  /** Field containing latitude */
  latField: string;
  /** Field containing longitude */
  lngField: string;
  /** Field used as the marker title */
  titleField: string;
  /** Additional fields shown in the marker popup */
  summaryFields?: string[];
  /** Enable marker clustering */
  cluster?: boolean;
  /** Navigate here when a marker is clicked */
  onMarkerClickNavigateTo?: string;
  /** Field used as the record's unique identifier */
  idField?: string;
  /** Default map center as [lat, lng] */
  defaultCenter?: [ number, number ];
  /** Default zoom level */
  defaultZoom?: number;
  /** Map height in pixels */
  mapHeight?: number;
  /** API config for independent full-dataset fetching */
  apiConfig?: IApiConfig;
  /** Safety limit for max records to fetch (default: 5000, only used with apiConfig) */
  maxRecords?: number;
  /** Static inline data (priority: apiConfig > data > shared parent records) */
  data?: Array<Record<string, unknown>>;
}

// ─── Top-Level View Config ──────────────────────────────────────────────────────

export interface ViewConfig {
  /** Available view types for this page */
  available: ViewType[];
  /** Default view on first visit */
  default: ViewType;
  /** Persist user's view preference to localStorage */
  persistPreference?: boolean;
  /** Card grid configuration (required when 'card-grid' is in available) */
  cardConfig?: CardGridConfig;
  /** Kanban board configuration (required when 'kanban' is in available) */
  kanbanConfig?: KanbanViewConfig;
  /** Calendar view configuration (required when 'calendar' is in available) */
  calendarConfig?: CalendarViewConfig;
  /** Tree view configuration (required when 'tree' is in available) */
  treeConfig?: TreeViewConfig;
  /** Map view configuration (required when 'map' is in available) */
  mapConfig?: MapViewConfig;
}
