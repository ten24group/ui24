import { getNestedValue } from "../utils";
import type { Template, ITemplateConfig } from "../types/field-config";

/**
 * Parse a simple template string into ITemplateConfig.
 * Extracts all {field} placeholders from the template.
 * 
 * @param template - Template string with {field} placeholders
 * @returns ITemplateConfig with composite fields and template
 * 
 * @example
 * parseSimpleTemplate('{firstName} {lastName}')
 * // Returns: { composite: ['firstName', 'lastName'], template: '{firstName} {lastName}' }
 */
export function parseSimpleTemplate(template: string): ITemplateConfig {
  const composite = template.match(/\{([\w.]+)\}/g)?.map(m => m.slice(1, -1)) || [];
  return { composite, template };
}

/**
 * Interpolate a template with values from context object.
 * Supports dot notation for nested access (e.g., 'team.name').
 * Missing fields are replaced with empty string.
 * 
 * @param templateConfig - Template configuration
 * @param context - Context object with values
 * @returns Interpolated string
 * 
 * @example
 * interpolateTemplate(
 *   { composite: ['name', 'team.city'], template: '{name} ({team.city})' },
 *   { name: 'Lakers', team: { city: 'Los Angeles' } }
 * )
 * // Returns: "Lakers (Los Angeles)"
 */
export function interpolateTemplate(
  templateConfig: ITemplateConfig,
  context: Record<string, any>
): string {
  const { composite, template } = templateConfig;
  let result = template;
  
  composite.forEach((fieldPath) => {
    const regex = new RegExp(`\\{${fieldPath.replace(/\./g, '\\.')}\\}`, 'g');
    const value = getNestedValue(context, fieldPath);
    
    if (value === undefined && process.env.NODE_ENV === 'development') {
      console.warn(`[Template] Missing field '${fieldPath}' in context for template: ${template}`);
    }
    
    result = result.replace(regex, value !== undefined ? String(value) : '');
  });
  
  return result;
}

/**
 * Evaluate a template (string or config) against context.
 * Convenience function that handles both formats.
 * 
 * - If string: parses and interpolates it
 * - If object: interpolates directly
 * - Gracefully handles errors with fallback to empty string
 * 
 * @param template - Template string or config object
 * @param context - Context object with values
 * @returns Interpolated string
 * 
 * @example
 * evaluateTemplate('{name}', { name: 'Lakers' })
 * // Returns: "Lakers"
 * 
 * @example
 * evaluateTemplate(
 *   { composite: ['name', 'city'], template: '{name} ({city})' },
 *   { name: 'Lakers', city: 'Los Angeles' }
 * )
 * // Returns: "Lakers (Los Angeles)"
 */
export function evaluateTemplate(
  template: Template,
  context: Record<string, any>
): string {
  try {
    if (typeof template === 'string') {
      return interpolateTemplate(parseSimpleTemplate(template), context);
    }
    return interpolateTemplate(template, context);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Template] Evaluation failed:', error, { template, context });
    }
    return '';
  }
}

/**
 * Helper to evaluate a value that can be a static string or a template.
 * This is the standard pattern used throughout the UI for template-enabled fields.
 * 
 * @param value - Static string, template, or undefined
 * @param context - Context object with values
 * @param fallback - Optional fallback value if value is undefined
 * @returns Evaluated string
 * 
 * @example
 * evaluateTemplateValue('Edit Team', {}, 'Default')
 * // Returns: "Edit Team" (static string)
 * 
 * @example
 * evaluateTemplateValue('Edit {teamName}', { teamName: 'Lakers' }, 'Default')
 * // Returns: "Edit Lakers" (simple template)
 * 
 * @example
 * evaluateTemplateValue(undefined, {}, 'Default')
 * // Returns: "Default" (fallback)
 */
export function evaluateTemplateValue(
  value: Template | undefined,
  context: Record<string, any>,
  fallback: string = ''
): string {
  if (!value) {
    return fallback;
  }
  
  if (typeof value === 'string') {
    // Check if it contains template placeholders
    if (value.includes('{') && value.includes('}')) {
      return evaluateTemplate(value, context);
    }
    // Static string - use as-is
    return value;
  }
  
  // Complex template object
  return evaluateTemplate(value, context);
}

