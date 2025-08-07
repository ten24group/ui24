/**
 * Field types that are consistent with the backend base-entity.ts
 * These types match exactly with the FieldMetadata types in base-entity.ts
 */
export type FieldType = 
  | "text" 
  | "textarea" 
  | "password" 
  | "email"
  | "number" 
  | "date" 
  | "time" 
  | "datetime" 
  | "boolean" 
  | "switch" 
  | "toggle" 
  | "select" 
  | "multi-select" 
  | "autocomplete" 
  | "radio" 
  | "checkbox" 
  | "color" 
  | "range" 
  | "hidden" 
  | "custom" 
  | "rating" 
  | "file" 
  | "image" 
  | "rich-text" 
  | "wysiwyg" 
  | "code" 
  | "markdown" 
  | "json";

/**
 * Property types for complex field structures
 */
export type PropertyType = "list" | "map" | "object";

/**
 * Filter types that correspond to field types
 */
export type FilterType = "text" | "select" | "datetime" | "number" | "boolean";

/**
 * Validation types
 */
export type ValidationType = "required" | "email" | `match:${string}`;

/**
 * Action types for table actions
 */
export type ActionType = "button" | "link" | "modal";

/**
 * Modal types
 */
export type ModalType = "confirm" | "list" | "form" | "accordion" | "custom" | "details"; 