/**
 * Tests for core/utils/template.ts
 * 
 * The template system is used throughout UI24 for:
 * - Dynamic page titles ({entityName} Details)
 * - Action button labels (Delete {name})
 * - Success/error messages (Created {teamName} successfully)
 * - Breadcrumb labels
 * - Widget titles
 * 
 * It supports both simple {field.path} dot notation and JSONPath expressions.
 */

// Mock ESM-only dependencies to avoid parsing issues in Jest
jest.mock('@blocknote/core', () => ({
  BlockNoteEditor: { create: jest.fn() },
}));
jest.mock('jsonpath-plus', () => ({
  JSONPath: jest.fn(({ path, json }) => {
    // Simple mock: just return undefined for JSONPath queries
    return undefined;
  }),
}));

import {
  parseSimpleTemplate,
  interpolateTemplate,
  evaluateTemplate,
  evaluateTemplateValue,
} from '../template';

// ============================================================================
// parseSimpleTemplate
// ============================================================================

describe('parseSimpleTemplate', () => {
  it('extracts simple field names', () => {
    const result = parseSimpleTemplate('{firstName} {lastName}');
    expect(result.composite).toEqual(['firstName', 'lastName']);
    expect(result.template).toBe('{firstName} {lastName}');
  });

  it('extracts nested field paths', () => {
    const result = parseSimpleTemplate('{team.name} ({team.city})');
    expect(result.composite).toEqual(['team.name', 'team.city']);
  });

  it('returns empty composite for templates with no placeholders', () => {
    const result = parseSimpleTemplate('static text');
    expect(result.composite).toEqual([]);
    expect(result.template).toBe('static text');
  });

  it('handles single placeholder', () => {
    const result = parseSimpleTemplate('{name}');
    expect(result.composite).toEqual(['name']);
  });

  it('extracts JSONPath expressions', () => {
    const result = parseSimpleTemplate('{$.lineItems.length()} items');
    expect(result.composite).toEqual(['$.lineItems.length()']);
  });

  it('handles template with mixed content', () => {
    const result = parseSimpleTemplate('Hello {firstName}, you have {count} items');
    expect(result.composite).toEqual(['firstName', 'count']);
  });
});

// ============================================================================
// interpolateTemplate
// ============================================================================

describe('interpolateTemplate', () => {
  it('interpolates simple values', () => {
    const config = { composite: ['name', 'city'], template: '{name} ({city})' };
    const context = { name: 'Lakers', city: 'Los Angeles' };
    expect(interpolateTemplate(config, context)).toBe('Lakers (Los Angeles)');
  });

  it('interpolates nested values', () => {
    const config = { composite: ['team.name'], template: 'Team: {team.name}' };
    const context = { team: { name: 'Lakers' } };
    expect(interpolateTemplate(config, context)).toBe('Team: Lakers');
  });

  it('replaces missing values with empty string', () => {
    const config = { composite: ['missing'], template: 'Hello {missing}' };
    const context = {};
    expect(interpolateTemplate(config, context)).toBe('Hello ');
  });

  it('handles multiple occurrences of same placeholder', () => {
    const config = { composite: ['name'], template: '{name} is {name}' };
    const context = { name: 'test' };
    expect(interpolateTemplate(config, context)).toBe('test is test');
  });

  it('handles numeric values', () => {
    const config = { composite: ['count'], template: '{count} items' };
    const context = { count: 42 };
    expect(interpolateTemplate(config, context)).toBe('42 items');
  });

  it('handles boolean values', () => {
    const config = { composite: ['active'], template: 'Active: {active}' };
    const context = { active: true };
    expect(interpolateTemplate(config, context)).toBe('Active: true');
  });

  it('handles zero value correctly', () => {
    const config = { composite: ['count'], template: '{count} remaining' };
    const context = { count: 0 };
    expect(interpolateTemplate(config, context)).toBe('0 remaining');
  });
});

// ============================================================================
// evaluateTemplate
// ============================================================================

describe('evaluateTemplate', () => {
  it('evaluates string template', () => {
    expect(evaluateTemplate('{name}', { name: 'Test' })).toBe('Test');
  });

  it('evaluates config object template', () => {
    const config = { composite: ['name', 'city'], template: '{name} ({city})' };
    expect(evaluateTemplate(config, { name: 'Lakers', city: 'LA' })).toBe('Lakers (LA)');
  });

  it('returns empty string on error', () => {
    // Force an error by passing a bad template object
    expect(evaluateTemplate(null as any, {})).toBe('');
  });

  it('handles template with no placeholders', () => {
    expect(evaluateTemplate('static text', {})).toBe('static text');
  });
});

// ============================================================================
// evaluateTemplateValue
// ============================================================================

describe('evaluateTemplateValue', () => {
  it('returns fallback for undefined value', () => {
    expect(evaluateTemplateValue(undefined, {}, 'Default')).toBe('Default');
  });

  it('returns fallback for null/empty value', () => {
    expect(evaluateTemplateValue(null as any, {}, 'Default')).toBe('Default');
    expect(evaluateTemplateValue('' as any, {}, 'Default')).toBe('Default');
  });

  it('returns static string as-is (no template placeholders)', () => {
    expect(evaluateTemplateValue('Edit Team', {}, 'Default')).toBe('Edit Team');
  });

  it('evaluates simple template string', () => {
    expect(evaluateTemplateValue('Edit {teamName}', { teamName: 'Lakers' }, 'Default'))
      .toBe('Edit Lakers');
  });

  it('evaluates complex template with nested paths', () => {
    expect(evaluateTemplateValue(
      '{team.name} - {team.city}',
      { team: { name: 'Lakers', city: 'LA' } },
      'Default'
    )).toBe('Lakers - LA');
  });

  it('evaluates ITemplateConfig object', () => {
    const config = { composite: ['name'], template: 'Delete {name}?' };
    expect(evaluateTemplateValue(config, { name: 'Item' }, 'Default')).toBe('Delete Item?');
  });

  it('returns empty string as default fallback', () => {
    expect(evaluateTemplateValue(undefined, {})).toBe('');
  });
});
