import { IApiConfig } from "../core/context";
import { IModalConfig } from "../modal/Modal";
type ITablePagination = "default";

export interface ITableConfig {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig;
  records?: Array<any>;
  paginationType?: ITablePagination;
}

export interface ITablePropertiesConfig {
  name: string;
  dataIndex: string;
  actions?: Array<IPageAction>;
  hidden?: boolean;
  isFilterable?: boolean;
  isIdentifier?: boolean;
  fieldType?: string;
}
export type IPageAction = {
  url: string;
  label: string;
  icon: string;
  htmlType: string;
  openInModel?: boolean;
  modelConfig?: IModalConfig;
};

export interface IActionIndexValue {
  [key: string]: Array<IPageAction>;
}
export interface IRecord {
  [key: string]: string;
}
