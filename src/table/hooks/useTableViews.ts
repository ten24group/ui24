import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Condition } from '../../core/types/evaluation';
import { useConditionBatch } from '../../core/hooks/useConditionBatch';

/** Serializable snapshot of table state */
export interface TableViewState {
  columns?: string[];
  sort?: Array<{ field: string; order: string }>;
  filters?: Record<string, unknown>;
  pageSize?: number;
  segment?: string;
  search?: string;
}

/** A named saved view */
export interface SavedView {
  id: string;
  name: string;
  state: TableViewState;
  isPreset?: boolean;
  createdAt: string;
}

/** Preset view from config */
export interface PresetView {
  id: string;
  name: string;
  state: TableViewState;
  visibility?: Condition;
}

/** View storage abstraction — swappable for API-backed storage later */
export interface ViewStorage {
  list(entityName: string): SavedView[];
  save(entityName: string, view: SavedView): void;
  remove(entityName: string, viewId: string): void;
}

/** localStorage-backed implementation */
class LocalStorageViewStorage implements ViewStorage {
  private storageKey(entityName: string): string {
    return `ui24:views:${entityName}`;
  }

  list(entityName: string): SavedView[] {
    try {
      const raw = localStorage.getItem(this.storageKey(entityName));
      return raw ? (JSON.parse(raw) as SavedView[]) : [];
    } catch {
      return [];
    }
  }

  save(entityName: string, view: SavedView): void {
    const views = this.list(entityName);
    const idx = views.findIndex(v => v.id === view.id);
    if (idx >= 0) {
      views[idx] = view;
    } else {
      views.push(view);
    }
    try {
      localStorage.setItem(this.storageKey(entityName), JSON.stringify(views));
    } catch { /* quota exceeded — ignore */ }
  }

  remove(entityName: string, viewId: string): void {
    const views = this.list(entityName).filter(v => v.id !== viewId);
    try {
      localStorage.setItem(this.storageKey(entityName), JSON.stringify(views));
    } catch { /* ignore */ }
  }
}

const defaultStorage = new LocalStorageViewStorage();

/** Configuration for saved views on a table */
export interface IViewsConfig {
  enabled: boolean;
  presets?: PresetView[];
  allowUserViews?: boolean;
  autoRemember?: boolean;
  storage?: ViewStorage;
}

/**
 * Hook for managing named table views (#19).
 * Supports preset views from config + user-created views in localStorage.
 */
export function useTableViews(
  entityName: string | undefined,
  config: IViewsConfig | undefined,
  currentState: TableViewState
) {
  const storage = config?.storage ?? defaultStorage;
  const key = entityName ?? '__default';

  const [userViews, setUserViews] = useState<SavedView[]>(() =>
    config?.enabled ? storage.list(key) : []
  );
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Evaluate visibility conditions for preset views
  const presetConditions = useMemo(
    () => (config?.presets ?? []).map(p => p.visibility),
    [config?.presets]
  );
  const presetVisibility = useConditionBatch(presetConditions);

  const allViews = useMemo(() => {
    const presets: SavedView[] = (config?.presets ?? [])
      .filter((_, i) => presetVisibility[i] !== false)
      .map(p => ({ ...p, isPreset: true, createdAt: '' }));
    return [...presets, ...userViews];
  }, [config?.presets, presetVisibility, userViews]);

  // autoRemember: persist last-used state on every change
  const autoRememberRef = useRef(false);
  useEffect(() => {
    if (!config?.autoRemember || !config.enabled) return;
    if (!autoRememberRef.current) {
      autoRememberRef.current = true;
      return;
    }
    const lastView: SavedView = {
      id: '__last_used',
      name: 'Last Used',
      state: currentState,
      createdAt: new Date().toISOString(),
    };
    storage.save(key, lastView);
  }, [config?.autoRemember, config?.enabled, currentState, storage, key]);

  const saveView = useCallback((name: string) => {
    const view: SavedView = {
      id: `user_${Date.now()}`,
      name,
      state: currentState,
      createdAt: new Date().toISOString(),
    };
    storage.save(key, view);
    setUserViews(prev => [...prev, view]);
    setActiveViewId(view.id);
    return view;
  }, [storage, key, currentState]);

  const deleteView = useCallback((viewId: string) => {
    storage.remove(key, viewId);
    setUserViews(prev => prev.filter(v => v.id !== viewId));
    if (activeViewId === viewId) setActiveViewId(null);
  }, [storage, key, activeViewId]);

  const loadView = useCallback((viewId: string): TableViewState | undefined => {
    const view = allViews.find(v => v.id === viewId);
    if (view) {
      setActiveViewId(viewId);
      return view.state;
    }
    return undefined;
  }, [allViews]);

  return {
    views: allViews,
    activeViewId,
    saveView,
    deleteView,
    loadView,
    enabled: config?.enabled ?? false,
  };
}
