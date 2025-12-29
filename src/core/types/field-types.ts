/**
 * Field types that are consistent with the backend ConfigFieldType in fw24/src/ui-config-gen/templates/custom-page.ts
 * MUST maintain 100% parity with backend - DO NOT ADD OR REMOVE TYPES without updating backend first
 */
export type FieldType =
  // Basic text input
  | "text"
  | "textarea"
  | "password"
  | "email"
  | "url"
  | "phone"
  | "hidden"

  // Numeric input
  | "number"
  | "currency"
  | "percentage"
  | "range"
  | "slider"
  | "rating"

  // Date & time
  | "date"
  | "time"
  | "datetime"
  | "duration"
  | "ttl"

  // Boolean & toggle
  | "boolean"
  | "switch"
  | "toggle"
  | "checkbox"

  // Selection & options
  | "select"
  | "multi-select"
  | "autocomplete"
  | "radio"

  // Visual & display
  | "badge"
  | "tag"
  | "tags"
  | "progress"
  | "avatar"
  | "color"
  | "icon"

  // Structured data
  | "json"
  | "code"
  | "markdown"
  | "rich-text"
  | "wysiwyg"

  // Links & navigation
  | "link"

  // Files & media
  | "file"
  | "image"
  | "video"
  | "audio"
  | "qrcode"

  // Timeline & events
  | "timeline"

  // Special
  | "custom";

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