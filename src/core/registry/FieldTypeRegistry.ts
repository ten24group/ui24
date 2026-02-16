/**
 * FieldTypeRegistry — Centralized registry for built-in field type renderers.
 * 
 * Replaces the 3 massive switch/if-else blocks in FormField.tsx, Details.tsx, and useTable.tsx
 * with a single registry-based lookup.
 * 
 * Resolution order at the consumer level (FormField.tsx, Details.tsx, useTable.tsx):
 * 1. Entity-level overrides (via ExtensionRegistry.registerEntityField)
 * 2. Custom overrides (via ExtensionRegistry.overrideFieldType) — different prop contract
 * 3. Built-in registrations (this registry, registered at startup from field-types/ files)
 * 4. null (no renderer found — caller handles fallback)
 * 
 * Note: ExtensionRegistry handles steps 1-2 with its own prop types (FormFieldRendererProps, etc.).
 * This registry handles step 3 with built-in prop types (BuiltInFormFieldProps, etc.).
 * Consumers check ExtensionRegistry first, then fall through to this registry.
 * 
 * Usage:
 *   fieldTypeRegistry.register('text', { form: TextFormRenderer, detail: TextDetailRenderer, table: TextColumnRenderer });
 *   const Renderer = fieldTypeRegistry.get('text', 'form');
 */

import type { ComponentType } from 'react';
import type { FieldContext } from './types';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './field-types/types';

/**
 * A complete field type registration — one renderer per context (form, detail, table).
 * Not all contexts need to be provided; missing ones will fall through.
 */
export interface FieldTypeRegistration {
  /** Renderer for form context (FormField.tsx) */
  form?: ComponentType<BuiltInFormFieldProps>;
  /** Renderer for detail context (Details.tsx) */
  detail?: ComponentType<BuiltInDetailFieldProps>;
  /** Renderer for table context (useTable.tsx column render) */
  table?: ComponentType<BuiltInTableFieldProps>;
  /** Default props merged into renderer props */
  defaultProps?: Record<string, unknown>;
  /** Coerce raw value before passing to renderer */
  coerceValue?: (raw: unknown) => unknown;
  /** Check if a value is considered "empty" for this field type */
  isEmpty?: (value: unknown) => boolean;
}

type ContextRendererType = {
  form: ComponentType<BuiltInFormFieldProps>;
  detail: ComponentType<BuiltInDetailFieldProps>;
  table: ComponentType<BuiltInTableFieldProps>;
};

class FieldTypeRegistryImpl {
  /** Built-in field type registrations */
  private builtInTypes = new Map<string, FieldTypeRegistration>();
  
  private initialized = false;

  /**
   * Register a built-in field type.
   * Called at startup from field-types/ registration files.
   */
  register(fieldType: string, registration: FieldTypeRegistration): void {
    this.builtInTypes.set(fieldType.toLowerCase(), registration);
  }

  /**
   * Register multiple field types at once (convenience).
   */
  registerAll(registrations: Record<string, FieldTypeRegistration>): void {
    for (const [fieldType, registration] of Object.entries(registrations)) {
      this.register(fieldType, registration);
    }
  }

  /**
   * Get the renderer for a field type and context.
   * Returns null if no renderer is registered.
   * 
   * Note: Custom overrides are handled by ExtensionRegistry at the consumer level
   * (checked before this registry). This only looks up built-in types.
   */
  get<C extends FieldContext>(fieldType: string, context: C): ContextRendererType[C] | null {
    const key = fieldType.toLowerCase();
    
    const builtIn = this.builtInTypes.get(key);
    if (builtIn && builtIn[context]) {
      return builtIn[context] as ContextRendererType[C];
    }
    
    return null;
  }

  /**
   * Get the full registration for a field type (for accessing defaultProps, coerceValue, etc.).
   */
  getRegistration(fieldType: string): FieldTypeRegistration | undefined {
    return this.builtInTypes.get(fieldType.toLowerCase());
  }

  /**
   * Check if a field type has any renderer registered.
   */
  has(fieldType: string, context?: FieldContext): boolean {
    const key = fieldType.toLowerCase();
    
    if (context) {
      return this.get(key, context) !== null;
    }
    
    return this.builtInTypes.has(key);
  }

  /**
   * List all registered field types.
   */
  listFieldTypes(): string[] {
    return Array.from(this.builtInTypes.keys()).sort();
  }

  /**
   * Mark the registry as initialized (all built-in types registered).
   */
  markInitialized(): void {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get diagnostic info.
   */
  getDiagnostics(): { builtInCount: number; initialized: boolean } {
    return {
      builtInCount: this.builtInTypes.size,
      initialized: this.initialized,
    };
  }

  /**
   * Clear all registrations (for testing).
   */
  clear(): void {
    this.builtInTypes.clear();
    this.initialized = false;
  }
}

/**
 * Singleton instance of the Field Type Registry.
 */
export const fieldTypeRegistry = new FieldTypeRegistryImpl();
