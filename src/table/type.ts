import { IApiConfig } from "../core/context";
import { IModalConfig } from "../modal/Modal";
type ITablePagination = "default";

export interface ITableConfig {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig;
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
  fieldType?: string;
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

export interface IDropdownItem {
  label: string;
  url: string;
  icon?: string;
}

export type IPageAction = {
  url?: string;
  label: string;
  icon?: string;
  type?: 'button' | 'dropdown';
  items?: IDropdownItem[];
  openInModal?: boolean;
  modalConfig?: IModalConfig;
};

export interface IActionIndexValue {
  [ key: string ]: Array<IPageAction>;
}

export interface IRecord {
  [ key: string ]: string;
}
