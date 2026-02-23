import { useState, useCallback } from 'react';
import type { ViewType, ViewConfig } from './types';

/** Type guard: checks if a string is a valid ViewType present in the allowed list. */
function isViewType(value: string, allowed: readonly ViewType[]): value is ViewType {
  return (allowed as readonly string[]).includes(value);
}

/**
 * Manages active view type and persists preference to localStorage.
 */
export function useViewState(config: ViewConfig, entityName?: string) {
  const storageKey = entityName ? `ui24-view-${entityName}` : null;

  const [activeView, setActiveView] = useState<ViewType>(() => {
    if (config.persistPreference && storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored && isViewType(stored, config.available)) {
        return stored;
      }
    }
    return config.default;
  });

  const switchView = useCallback((view: ViewType) => {
    if (!config.available.includes(view)) return;
    setActiveView(view);
    if (config.persistPreference && storageKey) {
      localStorage.setItem(storageKey, view);
    }
  }, [config.available, config.persistPreference, storageKey]);

  return { activeView, switchView, availableViews: config.available };
}
