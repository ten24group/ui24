import { IApiConfig, IDualApiConfig } from "../core/context";
import { FieldType } from "../core/types/field-types";
import { IModalConfig } from "../modal/Modal";
type ITablePagination = "default";

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
 *       responseKey: "items"
 *     },
 *     database: {
 *       apiUrl: "/api/posts",
 *       apiMethod: "GET",
 *       responseKey: "data"
 *     }
 *   }
 * }
 * ```
 */
export interface ITableConfig {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig | IDualApiConfig;
  records?: Array<any>;
  paginationType?: ITablePagination;
  routeParams?: Record<string, string>;
}

export interface ITablePropertiesConfig {
  name: string;
  dataIndex: string;
  actions?: Array<IPageAction>;
  hidden?: boolean;
  isFilterable?: boolean;
  isIdentifier?: boolean;
  isSortable?: boolean;
  fieldType?: FieldType;
  placeholder?: string;
  helpText?: string;
  // New filter configuration options
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
  label: string;
  url?: string;
  icon?: string;
  type?: 'button' | 'dropdown';
  items?: Array<Omit<IPageAction, 'items'>>;  // Items cannot have sub-items
  
  /** Open action in modal instead of navigating */
  openInModal?: boolean;
  
  /** Modal configuration (inline config or resolved from url) */
  modalConfig?: IModalConfig;
  
  /** Custom modal width. Default: auto-detect from page type */
  modalWidth?: number | string;
  
  /** Override resolved page title when opened in modal */
  modalTitle?: string;
  
  /** Hide this action when rendered inside a modal. Default: false */
  hideInModal?: boolean;
  
  /** Only open in modal on specified screen size. Default: always */
  openInModalCondition?: 'sm' | 'md' | 'lg' | 'xl';
};

export interface IActionIndexValue {
  [ key: string ]: Array<IPageAction>;
}

export interface IRecord {
  [ key: string ]: string;
}
