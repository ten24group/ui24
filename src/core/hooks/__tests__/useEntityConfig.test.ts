/**
 * Tests for core/hooks/useEntityConfig.ts
 * 
 * The useEntityConfig hook and its resolveConfigRef function are critical
 * for the entity configuration system. They:
 * - Look up entity page configs by key (e.g., "list-team", "view-team")
 * - Apply overrides (pageTitle, columnsConfig, filters, segments, etc.)
 * - Handle view, create, and list page type specific merging
 * - Support segment management (replace, hide, show, merge)
 * - Support field visibility (hideFields, showOnlyFields)
 * - Support API config overrides (single and dual modes)
 */

// We test mergeConfigOverrides logic indirectly through resolveConfigRef.
// Since useEntityConfig is a hook that uses useUi24Config internally,
// we test the pure logic by mocking the context.

import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock the context
const mockGetPageConfig = jest.fn();

jest.mock('../../context/UI24Context', () => ({
  useUi24Config: () => ({
    getPageConfig: mockGetPageConfig,
  }),
}));

import { useEntityConfig } from '../useEntityConfig';

// ============================================================================
// HELPERS
// ============================================================================

beforeEach(() => {
  mockGetPageConfig.mockReset();
});

function getResolveConfigRef() {
  const { result } = renderHook(() => useEntityConfig());
  return result.current.resolveConfigRef;
}

// ============================================================================
// BASIC RESOLUTION
// ============================================================================

describe('useEntityConfig - resolveConfigRef', () => {
  describe('basic resolution', () => {
    it('generates correct config key from entityName and pageType', () => {
      mockGetPageConfig.mockReturnValue({ pageTitle: 'Teams' });
      const resolveConfigRef = getResolveConfigRef();

      resolveConfigRef({ entityName: 'Team', pageType: 'list' });

      expect(mockGetPageConfig).toHaveBeenCalledWith('list-team');
    });

    it('returns base config when no overrides', () => {
      const baseConfig = { pageTitle: 'Teams', listPageConfig: { columns: [] } };
      mockGetPageConfig.mockReturnValue(baseConfig);
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({ entityName: 'team', pageType: 'list' });
      expect(result).toBe(baseConfig);
    });

    it('returns null when config not found', () => {
      mockGetPageConfig.mockReturnValue(undefined);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({ entityName: 'unknown', pageType: 'list' });

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('returns base config when overrideConfig is empty object', () => {
      const baseConfig = { pageTitle: 'Teams' };
      mockGetPageConfig.mockReturnValue(baseConfig);
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: {},
      });

      expect(result).toBe(baseConfig);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COMMON OVERRIDES
  // ══════════════════════════════════════════════════════════════════════════

  describe('common overrides', () => {
    it('overrides pageTitle', () => {
      mockGetPageConfig.mockReturnValue({
        pageTitle: 'Teams',
        listPageConfig: {},
      });
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { pageTitle: 'My Teams' },
      });

      expect(result.pageTitle).toBe('My Teams');
    });

    it('overrides breadcrumbs', () => {
      mockGetPageConfig.mockReturnValue({
        pageTitle: 'Teams',
        breadcrumbs: [{ label: 'Home', url: '/' }],
        listPageConfig: {},
      });
      const resolveConfigRef = getResolveConfigRef();

      const newBreadcrumbs = [{ label: 'Dashboard', url: '/dashboard' }];
      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { breadcrumbs: newBreadcrumbs },
      });

      expect(result.breadcrumbs).toEqual(newBreadcrumbs);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW PAGE OVERRIDES
  // ══════════════════════════════════════════════════════════════════════════

  describe('view page overrides', () => {
    const viewBaseConfig = {
      pageTitle: 'Team Details',
      detailsPageConfig: {
        columnsConfig: { numColumns: 2 },
        detailApiConfig: { apiMethod: 'GET', apiUrl: '/api/teams/:id' },
        propertiesConfig: [
          { name: 'name', label: 'Name' },
          { name: 'status', label: 'Status' },
          { name: 'internalNotes', label: 'Notes' },
        ],
      },
    };

    it('overrides columnsConfig', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(viewBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'view',
        overrideConfig: { columnsConfig: { numColumns: 3, columns: [] } },
      });

      expect(result.detailsPageConfig.columnsConfig.numColumns).toBe(3);
    });

    it('hides fields via hideFields', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(viewBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'view',
        overrideConfig: { hideFields: ['internalNotes'] },
      });

      const fieldNames = result.detailsPageConfig.propertiesConfig.map((p: any) => p.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('status');
      expect(fieldNames).not.toContain('internalNotes');
    });

    it('shows only specific fields via showOnlyFields', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(viewBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'view',
        overrideConfig: { showOnlyFields: ['name'] },
      });

      expect(result.detailsPageConfig.propertiesConfig).toHaveLength(1);
      expect(result.detailsPageConfig.propertiesConfig[0].name).toBe('name');
    });

    it('overrides API config for view', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(viewBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'view',
        overrideConfig: { apiConfig: { apiMethod: 'GET', apiUrl: '/api/teams/:id/full' } },
      });

      expect(result.detailsPageConfig.detailApiConfig.apiUrl).toBe('/api/teams/:id/full');
      // Original fields preserved
      expect(result.detailsPageConfig.detailApiConfig.apiMethod).toBe('GET');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE PAGE OVERRIDES
  // ══════════════════════════════════════════════════════════════════════════

  describe('create page overrides', () => {
    const createBaseConfig = {
      pageTitle: 'Create Team',
      formPageConfig: {
        submitSuccessRedirect: '/teams',
        formButtons: [{ text: 'Save', action: 'submit' }],
        propertiesConfig: [
          { name: 'name', label: 'Name' },
          { name: 'status', label: 'Status' },
        ],
      },
    };

    it('overrides submitSuccessRedirect', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(createBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'create',
        overrideConfig: { submitSuccessRedirect: '/teams/:id' },
      });

      expect(result.formPageConfig.submitSuccessRedirect).toBe('/teams/:id');
    });

    it('overrides formButtons', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(createBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const newButtons = [{ text: 'Create', action: 'submit' }, { text: 'Cancel', action: 'cancel' }];
      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'create',
        overrideConfig: { formButtons: newButtons },
      });

      expect(result.formPageConfig.formButtons).toEqual(newButtons);
    });

    it('hides fields via hideFields', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(createBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'create',
        overrideConfig: { hideFields: ['status'] },
      });

      expect(result.formPageConfig.propertiesConfig).toHaveLength(1);
      expect(result.formPageConfig.propertiesConfig[0].name).toBe('name');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LIST PAGE OVERRIDES
  // ══════════════════════════════════════════════════════════════════════════

  describe('list page overrides', () => {
    const listBaseConfig = {
      pageTitle: 'Teams',
      listPageConfig: {
        defaultFilters: { active: true },
        segments: [
          { id: 'all', label: 'All', filters: {} },
          { id: 'active', label: 'Active', filters: { status: { eq: 'active' } } },
          { id: 'archived', label: 'Archived', filters: { status: { eq: 'archived' } } },
        ],
        apiConfig: { apiMethod: 'GET', apiUrl: '/api/teams' },
        columnsConfig: [
          { name: 'name', dataIndex: 'name' },
          { name: 'status', dataIndex: 'status' },
          { name: 'secret', dataIndex: 'secret' },
        ],
      },
    };

    it('merges defaultFilters', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { defaultFilters: { teamType: 'professional' } },
      });

      expect(result.listPageConfig.defaultFilters).toEqual({
        active: true,
        teamType: 'professional',
      });
    });

    it('replaces segments completely', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const newSegments = [{ id: 'custom', label: 'Custom', filters: {} }];
      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { segments: newSegments },
      });

      expect(result.listPageConfig.segments).toEqual(newSegments);
    });

    it('disables segments with empty array', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { segments: [] },
      });

      expect(result.listPageConfig.segments).toEqual([]);
    });

    it('hides specific segments by ID', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { hideSegments: ['archived'] },
      });

      const segmentIds = result.listPageConfig.segments.map((s: any) => s.id);
      expect(segmentIds).toContain('all');
      expect(segmentIds).toContain('active');
      expect(segmentIds).not.toContain('archived');
    });

    it('shows only specific segments by ID', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { showOnlySegments: ['all', 'active'] },
      });

      expect(result.listPageConfig.segments).toHaveLength(2);
      const segmentIds = result.listPageConfig.segments.map((s: any) => s.id);
      expect(segmentIds).toEqual(['all', 'active']);
    });

    it('merges additional segments with base', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: {
          additionalSegments: [
            { id: 'pending', label: 'Pending', filters: { status: { eq: 'pending' } } },
          ],
        },
      });

      expect(result.listPageConfig.segments).toHaveLength(4);
      const segmentIds = result.listPageConfig.segments.map((s: any) => s.id);
      expect(segmentIds).toContain('pending');
    });

    it('additional segments with matching ID override base segments', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: {
          additionalSegments: [
            { id: 'active', label: 'Active Teams', filters: { status: { eq: 'active' }, verified: true } },
          ],
        },
      });

      expect(result.listPageConfig.segments).toHaveLength(3);
      const activeSegment = result.listPageConfig.segments.find((s: any) => s.id === 'active');
      expect(activeSegment.label).toBe('Active Teams');
      expect(activeSegment.filters.verified).toBe(true);
    });

    it('hides columns via hideFields', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { hideFields: ['secret'] },
      });

      const colNames = result.listPageConfig.columnsConfig.map((c: any) => c.name);
      expect(colNames).toContain('name');
      expect(colNames).toContain('status');
      expect(colNames).not.toContain('secret');
    });

    it('shows only specific columns via showOnlyFields', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: { showOnlyFields: ['name'] },
      });

      expect(result.listPageConfig.columnsConfig).toHaveLength(1);
      expect(result.listPageConfig.columnsConfig[0].name).toBe('name');
    });

    it('merges single API config override', () => {
      mockGetPageConfig.mockReturnValue(JSON.parse(JSON.stringify(listBaseConfig)));
      const resolveConfigRef = getResolveConfigRef();

      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: {
          apiConfig: { apiMethod: 'GET', apiUrl: '/api/teams/custom' },
        },
      });

      expect(result.listPageConfig.apiConfig.apiUrl).toBe('/api/teams/custom');
      // Original fields preserved
      expect(result.listPageConfig.apiConfig.apiMethod).toBe('GET');
    });

    it('handles dual API config override', () => {
      const dualBaseConfig = JSON.parse(JSON.stringify(listBaseConfig));
      dualBaseConfig.listPageConfig.apiConfig = {
        search: { apiMethod: 'POST', apiUrl: '/api/search' },
        database: { apiMethod: 'GET', apiUrl: '/api/teams' },
      };
      mockGetPageConfig.mockReturnValue(dualBaseConfig);
      const resolveConfigRef = getResolveConfigRef();

      // Full dual override (both search and database)
      const result = resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: {
          apiConfig: {
            search: { apiMethod: 'POST', apiUrl: '/api/search', responseKey: 'teams' },
            database: { apiMethod: 'GET', apiUrl: '/api/teams', responseKey: 'teams' },
          },
        },
      });

      expect(result.listPageConfig.apiConfig.search.responseKey).toBe('teams');
      expect(result.listPageConfig.apiConfig.database.responseKey).toBe('teams');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DEEP CLONE SAFETY
  // ══════════════════════════════════════════════════════════════════════════

  describe('immutability', () => {
    it('does not mutate base config', () => {
      const baseConfig = {
        pageTitle: 'Teams',
        listPageConfig: {
          defaultFilters: { active: true },
          segments: [{ id: 'all', label: 'All', filters: {} }],
        },
      };
      mockGetPageConfig.mockReturnValue(baseConfig);
      const resolveConfigRef = getResolveConfigRef();

      resolveConfigRef({
        entityName: 'team',
        pageType: 'list',
        overrideConfig: {
          pageTitle: 'My Teams',
          defaultFilters: { extra: true },
        },
      });

      // Original should be unchanged
      expect(baseConfig.pageTitle).toBe('Teams');
      expect(baseConfig.listPageConfig.defaultFilters).toEqual({ active: true });
    });
  });
});
