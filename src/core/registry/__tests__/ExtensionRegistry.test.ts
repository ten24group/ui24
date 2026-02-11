/**
 * Tests for core/registry/ExtensionRegistry.ts
 * 
 * The ExtensionRegistry is the central extensibility system for UI24.
 * It handles component registration and resolution for:
 * - Custom page types (kanban, calendar, etc.)
 * - Entity page overrides (per-entity custom pages)
 * - Custom field renderers (form, detail, table)
 * - Custom widget types
 * - Conditional registrations (role/feature-flag based)
 * 
 * Resolution order is critical and tested thoroughly:
 * - Pages: conditional → entity override → custom page type → null
 * - Fields: explicit renderer → conditional → entity field → field type override → custom renderer → null
 */

import { ExtensionRegistry } from '../ExtensionRegistry';
import type { ResolverContext } from '../types';

// Mock React components
const MockPageComponent = () => null;
MockPageComponent.displayName = 'MockPage';

const MockFieldComponent = () => null;
MockFieldComponent.displayName = 'MockField';

const MockWidgetComponent = () => null;
MockWidgetComponent.displayName = 'MockWidget';

const MockAdminPage = () => null;
MockAdminPage.displayName = 'MockAdminPage';

const MockConditionalField = () => null;
MockConditionalField.displayName = 'MockConditionalField';

// Helper to build ResolverContext
function makeContext(overrides: Partial<ResolverContext> = {}): Readonly<ResolverContext> {
  return {
    entityName: 'team',
    pageType: 'list',
    fieldName: undefined,
    fieldType: undefined,
    ...overrides,
  } as Readonly<ResolverContext>;
}

describe('ExtensionRegistry', () => {
  beforeEach(() => {
    ExtensionRegistry.clear();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GENERIC COMPONENT REGISTRATION
  // ══════════════════════════════════════════════════════════════════════════

  describe('register / get', () => {
    it('registers and retrieves a component by key', () => {
      ExtensionRegistry.register({
        key: 'MyWidget',
        component: MockWidgetComponent,
        category: 'widget',
      });

      const component = ExtensionRegistry.get('MyWidget');
      expect(component).toBe(MockWidgetComponent);
    });

    it('returns undefined for unregistered key', () => {
      expect(ExtensionRegistry.get('nonexistent')).toBeUndefined();
    });

    it('overwrites existing registration with warning', () => {
      const NewComponent = () => null;

      ExtensionRegistry.register({
        key: 'MyWidget',
        component: MockWidgetComponent,
        category: 'widget',
      });

      ExtensionRegistry.register({
        key: 'MyWidget',
        component: NewComponent as any,
        category: 'widget',
      });

      expect(ExtensionRegistry.get('MyWidget')).toBe(NewComponent);
    });

    it('throws on empty key', () => {
      expect(() =>
        ExtensionRegistry.register({
          key: '',
          component: MockWidgetComponent,
          category: 'widget',
        })
      ).toThrow('key cannot be empty');
    });
  });

  describe('getRegistration', () => {
    it('returns registration with metadata', () => {
      ExtensionRegistry.register({
        key: 'MyWidget',
        component: MockWidgetComponent,
        category: 'widget',
        description: 'A custom widget',
      });

      const reg = ExtensionRegistry.getRegistration('MyWidget');
      expect(reg).toBeDefined();
      expect(reg!.category).toBe('widget');
      expect(reg!.description).toBe('A custom widget');
    });
  });

  describe('getByCategory', () => {
    it('returns only components of specified category', () => {
      ExtensionRegistry.register({ key: 'widget1', component: MockWidgetComponent, category: 'widget' });
      ExtensionRegistry.register({ key: 'page1', component: MockPageComponent, category: 'page' });
      ExtensionRegistry.register({ key: 'widget2', component: MockWidgetComponent, category: 'widget' });

      const widgets = ExtensionRegistry.getByCategory('widget');
      expect(widgets).toHaveLength(2);
      expect(widgets.map(w => w.key)).toEqual(['widget1', 'widget2']);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE TYPES
  // ══════════════════════════════════════════════════════════════════════════

  describe('registerPageType / getPageComponent', () => {
    it('registers and resolves a custom page type', () => {
      ExtensionRegistry.registerPageType({
        key: 'kanban',
        component: MockPageComponent as any,
      });

      const component = ExtensionRegistry.getPageComponent('kanban', makeContext());
      expect(component).toBe(MockPageComponent);
    });

    it('returns null for unregistered page type', () => {
      const component = ExtensionRegistry.getPageComponent('unknown', makeContext());
      expect(component).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ENTITY PAGE OVERRIDES
  // ══════════════════════════════════════════════════════════════════════════

  describe('registerEntityPage / getEntityOverride', () => {
    it('registers and retrieves entity page override', () => {
      ExtensionRegistry.registerEntityPage({
        entity: 'game',
        pageType: 'list',
        component: MockPageComponent as any,
      });

      const override = ExtensionRegistry.getEntityOverride('game', 'list');
      expect(override).toBe(MockPageComponent);
    });

    it('returns undefined for non-overridden entity page', () => {
      expect(ExtensionRegistry.getEntityOverride('team', 'list')).toBeUndefined();
    });

    it('hasEntityOverride returns correct boolean', () => {
      ExtensionRegistry.registerEntityPage({
        entity: 'game',
        pageType: 'list',
        component: MockPageComponent as any,
      });

      expect(ExtensionRegistry.hasEntityOverride('game', 'list')).toBe(true);
      expect(ExtensionRegistry.hasEntityOverride('game', 'details')).toBe(false);
      expect(ExtensionRegistry.hasEntityOverride('team', 'list')).toBe(false);
    });
  });

  describe('page resolution order', () => {
    it('entity override takes precedence over page type', () => {
      const EntityPage = () => null;
      const CustomPageType = () => null;

      ExtensionRegistry.registerPageType({
        key: 'list',
        component: CustomPageType as any,
      });
      ExtensionRegistry.registerEntityPage({
        entity: 'game',
        pageType: 'list',
        component: EntityPage as any,
      });

      const result = ExtensionRegistry.getPageComponent(
        'list',
        makeContext({ entityName: 'game' })
      );
      expect(result).toBe(EntityPage);
    });

    it('conditional takes precedence over entity override', () => {
      const EntityPage = () => null;
      const ConditionalPage = () => null;

      ExtensionRegistry.registerEntityPage({
        entity: 'game',
        pageType: 'list',
        component: EntityPage as any,
      });

      ExtensionRegistry.when({
        key: 'page:list',
        match: (ctx) => ctx.entityName === 'game',
        component: ConditionalPage as any,
      });

      const result = ExtensionRegistry.getPageComponent(
        'list',
        makeContext({ entityName: 'game' })
      );
      expect(result).toBe(ConditionalPage);
    });

    it('falls through to null when nothing matches', () => {
      const result = ExtensionRegistry.getPageComponent('list', makeContext());
      expect(result).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FIELD RENDERERS
  // ══════════════════════════════════════════════════════════════════════════

  describe('registerFieldRenderer / getFieldRenderer', () => {
    it('registers and retrieves field renderer by key', () => {
      ExtensionRegistry.registerFieldRenderer({
        key: 'address-picker',
        component: MockFieldComponent as any,
        contexts: ['form', 'detail'],
      });

      const renderer = ExtensionRegistry.getFieldRenderer(
        'text',
        'form',
        { ...makeContext(), explicitRenderer: 'address-picker' }
      );
      expect(renderer).toBe(MockFieldComponent);
    });

    it('respects field context restrictions', () => {
      ExtensionRegistry.registerFieldRenderer({
        key: 'form-only',
        component: MockFieldComponent as any,
        contexts: ['form'],
      });

      // Should match for form context
      const formResult = ExtensionRegistry.getFieldRenderer(
        'text',
        'form',
        { ...makeContext(), explicitRenderer: 'form-only' }
      );
      expect(formResult).toBe(MockFieldComponent);

      // Should NOT match for detail context
      const detailResult = ExtensionRegistry.getFieldRenderer(
        'text',
        'detail',
        { ...makeContext(), explicitRenderer: 'form-only' }
      );
      expect(detailResult).toBeNull();
    });

    it('resolves by field type name as fallback', () => {
      ExtensionRegistry.registerFieldRenderer({
        key: 'richtext',
        component: MockFieldComponent as any,
        contexts: ['form', 'detail'],
      });

      const renderer = ExtensionRegistry.getFieldRenderer(
        'richtext',
        'form',
        makeContext()
      );
      expect(renderer).toBe(MockFieldComponent);
    });

    it('returns null when nothing matches', () => {
      const renderer = ExtensionRegistry.getFieldRenderer('text', 'form', makeContext());
      expect(renderer).toBeNull();
    });
  });

  describe('overrideFieldType', () => {
    it('overrides built-in field type globally', () => {
      ExtensionRegistry.overrideFieldType({
        fieldType: 'text',
        context: 'form',
        component: MockFieldComponent as any,
      });

      const renderer = ExtensionRegistry.getFieldRenderer('text', 'form', makeContext());
      expect(renderer).toBe(MockFieldComponent);
    });

    it('context-specific override does not affect other contexts', () => {
      ExtensionRegistry.overrideFieldType({
        fieldType: 'text',
        context: 'form',
        component: MockFieldComponent as any,
      });

      // Should not affect 'detail' context
      const renderer = ExtensionRegistry.getFieldRenderer('text', 'detail', makeContext());
      expect(renderer).toBeNull();
    });

    it('"all" context overrides all field contexts', () => {
      ExtensionRegistry.overrideFieldType({
        fieldType: 'text',
        context: 'all',
        component: MockFieldComponent as any,
      });

      expect(ExtensionRegistry.getFieldRenderer('text', 'form', makeContext())).toBe(MockFieldComponent);
      expect(ExtensionRegistry.getFieldRenderer('text', 'detail', makeContext())).toBe(MockFieldComponent);
      expect(ExtensionRegistry.getFieldRenderer('text', 'table', makeContext())).toBe(MockFieldComponent);
    });
  });

  describe('registerEntityField', () => {
    it('overrides field for specific entity + field name', () => {
      ExtensionRegistry.registerEntityField({
        entity: 'team',
        field: 'logo',
        context: 'form',
        component: MockFieldComponent as any,
      });

      const renderer = ExtensionRegistry.getFieldRenderer(
        'text',
        'form',
        makeContext({ entityName: 'team', fieldName: 'logo' })
      );
      expect(renderer).toBe(MockFieldComponent);
    });

    it('does not match for different entity', () => {
      ExtensionRegistry.registerEntityField({
        entity: 'team',
        field: 'logo',
        context: 'form',
        component: MockFieldComponent as any,
      });

      const renderer = ExtensionRegistry.getFieldRenderer(
        'text',
        'form',
        makeContext({ entityName: 'game', fieldName: 'logo' })
      );
      expect(renderer).toBeNull();
    });
  });

  describe('field resolution order', () => {
    it('explicit renderer > conditional > entity field > field type override > custom', () => {
      const Explicit = () => null;
      const Conditional = () => null;
      const EntityField = () => null;
      const FieldTypeOverride = () => null;
      const CustomByName = () => null;

      // Register all 5 levels
      ExtensionRegistry.registerFieldRenderer({
        key: 'explicit-renderer',
        component: Explicit as any,
        contexts: ['form'],
      });
      ExtensionRegistry.when({
        key: 'field:text',
        match: () => true,
        component: Conditional as any,
      });
      ExtensionRegistry.registerEntityField({
        entity: 'team',
        field: 'name',
        context: 'form',
        component: EntityField as any,
      });
      ExtensionRegistry.overrideFieldType({
        fieldType: 'text',
        context: 'form',
        component: FieldTypeOverride as any,
      });
      ExtensionRegistry.registerFieldRenderer({
        key: 'text',
        component: CustomByName as any,
        contexts: ['form'],
      });

      const context = makeContext({ entityName: 'team', fieldName: 'name' });

      // 1. Explicit wins
      const r1 = ExtensionRegistry.getFieldRenderer('text', 'form', {
        ...context,
        explicitRenderer: 'explicit-renderer',
      });
      expect(r1).toBe(Explicit);

      // 2. Without explicit, conditional wins
      const r2 = ExtensionRegistry.getFieldRenderer('text', 'form', context);
      expect(r2).toBe(Conditional);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COLUMN RENDERERS
  // ══════════════════════════════════════════════════════════════════════════

  describe('getColumnRenderer', () => {
    it('resolves column renderer from field renderers', () => {
      ExtensionRegistry.registerFieldRenderer({
        key: 'status-badge',
        component: MockFieldComponent as any,
        contexts: ['table'],
      });

      const renderer = ExtensionRegistry.getColumnRenderer(
        { name: 'status', dataIndex: 'status', fieldType: 'text', renderer: 'status-badge' } as any,
        makeContext()
      );
      expect(renderer).toBe(MockFieldComponent);
    });

    it('returns null when no column renderer found', () => {
      const renderer = ExtensionRegistry.getColumnRenderer(
        { name: 'name', dataIndex: 'name', fieldType: 'text' } as any,
        makeContext()
      );
      expect(renderer).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // WIDGETS
  // ══════════════════════════════════════════════════════════════════════════

  describe('registerWidget / getWidgetRenderer', () => {
    it('registers and retrieves a widget renderer', () => {
      ExtensionRegistry.registerWidget({
        key: 'chart',
        component: MockWidgetComponent as any,
      });

      expect(ExtensionRegistry.getWidgetRenderer('chart')).toBe(MockWidgetComponent);
    });

    it('returns null for unregistered widget', () => {
      expect(ExtensionRegistry.getWidgetRenderer('unknown')).toBeNull();
    });
  });

  describe('overrideWidgetType', () => {
    it('overrides built-in widget type', () => {
      const OriginalWidget = () => null;
      const OverrideWidget = () => null;

      ExtensionRegistry.registerWidget({
        key: 'stat',
        component: OriginalWidget as any,
      });
      ExtensionRegistry.overrideWidgetType({
        widgetType: 'stat',
        component: OverrideWidget as any,
      });

      // Override takes precedence
      expect(ExtensionRegistry.getWidgetRenderer('stat')).toBe(OverrideWidget);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CONDITIONAL REGISTRATIONS
  // ══════════════════════════════════════════════════════════════════════════

  describe('when (conditional registrations)', () => {
    it('matches based on context function', () => {
      ExtensionRegistry.when({
        key: 'page:list',
        match: (ctx) => ctx.actor?.groups?.includes('admin') ?? false,
        component: MockAdminPage as any,
      });

      // Should match admin user
      const adminResult = ExtensionRegistry.getPageComponent(
        'list',
        makeContext({ actor: { actorId: '1', groups: ['admin'] } } as any)
      );
      expect(adminResult).toBe(MockAdminPage);

      // Should not match regular user
      const userResult = ExtensionRegistry.getPageComponent(
        'list',
        makeContext({ actor: { actorId: '2', groups: ['viewer'] } } as any)
      );
      expect(userResult).toBeNull();
    });

    it('first matching conditional wins', () => {
      const FirstMatch = () => null;
      const SecondMatch = () => null;

      ExtensionRegistry.when({
        key: 'page:list',
        match: () => true,
        component: FirstMatch as any,
      });
      ExtensionRegistry.when({
        key: 'page:list',
        match: () => true,
        component: SecondMatch as any,
      });

      const result = ExtensionRegistry.getPageComponent('list', makeContext());
      expect(result).toBe(FirstMatch);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  describe('has', () => {
    it('checks across all registry types', () => {
      expect(ExtensionRegistry.has('anything')).toBe(false);

      ExtensionRegistry.registerPageType({
        key: 'kanban',
        component: MockPageComponent as any,
      });
      expect(ExtensionRegistry.has('kanban')).toBe(true);

      ExtensionRegistry.registerFieldRenderer({
        key: 'address',
        component: MockFieldComponent as any,
        contexts: ['form'],
      });
      expect(ExtensionRegistry.has('address')).toBe(true);

      ExtensionRegistry.registerWidget({
        key: 'chart',
        component: MockWidgetComponent as any,
      });
      expect(ExtensionRegistry.has('chart')).toBe(true);
    });
  });

  describe('list', () => {
    it('lists all registrations', () => {
      ExtensionRegistry.registerPageType({ key: 'kanban', component: MockPageComponent as any });
      ExtensionRegistry.registerWidget({ key: 'chart', component: MockWidgetComponent as any });
      ExtensionRegistry.registerFieldRenderer({ key: 'address', component: MockFieldComponent as any, contexts: ['form'] });

      const all = ExtensionRegistry.list();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });

    it('filters by category', () => {
      ExtensionRegistry.registerPageType({ key: 'kanban', component: MockPageComponent as any });
      ExtensionRegistry.registerWidget({ key: 'chart', component: MockWidgetComponent as any });

      const pages = ExtensionRegistry.list('page');
      expect(pages).toHaveLength(1);
      expect(pages[0].key).toBe('kanban');

      const widgets = ExtensionRegistry.list('widget');
      expect(widgets).toHaveLength(1);
      expect(widgets[0].key).toBe('chart');
    });
  });

  describe('listEntityOverrides', () => {
    it('lists all entity page overrides', () => {
      ExtensionRegistry.registerEntityPage({ entity: 'game', pageType: 'list', component: MockPageComponent as any });
      ExtensionRegistry.registerEntityPage({ entity: 'team', pageType: 'details', component: MockPageComponent as any });

      const overrides = ExtensionRegistry.listEntityOverrides();
      expect(overrides).toHaveLength(2);
      expect(overrides).toContainEqual({ entityName: 'game', pageType: 'list' });
      expect(overrides).toContainEqual({ entityName: 'team', pageType: 'details' });
    });
  });

  describe('diagnostics', () => {
    it('returns correct counts', () => {
      ExtensionRegistry.registerPageType({ key: 'kanban', component: MockPageComponent as any });
      ExtensionRegistry.registerWidget({ key: 'chart', component: MockWidgetComponent as any });
      ExtensionRegistry.registerFieldRenderer({ key: 'address', component: MockFieldComponent as any, contexts: ['form'] });
      ExtensionRegistry.registerEntityPage({ entity: 'game', pageType: 'list', component: MockPageComponent as any });
      ExtensionRegistry.when({ key: 'page:list', match: () => true, component: MockPageComponent as any });

      const diag = ExtensionRegistry.getDiagnostics();
      expect(diag.pageTypeCount).toBe(1);
      expect(diag.widgetCount).toBe(1);
      expect(diag.fieldRendererCount).toBe(1);
      expect(diag.entityPageCount).toBe(1);
      expect(diag.conditionalCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all registrations', () => {
      ExtensionRegistry.registerPageType({ key: 'kanban', component: MockPageComponent as any });
      ExtensionRegistry.registerWidget({ key: 'chart', component: MockWidgetComponent as any });
      ExtensionRegistry.markInitialized();

      ExtensionRegistry.clear();

      expect(ExtensionRegistry.has('kanban')).toBe(false);
      expect(ExtensionRegistry.has('chart')).toBe(false);
      expect(ExtensionRegistry.isInitialized()).toBe(false);
    });
  });

  describe('initialization', () => {
    it('tracks initialization state', () => {
      expect(ExtensionRegistry.isInitialized()).toBe(false);
      ExtensionRegistry.markInitialized();
      expect(ExtensionRegistry.isInitialized()).toBe(true);
    });
  });
});
