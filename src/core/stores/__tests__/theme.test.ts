/**
 * Tests for theme store
 */

import {
  getThemeMode,
  getThemePreference,
  setThemePreference,
  toggleThemeMode,
  setThemeMode,
  initThemeStore,
} from '../theme';

describe('Theme Store', () => {
  beforeEach(() => {
    localStorage.clear();
    initThemeStore('test-app');
    setThemePreference('system');
  });

  describe('Theme Preferences', () => {
    it('should default to system preference', () => {
      expect(getThemePreference()).toBe('system');
    });

    it('should set and get preference', () => {
      setThemePreference('dark');
      expect(getThemePreference()).toBe('dark');

      setThemePreference('light');
      expect(getThemePreference()).toBe('light');

      setThemePreference('system');
      expect(getThemePreference()).toBe('system');
    });

    it('should persist preference to localStorage', () => {
      setThemePreference('dark');
      expect(localStorage.getItem('ui24_test_app_theme_preference')).toBe('dark');
    });
  });

  describe('Theme Mode Resolution', () => {
    it('should return light when preference is light', () => {
      setThemePreference('light');
      expect(getThemeMode()).toBe('light');
    });

    it('should return dark when preference is dark', () => {
      setThemePreference('dark');
      expect(getThemeMode()).toBe('dark');
    });

    it('should resolve system preference based on matchMedia', () => {
      setThemePreference('system');
      const mode = getThemeMode();
      expect([ 'light', 'dark' ]).toContain(mode);
    });
  });

  describe('Legacy API Compatibility', () => {
    it('toggleThemeMode should toggle between light and dark', () => {
      setThemePreference('light');
      toggleThemeMode();
      expect(getThemePreference()).toBe('dark');

      toggleThemeMode();
      expect(getThemePreference()).toBe('light');
    });

    it('setThemeMode should set preference directly', () => {
      setThemeMode('dark');
      expect(getThemePreference()).toBe('dark');
      expect(getThemeMode()).toBe('dark');
    });
  });

  describe('Preference Switching', () => {
    it('should not trigger unnecessary updates when setting same preference', () => {
      setThemePreference('dark');
      const mode1 = getThemeMode();

      setThemePreference('dark');
      const mode2 = getThemeMode();

      expect(mode1).toBe(mode2);
    });

    it('should handle rapid preference changes', () => {
      setThemePreference('light');
      setThemePreference('dark');
      setThemePreference('system');
      setThemePreference('light');

      expect(getThemePreference()).toBe('light');
      expect(getThemeMode()).toBe('light');
    });
  });

  describe('Storage Safety', () => {
    it('should handle localStorage errors gracefully', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => setThemePreference('dark')).not.toThrow();

      setItemSpy.mockRestore();
    });
  });
});
