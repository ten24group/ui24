/**
 * @fileoverview Extension Registry - Core extensibility system for UI24
 * 
 * Single registry for all UI extensions:
 * - Custom page types (kanban, calendar, etc.)
 * - Entity page overrides (replace standard pages per entity)
 * - Custom field renderers (form, detail, table)
 * - Custom widget types
 * - Conditional overrides (role-based, feature-flag based)
 * 
 * @example
 * import { ExtensionRegistry } from '@ten24group/ui24';
 * 
 * // Register custom page type
 * ExtensionRegistry.registerPageType({
 *   key: 'kanban',
 *   component: KanbanBoard
 * });
 * 
 * // Override entity page
 * ExtensionRegistry.registerEntityPage({
 *   entity: 'game',
 *   pageType: 'list',
 *   component: GameCalendar
 * });
 * 
 * // Register custom field renderer
 * ExtensionRegistry.registerFieldRenderer({
 *   key: 'address-picker',
 *   contexts: ['form', 'detail'],
 *   component: AddressPicker
 * });
 */

import type { ComponentType } from 'react';
import type {
  ResolverContext,
  OverridablePageType,
  FieldContext,
  PageComponentProps,
  FormFieldRendererProps,
  DetailFieldRendererProps,
  ColumnRendererProps,
  WidgetRendererProps,
  PageTypeRegistrationConfig,
  EntityPageRegistrationConfig,
  FieldRendererRegistrationConfig,
  FieldTypeOverrideConfig,
  EntityFieldRegistrationConfig,
  WidgetRegistrationConfig,
  WidgetTypeOverrideConfig,
  ConditionalRegistrationConfig,
  ConditionFn,
  RegistrationInfo,
  RegistrationCategory,
  ColumnConfig,
} from './types';

// ============================================================================
// INTERNAL STORAGE TYPES
// ============================================================================

/** Component type categories */
type ComponentCategory = 'page' | 'widget' | 'field' | 'renderer';

interface ComponentRegistration {
  readonly component: ComponentType<unknown>;
  readonly category: ComponentCategory;
  readonly description?: string;
}

interface PageTypeRegistration {
  readonly component: ComponentType<PageComponentProps>;
  readonly description?: string;
}

interface FieldRendererRegistration {
  readonly component: ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps>;
  readonly contexts: ReadonlyArray<FieldContext>;
  readonly description?: string;
}

interface WidgetRegistration {
  readonly component: ComponentType<WidgetRendererProps>;
  readonly description?: string;
}

interface ConditionalRegistration {
  readonly condition: ConditionFn;
  readonly key: string;
  readonly component: ComponentType<unknown>;
  readonly description?: string;
}

/** Command registration for the Command Palette (#63) */
export interface CommandRegistration {
  /** Unique command ID */
  readonly id: string;
  /** Display label shown in the palette */
  readonly label: string;
  /** Group/category (e.g. 'Navigation', 'Actions', 'Settings') */
  readonly group?: string;
  /** Icon name (from Icons component) */
  readonly icon?: string;
  /** Keyboard shortcut hint (display only, e.g. 'Ctrl+E') */
  readonly shortcut?: string;
  /** Handler called when the command is selected */
  readonly handler: () => void;
}

// Key types
type EntityPageKey = `${string}:${OverridablePageType}`;
type EntityFieldKey = `${string}:${string}:${FieldContext | 'all'}`;
type FieldTypeKey = `${string}:${FieldContext | 'all'}`;

// ============================================================================
// REGISTRY IMPLEMENTATION
// ============================================================================

class ExtensionRegistryImpl {
  // Core registrations
  private readonly components = new Map<string, ComponentRegistration>();
  private readonly pageTypes = new Map<string, PageTypeRegistration>();
  private readonly entityPages = new Map<EntityPageKey, ComponentType<PageComponentProps>>();
  private readonly fieldRenderers = new Map<string, FieldRendererRegistration>();
  private readonly fieldTypeOverrides = new Map<FieldTypeKey, ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps>>();
  private readonly entityFields = new Map<EntityFieldKey, ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps>>();
  private readonly widgets = new Map<string, WidgetRegistration>();
  private readonly widgetTypeOverrides = new Map<string, ComponentType<WidgetRendererProps>>();
  private readonly conditionals: ConditionalRegistration[] = [];
  private readonly commands: CommandRegistration[] = [];

  private debugMode = false;
  private initialized = false;

  // ══════════════════════════════════════════════════════════════════════════
  // GENERIC COMPONENT REGISTRATION (for custom pages/widgets by key)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a component by key.
   * Used for custom pages and widgets that are referenced by componentKey in config.
   */
  public register<P = unknown>(config: {
    readonly key: string;
    readonly component: ComponentType<P>;
    readonly category: ComponentCategory;
    readonly description?: string;
  }): void {
    this.validateKey(config.key, 'component');
    this.warnIfInitialized('register', config.key);

    if (this.components.has(config.key)) {
      this.log('warn', `Overwriting component: ${config.key}`);
    }

    this.components.set(config.key, {
      component: config.component as ComponentType<unknown>,
      category: config.category,
      description: config.description
    });

    this.log('info', `Registered component: ${config.key} (${config.category})`);
  }

  /**
   * Get a component by key.
   */
  public get<P = unknown>(key: string): ComponentType<P> | undefined {
    const reg = this.components.get(key);
    return reg?.component as ComponentType<P> | undefined;
  }

  /**
   * Get component registration with metadata.
   */
  public getRegistration(key: string): ComponentRegistration | undefined {
    return this.components.get(key);
  }

  /**
   * Get all components of a specific category.
   */
  public getByCategory(category: ComponentCategory): ReadonlyArray<{
    readonly key: string;
    readonly registration: ComponentRegistration;
  }> {
    const results: Array<{ key: string; registration: ComponentRegistration }> = [];
    this.components.forEach((reg, key) => {
      if (reg.category === category) {
        results.push({ key, registration: reg });
      }
    });
    return results;
  }

  /**
   * List all registered components with their metadata.
   */
  public listComponents(): ReadonlyArray<ComponentRegistration & { key: string }> {
    const result: Array<ComponentRegistration & { key: string }> = [];
    this.components.forEach((reg, key) => {
      result.push({ ...reg, key });
    });
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE TYPES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a new page type.
   * Backend config with matching pageType will use this component.
   */
  public registerPageType(config: PageTypeRegistrationConfig): void {
    this.validateKey(config.key, 'page type');
    this.warnIfInitialized('registerPageType', config.key);

    if (this.pageTypes.has(config.key)) {
      this.log('warn', `Overwriting page type: ${config.key}`);
    }

    this.pageTypes.set(config.key, {
      component: config.component,
      description: config.description
    });

    this.log('info', `Registered page type: ${config.key}`);
  }

  /**
   * Register entity page override.
   * Replaces standard page (list/details/form/create) for specific entity.
   */
  public registerEntityPage(config: EntityPageRegistrationConfig): void {
    this.validateKey(config.entity, 'entity name');
    this.warnIfInitialized('registerEntityPage', `${config.entity}:${config.pageType}`);

    const key: EntityPageKey = `${config.entity}:${config.pageType}`;

    if (this.entityPages.has(key)) {
      this.log('warn', `Overwriting entity page: ${key}`);
    }

    this.entityPages.set(key, config.component);
    this.log('info', `Registered entity page: ${key}`);
  }

  /**
   * Get entity page override.
   */
  public getEntityOverride(
    entityName: string,
    pageType: OverridablePageType
  ): ComponentType<PageComponentProps> | undefined {
    const key: EntityPageKey = `${entityName}:${pageType}`;
    return this.entityPages.get(key);
  }

  /**
   * Check if entity override exists.
   */
  public hasEntityOverride(entityName: string, pageType: OverridablePageType): boolean {
    const key: EntityPageKey = `${entityName}:${pageType}`;
    return this.entityPages.has(key);
  }

  /**
   * Get page component for rendering.
   * 
   * Resolution order:
   * 1. Conditional match
   * 2. Entity page override
   * 3. Custom page type
   * 4. null (use built-in)
   */
  public getPageComponent(
    pageType: string,
    context: Readonly<ResolverContext>
  ): ComponentType<PageComponentProps> | null {
    this.logResolution('page', pageType, context);

    // 1. Check conditional registrations
    const conditional = this.findMatchingConditional(`page:${pageType}`, context);
    if (conditional) {
      this.logMatch('conditional', `page:${pageType}`);
      return conditional as ComponentType<PageComponentProps>;
    }

    // 2. Check entity override
    if (context.entityName) {
      const entityKey: EntityPageKey = `${context.entityName}:${pageType as OverridablePageType}`;
      const entityOverride = this.entityPages.get(entityKey);
      if (entityOverride) {
        this.logMatch('entity override', entityKey);
        return entityOverride;
      }
    }

    // 3. Check custom page type
    const pageTypeReg = this.pageTypes.get(pageType);
    if (pageTypeReg) {
      this.logMatch('page type', pageType);
      return pageTypeReg.component;
    }

    this.logNoMatch('page', pageType);
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FIELD RENDERERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a custom field renderer.
   */
  public registerFieldRenderer(config: FieldRendererRegistrationConfig): void {
    this.validateKey(config.key, 'field renderer');
    this.warnIfInitialized('registerFieldRenderer', config.key);

    if (this.fieldRenderers.has(config.key)) {
      this.log('warn', `Overwriting field renderer: ${config.key}`);
    }

    this.fieldRenderers.set(config.key, {
      component: config.component,
      contexts: config.contexts,
      description: config.description
    });

    // this.log('info', `Registered field renderer: ${config.key}`);
  }

  /**
   * Override built-in field type globally.
   */
  public overrideFieldType(config: FieldTypeOverrideConfig): void {
    this.validateKey(config.fieldType, 'field type');
    this.warnIfInitialized('overrideFieldType', config.fieldType);

    const key: FieldTypeKey = `${config.fieldType}:${config.context}`;

    if (this.fieldTypeOverrides.has(key)) {
      this.log('warn', `Overwriting field type override: ${key}`);
    }

    this.fieldTypeOverrides.set(key, config.component);
    this.log('info', `Registered field type override: ${key}`);
  }

  /**
   * Override field for specific entity + field name.
   */
  public registerEntityField(config: EntityFieldRegistrationConfig): void {
    this.validateKey(config.entity, 'entity name');
    this.validateKey(config.field, 'field name');
    this.warnIfInitialized('registerEntityField', `${config.entity}:${config.field}`);

    const key: EntityFieldKey = `${config.entity}:${config.field}:${config.context}`;

    if (this.entityFields.has(key)) {
      this.log('warn', `Overwriting entity field: ${key}`);
    }

    this.entityFields.set(key, config.component);
    this.log('info', `Registered entity field: ${key}`);
  }

  /**
   * Get field renderer given context.
   * 
   * Resolution order:
   * 1. Explicit renderer key
   * 2. Conditional match
   * 3. Entity + field specific
   * 4. Field type override
   * 5. Custom renderer by field type name
   * 6. null (use built-in)
   */
  public getFieldRenderer(
    fieldType: string,
    fieldContext: FieldContext,
    context: Readonly<ResolverContext> & { readonly explicitRenderer?: string }
  ): ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps> | null {
    this.logResolution('field', `${fieldType}:${fieldContext}`, context);

    // 1. Check explicit renderer
    if (context.explicitRenderer) {
      const explicit = this.fieldRenderers.get(context.explicitRenderer);
      if (explicit && explicit.contexts.includes(fieldContext)) {
        this.logMatch('explicit', context.explicitRenderer);
        return explicit.component;
      }
    }

    // 2. Check conditional registrations
    const conditional = this.findMatchingConditional(`field:${fieldType}`, context);
    if (conditional) {
      this.logMatch('conditional', `field:${fieldType}`);
      return conditional as ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps>;
    }

    // 3. Check entity + field specific
    if (context.entityName && context.fieldName) {
      const entityFieldKey: EntityFieldKey = `${context.entityName}:${context.fieldName}:${fieldContext}`;
      const entityFieldAll: EntityFieldKey = `${context.entityName}:${context.fieldName}:all`;

      const entityField = this.entityFields.get(entityFieldKey) ?? this.entityFields.get(entityFieldAll);
      if (entityField) {
        this.logMatch('entity field', `${context.entityName}:${context.fieldName}`);
        return entityField;
      }
    }

    // 4. Check field type override
    const fieldTypeKey: FieldTypeKey = `${fieldType}:${fieldContext}`;
    const fieldTypeAll: FieldTypeKey = `${fieldType}:all`;

    const fieldTypeOverride = this.fieldTypeOverrides.get(fieldTypeKey) ?? this.fieldTypeOverrides.get(fieldTypeAll);
    if (fieldTypeOverride) {
      this.logMatch('field type override', fieldType);
      return fieldTypeOverride;
    }

    // 5. Check custom field renderer by field type name
    const customRenderer = this.fieldRenderers.get(fieldType);
    if (customRenderer && customRenderer.contexts.includes(fieldContext)) {
      this.logMatch('custom renderer', fieldType);
      return customRenderer.component;
    }

    this.logNoMatch('field', `${fieldType}:${fieldContext}`);
    return null;
  }

  /**
   * Get column renderer for table.
   */
  public getColumnRenderer(
    column: Readonly<ColumnConfig>,
    context: Readonly<ResolverContext>
  ): ComponentType<ColumnRendererProps> | null {
    const fieldType = column.fieldType ?? 'text';
    const fieldName = column.dataIndex;

    const enrichedContext: ResolverContext & { explicitRenderer?: string } = {
      ...context,
      fieldName,
      fieldType,
      explicitRenderer: column.renderer
    };

    return this.getFieldRenderer(fieldType, 'table', enrichedContext) as ComponentType<ColumnRendererProps> | null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WIDGETS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a custom widget type.
   */
  public registerWidget(config: WidgetRegistrationConfig): void {
    this.validateKey(config.key, 'widget');
    this.warnIfInitialized('registerWidget', config.key);

    if (this.widgets.has(config.key)) {
      this.log('warn', `Overwriting widget: ${config.key}`);
    }

    this.widgets.set(config.key, {
      component: config.component,
      description: config.description
    });

    this.log('info', `Registered widget: ${config.key}`);
  }

  /**
   * Override built-in widget type.
   */
  public overrideWidgetType(config: WidgetTypeOverrideConfig): void {
    this.validateKey(config.widgetType, 'widget type');
    this.warnIfInitialized('overrideWidgetType', config.widgetType);

    if (this.widgetTypeOverrides.has(config.widgetType)) {
      this.log('warn', `Overwriting widget type override: ${config.widgetType}`);
    }

    this.widgetTypeOverrides.set(config.widgetType, config.component);
    this.log('info', `Registered widget type override: ${config.widgetType}`);
  }

  /**
   * Get widget renderer.
   */
  public getWidgetRenderer(widgetType: string): ComponentType<WidgetRendererProps> | null {
    // 1. Check override
    const override = this.widgetTypeOverrides.get(widgetType);
    if (override) {
      this.logMatch('widget override', widgetType);
      return override;
    }

    // 2. Check custom widget
    const custom = this.widgets.get(widgetType);
    if (custom) {
      this.logMatch('widget', widgetType);
      return custom.component;
    }

    this.logNoMatch('widget', widgetType);
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONDITIONAL REGISTRATIONS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register conditional override.
   * Uses a function-based match for full programmatic control.
   * 
   * @example
   * ExtensionRegistry.when({
   *   key: 'page:list',
   *   match: (ctx) => ctx.actor?.groups.includes('admin'),
   *   component: AdminListPage,
   * });
   */
  public when<C extends ComponentType<unknown>>(config: ConditionalRegistrationConfig<C>): void {
    this.warnIfInitialized('when', config.key);

    this.conditionals.push({
      condition: config.match,
      key: config.key,
      component: config.component as ComponentType<unknown>,
      description: config.description
    });

    this.log('info', `Registered conditional: ${config.key}`);
  }

  /**
   * Find matching conditional registration.
   * Calls the registered match function against the current context.
   */
  private findMatchingConditional(
    key: string,
    context: Readonly<ResolverContext>
  ): ComponentType<unknown> | null {
    for (const reg of this.conditionals) {
      if (reg.key !== key) continue;

      if (reg.condition(context)) {
        return reg.component;
      }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Check if something is registered.
   */
  public has(key: string): boolean {
    return this.components.has(key) ||
      this.pageTypes.has(key) ||
      this.fieldRenderers.has(key) ||
      this.widgets.has(key);
  }

  /**
   * List all registrations.
   */
  public list(category?: RegistrationCategory): ReadonlyArray<RegistrationInfo> {
    const results: RegistrationInfo[] = [];

    if (!category || category === 'component') {
      this.components.forEach((reg, key) => {
        results.push({ key, type: 'component', description: reg.description, metadata: { category: reg.category } });
      });
    }

    if (!category || category === 'page') {
      this.pageTypes.forEach((reg, key) => {
        results.push({ key, type: 'page', description: reg.description });
      });
    }

    if (!category || category === 'entityOverride') {
      this.entityPages.forEach((_, key) => {
        results.push({ key, type: 'entityOverride' });
      });
    }

    if (!category || category === 'field') {
      this.fieldRenderers.forEach((reg, key) => {
        results.push({
          key,
          type: 'field',
          description: reg.description,
          metadata: { contexts: reg.contexts }
        });
      });
    }

    if (!category || category === 'widget') {
      this.widgets.forEach((reg, key) => {
        results.push({ key, type: 'widget', description: reg.description });
      });
    }

    if (!category || category === 'conditional') {
      this.conditionals.forEach(reg => {
        results.push({ key: reg.key, type: 'conditional', description: reg.description });
      });
    }

    return results;
  }

  /**
   * List all entity overrides.
   */
  public listEntityOverrides(): ReadonlyArray<{
    readonly entityName: string;
    readonly pageType: OverridablePageType;
  }> {
    const results: Array<{ entityName: string; pageType: OverridablePageType }> = [];
    this.entityPages.forEach((_, key) => {
      const [ entityName, pageType ] = key.split(':') as [ string, OverridablePageType ];
      results.push({ entityName, pageType });
    });
    return results;
  }

  /**
   * Enable debug logging.
   */
  public debug(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      console.info('[ExtensionRegistry] Debug mode enabled');
    }
  }

  /**
   * Mark registry as initialized.
   */
  public markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Check if initialized.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clear all registrations (for testing).
   */
  public clear(): void {
    this.components.clear();
    this.pageTypes.clear();
    this.entityPages.clear();
    this.fieldRenderers.clear();
    this.fieldTypeOverrides.clear();
    this.entityFields.clear();
    this.widgets.clear();
    this.widgetTypeOverrides.clear();
    this.conditionals.length = 0;
    this.initialized = false;
  }

  /**
   * Get diagnostics info.
   */
  public getDiagnostics(): Readonly<{
    componentCount: number;
    pageTypeCount: number;
    entityPageCount: number;
    fieldRendererCount: number;
    widgetCount: number;
    conditionalCount: number;
    initialized: boolean;
  }> {
    return {
      componentCount: this.components.size,
      pageTypeCount: this.pageTypes.size,
      entityPageCount: this.entityPages.size,
      fieldRendererCount: this.fieldRenderers.size,
      widgetCount: this.widgets.size,
      conditionalCount: this.conditionals.length,
      initialized: this.initialized
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private validateKey(key: string, type: string): void {
    if (!key || key.trim().length === 0) {
      throw new Error(`[ExtensionRegistry] ${type} key cannot be empty`);
    }
  }

  private warnIfInitialized(method: string, key: string): void {
    if (this.initialized && process.env.NODE_ENV === 'development') {
      console.warn(
        `[ExtensionRegistry] Late ${method} call for "${key}". ` +
        'Extensions should be registered before app initialization.'
      );
    }
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (process.env.NODE_ENV === 'development' || this.debugMode) {
      console[ level ](`[ExtensionRegistry] ${message}`);
    }
  }

  private logResolution(type: string, key: string, context: Readonly<ResolverContext>): void {
    if (this.debugMode) {
      console.log(`[ExtensionRegistry] Resolving ${type}: ${key}`, {
        entity: context.entityName,
        field: context.fieldName,
        fieldType: context.fieldType,
        roles: context.actor?.groups
      });
    }
  }

  private logMatch(type: string, key: string): void {
    if (this.debugMode) {
      console.log(`[ExtensionRegistry] ✓ Matched ${type}: ${key}`);
    }
  }

  private logNoMatch(type: string, key: string): void {
    if (this.debugMode) {
      console.log(`[ExtensionRegistry] ✗ No match for ${type}: ${key}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMMAND PALETTE COMMANDS (#63)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a command for the Command Palette.
   * Commands appear in the Cmd+K search and can be triggered by the user.
   * 
   * @example
   * ExtensionRegistry.registerCommand({
   *   id: 'export-csv',
   *   label: 'Export to CSV',
   *   group: 'Actions',
   *   icon: 'download',
   *   handler: () => downloadCSV(),
   * });
   */
  public registerCommand(config: CommandRegistration): void {
    const existing = this.commands.findIndex(c => c.id === config.id);
    if (existing >= 0) {
      this.log('warn', `Overwriting command: ${config.id}`);
      this.commands[existing] = config;
    } else {
      this.commands.push(config);
    }
    this.log('info', `Registered command: ${config.id}`);
  }

  /**
   * Get all registered commands.
   * Used by the CommandPalette to populate custom command items.
   */
  public getCommands(): ReadonlyArray<CommandRegistration> {
    return this.commands;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of the Extension Registry.
 * 
 * @example
 * import { ExtensionRegistry } from '@ten24group/ui24';
 * 
 * // Register custom page type
 * ExtensionRegistry.registerPageType({
 *   key: 'kanban',
 *   component: KanbanBoard
 * });
 * 
 * // Register custom component by key
 * ExtensionRegistry.register({
 *   key: 'MyCustomWidget',
 *   component: MyCustomWidget,
 *   category: 'widget'
 * });
 * 
 * // Override entity page
 * ExtensionRegistry.registerEntityPage({
 *   entity: 'game',
 *   pageType: 'list',
 *   component: GameCalendar
 * });
 */
export const ExtensionRegistry = new ExtensionRegistryImpl();

// Re-export types
export type { ResolverContext } from './types';
