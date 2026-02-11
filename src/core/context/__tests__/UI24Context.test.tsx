/**
 * Tests for core/context/UI24Context.tsx
 * 
 * UI24Context is the global configuration store for the entire UI24 system.
 * It manages:
 * - App configuration (baseURL, appName, appLogo, etc.)
 * - Pages config (entity page configurations from backend)
 * - Format config (date, time, boolean formatting)
 * - Menu items
 * - Config updates
 * 
 * getPageConfig is the critical function used by useEntityConfig to resolve
 * entity page configurations.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Ui24ConfigProvider, useUi24Config } from '../UI24Context';

// ============================================================================
// HELPERS
// ============================================================================

function makeWrapper(initConfig: any = {}) {
  return ({ children }: { children: React.ReactNode }) => (
    <Ui24ConfigProvider initConfig={{
      baseURL: 'https://api.example.com',
      appName: 'Test App',
      appLogo: '/logo.png',
      uiConfig: {
        auth: {},
        menu: {},
        pages: {},
        dashboard: {},
      },
      ...initConfig,
    }}>
      {children}
    </Ui24ConfigProvider>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('UI24Context', () => {
  describe('initial config', () => {
    it('provides initial config values', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper({ appName: 'My App' }),
      });

      expect(result.current.config.appName).toBe('My App');
      expect(result.current.config.baseURL).toBe('https://api.example.com');
    });

    it('merges format config with defaults', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper({
          formatConfig: { date: 'DD/MM/YYYY' },
        }),
      });

      const formatConfig = result.current.config.formatConfig;
      // Custom override
      expect(formatConfig?.date).toBe('DD/MM/YYYY');
      // Defaults still present
      expect(formatConfig?.time).toBe('hh:mm A');
      expect(formatConfig?.datetime).toBe('YYYY-MM-DD hh:mm A');
      expect(formatConfig?.boolean?.true).toBe('YES');
      expect(formatConfig?.boolean?.false).toBe('NO');
      expect(formatConfig?.timezone).toBe('America/New_York');
    });

    it('uses default format config when none provided', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper(),
      });

      const formatConfig = result.current.config.formatConfig;
      expect(formatConfig?.date).toBe('YYYY-MM-DD');
      expect(formatConfig?.time).toBe('hh:mm A');
      expect(formatConfig?.datetime).toBe('YYYY-MM-DD hh:mm A');
    });
  });

  describe('updateConfig', () => {
    it('updates config partially', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper(),
      });

      act(() => {
        result.current.updateConfig({ appName: 'Updated App' });
      });

      expect(result.current.config.appName).toBe('Updated App');
      // Other fields preserved
      expect(result.current.config.baseURL).toBe('https://api.example.com');
    });

    it('updates pages config', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper(),
      });

      const pagesConfig = {
        'list-team': { pageTitle: 'Teams', listPageConfig: {} },
        'view-team': { pageTitle: 'Team Details', detailsPageConfig: {} },
      };

      act(() => {
        result.current.updateConfig({ pagesConfig });
      });

      expect(result.current.config.pagesConfig).toBe(pagesConfig);
    });
  });

  describe('getPageConfig', () => {
    it('retrieves page config by key', () => {
      const pagesConfig = {
        'list-team': { pageTitle: 'Teams', listPageConfig: { columns: [] } },
        'view-team': { pageTitle: 'Team Details', detailsPageConfig: { fields: [] } },
        'create-team': { pageTitle: 'Create Team', formPageConfig: { buttons: [] } },
      };

      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper({ pagesConfig }),
      });

      expect(result.current.getPageConfig('list-team')).toEqual({
        pageTitle: 'Teams',
        listPageConfig: { columns: [] },
      });
      expect(result.current.getPageConfig('view-team')).toEqual({
        pageTitle: 'Team Details',
        detailsPageConfig: { fields: [] },
      });
    });

    it('returns undefined for non-existent page', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper({ pagesConfig: { 'list-team': {} } }),
      });

      expect(result.current.getPageConfig('list-unknown')).toBeUndefined();
    });

    it('returns undefined when pagesConfig is empty', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper({ pagesConfig: {} }),
      });

      expect(result.current.getPageConfig('list-team')).toBeUndefined();
    });

    it('returns undefined when pagesConfig is not set', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper(),
      });

      expect(result.current.getPageConfig('list-team')).toBeUndefined();
    });
  });

  describe('selectConfig', () => {
    it('selects specific config values via selector function', () => {
      const { result } = renderHook(() => useUi24Config(), {
        wrapper: makeWrapper({ appName: 'Test App' }),
      });

      const appName = result.current.selectConfig((config: any) => config.appName);
      expect(appName).toBe('Test App');
    });
  });
});
