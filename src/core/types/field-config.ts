import { ReactNode } from 'react';
import { FieldType, PropertyType } from './field-types';
import { IModalConfig } from '../../modal/Modal';
import { GetSignedUploadUrlAPIConfig } from '../common';
import { IEntityConfigReference } from '../hooks';

/**
 * Single option for select, radio, checkbox, etc.
 */
export interface IOptions {
  label: string;
  value: string | number;
}

/**
 * Validation types supported by the form system
 */
export type IPreDefinedValidations = "required" | "email" | `match:${string}`;

/**
 * Base field configuration - shared properties across all field types
 */
export interface IBaseFieldConfig {
  // Identification
  id?: string;
  name?: string;  // Field name / property path (supports dot notation)
  column?: string; // Column name (legacy, prefer 'name')
  label: string;
  
  // Display
  placeholder?: string;
  helpText?: string;
  hidden?: boolean;
  
  // Type & Behavior
  fieldType?: FieldType;
  type?: PropertyType; // For complex types (list, map)
  
  // Values
  defaultValue?: any; // Default value from backend entity schema (for new records)
  initialValue?: any; // Initial value for editing (from API response)
  
  // Nested structures (for list/map types)
  properties?: Array<any>; // Will be properly typed in specific interfaces
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
 * Used internally by Form components after conversion from IFormFieldResponse
 */
export interface IFormField extends IBaseFieldConfig {
  // Form-specific properties
  namePrefixPath?: any[]; // For nested form fields
  validationRules?: Array<any>; // Ant Design validation rules
  prefixIcon?: ReactNode;
  style?: React.CSSProperties;
  setFormValue?: Function; // Callback for custom value updates
  timezone?: string; // For date/time fields
  
  // Options for select/radio/checkbox
  options?: Array<IOptions>;
  
  // Modal/Entity references
  addNewOption?: IModalConfig; // DEPRECATED: Use addNewOptionConfig
  addNewOptionConfig?: IEntityConfigReference;
  
  // File/Image fields
  accept?: string;
  fileNamePrefix?: string;
  listType?: string;
  getSignedUploadUrlAPIConfig?: GetSignedUploadUrlAPIConfig;
  withImageCrop?: boolean;
  
  // Nested structures
  properties?: Array<IFormField>;
  items?: {
    type: PropertyType;
    properties?: Array<IFormField>;
  };
}

/**
 * Detail page field configuration
 * Used by Details component for displaying data
 */
export interface IDetailFieldConfig extends IBaseFieldConfig {
  timezone?: string; // For date/time formatting
  
  // Link configuration
  isLink?: boolean;
  linkConfig?: {
    routePattern: string;
    displayText?: string;
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
    modalConfigRef?: {
      entityName: string;
      pageType: 'view' | 'create' | 'list';
      overrideConfig?: Record<string, any>;
    };
    modalWidth?: number | string;
    modalTitle?: string;
    displayConfig?: {
      showModalIcon?: boolean;
      icon?: string;
      showLink?: boolean;
    };
  };
  
  // Entity config reference for addNewOption
  addNewOptionConfig?: IEntityConfigReference;
  
  // Nested structures
  properties?: Array<IDetailFieldConfig>;
  items?: {
    type: PropertyType;
    properties?: Array<IDetailFieldConfig>;
  };
}

