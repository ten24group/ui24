/**
 * Shared JSON utility functions for consistent JSON handling across Table and Detail components
 */

/**
 * Generate a smart preview label from JSON data
 * Used by both Table (for button labels) and JsonViewer (for compact previews)
 * 
 * @param data - The data to generate a preview for
 * @param options - Configuration options
 * @returns A human-readable preview string
 * 
 * @example
 * generateJsonPreview({ name: "John", age: 30 }) 
 * // Returns: "{ name, age }"
 * 
 * generateJsonPreview({ a: 1, b: 2, c: 3, d: 4, e: 5 })
 * // Returns: "{ a, b, c ... +2 }"
 * 
 * generateJsonPreview([1, 2, 3])
 * // Returns: "[ 3 items ]"
 */
export const generateJsonPreview = (
  data: unknown, 
  options: {
    maxStringLength?: number;  // Max chars before truncating strings (default: 50)
    maxKeys?: number;          // Max object keys to show (default: 3)
  } = {}
): string => {
  const { maxStringLength = 50, maxKeys = 3 } = options;
  
  // Handle strings
  if (typeof data === 'string') {
    return data.length > maxStringLength 
      ? `${data.substring(0, maxStringLength)}...` 
      : data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';
    return `[ ${data.length} items ]`;
  }
  
  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    if (keys.length === 0) return '{}';
    if (keys.length <= maxKeys) {
      return `{ ${keys.join(', ')} }`;
    }
    return `{ ${keys.slice(0, maxKeys).join(', ')} ... +${keys.length - maxKeys} }`;
  }
  
  // Fallback for other types
  return String(data);
};

