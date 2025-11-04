import { ReactNode } from 'react';
import { FieldType, PropertyType } from './field-types';
import { IModalConfig } from '../../modal/Modal';
import { GetSignedUploadUrlAPIConfig } from '../common';
import { IEntityConfigReference } from '../hooks';

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
  
  // Nested structures
  properties?: Array<IDetailFieldConfig>;
  items?: {
    type: PropertyType;
    properties?: Array<IDetailFieldConfig>;
  };
}

