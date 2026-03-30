/**
 * Built-in field type registrations.
 * 
 * This module registers all built-in field type renderers at startup.
 * Import this module early (before any rendering) to ensure registrations are in place.
 */

import { fieldTypeRegistry } from '../FieldTypeRegistry';
import { textRegistrations } from './text';
import { numberRegistrations } from './number';
import { selectRegistrations } from './select';
import { dateRegistrations } from './date';
import { booleanRegistrations } from './boolean';
import { mediaRegistrations } from './media';
import { richContentRegistrations } from './rich-content';
import { displayRegistrations } from './display';
import { embedRegistrations } from './embed';
import { sparklineRegistrations } from './sparkline';
import { inlineTableRegistrations } from './inline-table';

export function registerBuiltInFieldTypes(): void {
  if (fieldTypeRegistry.isInitialized()) return;

  fieldTypeRegistry.registerAll(textRegistrations);
  fieldTypeRegistry.registerAll(numberRegistrations);
  fieldTypeRegistry.registerAll(selectRegistrations);
  fieldTypeRegistry.registerAll(dateRegistrations);
  fieldTypeRegistry.registerAll(booleanRegistrations);
  fieldTypeRegistry.registerAll(mediaRegistrations);
  fieldTypeRegistry.registerAll(richContentRegistrations);
  fieldTypeRegistry.registerAll(displayRegistrations);
  fieldTypeRegistry.registerAll(embedRegistrations);
  fieldTypeRegistry.registerAll(sparklineRegistrations);
  fieldTypeRegistry.registerAll(inlineTableRegistrations);

  fieldTypeRegistry.markInitialized();
}

// Auto-register on import
registerBuiltInFieldTypes();

// Re-export types for consumers
export type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
