import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUi24Config } from '../../context/UI24Context';
import { ExtensionRegistry } from '../../registry/ExtensionRegistry';
import type { CommandItem } from './CommandPalette';

/** Menu item shape from config. */
interface MenuItem {
  key?: string;
  label?: string;
  url?: string;
  icon?: string;
  children?: MenuItem[];
}

const RECENT_STORAGE_KEY = 'ui24-cmd-recent';
const MAX_RECENT_STORAGE = 20;

function getRecentIds(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch { return []; }
}

function addRecentId(id: string): void {
  const ids = getRecentIds().filter(i => i !== id);
  ids.unshift(id);
  sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT_STORAGE)));
}

/** Infer page type from config key naming convention. */
function inferPageType(key: string, pc: Record<string, unknown>): string | undefined {
  if (typeof pc.pageType === 'string') return pc.pageType;
  const lk = key.toLowerCase();
  if (lk.startsWith('list-')) return 'list';
  if (lk.startsWith('create-') || lk.startsWith('add-')) return 'form';
  if (lk.startsWith('edit-') || lk.startsWith('update-')) return 'form';
  if (lk.startsWith('view-') || lk.startsWith('detail-') || lk.startsWith('details-')) return 'details';
  if (lk.startsWith('dashboard')) return 'dashboard';
  return undefined;
}

/** Infer entity name from config key. */
function inferEntityName(key: string, pc: Record<string, unknown>): string | undefined {
  if (typeof pc.entityName === 'string') return pc.entityName;
  const prefixes = ['list-', 'create-', 'add-', 'edit-', 'update-', 'view-', 'detail-', 'details-'];
  for (const prefix of prefixes) {
    if (key.toLowerCase().startsWith(prefix)) {
      return key.slice(prefix.length);
    }
  }
  return undefined;
}

/** Resolve the navigable route for a page config entry. */
function resolveRoute(key: string, pc: Record<string, unknown>): string {
  if (typeof pc.routePattern === 'string') {
    const rp = pc.routePattern;
    // Skip patterns with dynamic params — they need IDs we don't have
    if (rp.includes(':') || rp.includes('{')) return '';
    return rp.startsWith('/') ? rp : `/${rp}`;
  }
  // Fallback: use the key as route
  return key.startsWith('/') ? key : `/${key}`;
}

/** Humanize entity name: "social-account" → "Social Accounts" */
function humanize(name: string, plural = false): string {
  const words = name.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
  const result = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return plural ? `${result}s` : result;
}

/**
 * Hook that powers the command palette.
 * Builds navigation, entity, built-in, and extension command items from config.
 */
export function useCommandPalette(navigate: (path: string) => void) {
  const [open, setOpen] = useState(false);
  const { config } = useUi24Config();

  const paletteConfig = config.commandPalette;
  const isEnabled = paletteConfig?.enabled !== false;

  const toggle = useCallback(() => {
    if (!isEnabled) return;
    setOpen(prev => !prev);
  }, [isEnabled]);
  const close = useCallback(() => setOpen(false), []);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    if (!isEnabled) return;
    const triggerKey = paletteConfig?.trigger?.replace('mod+', '') || 'k';
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === triggerKey) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle, isEnabled, paletteConfig?.trigger]);

  // ── Navigation items from menu config ─────────────────────────────────
  const navigationItems = useMemo<CommandItem[]>(() => {
    const result: CommandItem[] = [];
    const menuItems = config.menuItems || [];

    const processMenu = (items: MenuItem[], parentLabel = '') => {
      for (const item of items) {
        const label = typeof item.label === 'string' ? item.label : '';
        const url = typeof item.url === 'string' ? item.url : '';

        if (label && url) {
          result.push({
            id: `nav-${url}`,
            title: parentLabel ? `${parentLabel} > ${label}` : label,
            description: `Go to ${label}`,
            category: 'navigation',
            keywords: [url, label],
            path: url,
            onSelect: () => {
              navigate(url);
              close();
            },
          });
        }
        if (item.children) {
          processMenu(item.children, label || parentLabel);
        }
      }
    };

    processMenu(menuItems);
    return result;
  }, [config.menuItems, navigate, close]);

  // ── Entity items from pagesConfig ─────────────────────────────────────
  const entityItems = useMemo<CommandItem[]>(() => {
    const result: CommandItem[] = [];
    const pagesConfig = config.pagesConfig;
    if (!pagesConfig) return result;

    const seenListEntities = new Set<string>();
    const seenCreateEntities = new Set<string>();
    const seenViewEntities = new Set<string>();
    const seenEditEntities = new Set<string>();
    const seenListRoutes = new Map<string, string>();

    // First pass: collect list routes so edit/view commands can reference them
    for (const [pageKey, pageConfig] of Object.entries(pagesConfig)) {
      if (!pageConfig || typeof pageConfig !== 'object') continue;
      const pc = pageConfig as Record<string, unknown>;
      const pageType = inferPageType(pageKey, pc);
      const entityName = inferEntityName(pageKey, pc);
      const route = resolveRoute(pageKey, pc);
      if (pageType === 'list' && entityName && route) {
        seenListRoutes.set(entityName, route);
      }
    }

    for (const [pageKey, pageConfig] of Object.entries(pagesConfig)) {
      if (!pageConfig || typeof pageConfig !== 'object') continue;
      const pc = pageConfig as Record<string, unknown>;

      const pageType = inferPageType(pageKey, pc);
      const entityName = inferEntityName(pageKey, pc);
      const route = resolveRoute(pageKey, pc);
      const pageTitle = typeof pc.pageTitle === 'string' ? pc.pageTitle : undefined;

      // List pages
      if (pageType === 'list' && entityName && route && !seenListEntities.has(entityName)) {
        seenListEntities.add(entityName);
        result.push({
          id: `entity-${entityName}`,
          title: pageTitle || humanize(entityName, true),
          description: `View all ${humanize(entityName).toLowerCase()} records`,
          category: 'entity',
          keywords: [entityName, pageKey, 'list', 'browse', 'table'],
          path: route,
          onSelect: () => {
            navigate(route);
            close();
          },
        });
      }

      // Create/add pages
      if ((pageType === 'form' && (pageKey.startsWith('create-') || pageKey.startsWith('add-'))) && entityName && route && !seenCreateEntities.has(entityName)) {
        seenCreateEntities.add(entityName);
        result.push({
          id: `entity-create-${entityName}`,
          title: pageTitle || `Create ${humanize(entityName)}`,
          description: `Create a new ${humanize(entityName).toLowerCase()} record`,
          category: 'entity',
          keywords: [entityName, 'create', 'new', 'add', pageKey],
          path: route,
          onSelect: () => {
            navigate(route);
            close();
          },
        });
      }

      // View/detail pages — navigate to entity list as entry point (#63)
      if ((pageType === 'details' || pageKey.startsWith('view-') || pageKey.startsWith('detail-') || pageKey.startsWith('details-')) && entityName && !seenViewEntities.has(entityName)) {
        const listRoute = seenListRoutes.get(entityName);
        if (listRoute) {
          seenViewEntities.add(entityName);
          result.push({
            id: `entity-view-${entityName}`,
            title: pageTitle || `View ${humanize(entityName)}`,
            description: `View a ${humanize(entityName).toLowerCase()} record (opens list to select)`,
            category: 'entity',
            keywords: [entityName, 'view', 'detail', 'show', pageKey],
            path: listRoute,
            onSelect: () => {
              navigate(listRoute);
              close();
            },
          });
        }
      }

      // Edit pages — navigate to entity list as entry point (#63)
      if (pageType === 'form' && (pageKey.startsWith('edit-') || pageKey.startsWith('update-')) && entityName && !seenEditEntities.has(entityName)) {
        const listRoute = seenListRoutes.get(entityName);
        if (listRoute) {
          seenEditEntities.add(entityName);
          result.push({
            id: `entity-edit-${entityName}`,
            title: pageTitle || `Edit ${humanize(entityName)}`,
            description: `Edit a ${humanize(entityName).toLowerCase()} record (opens list to select)`,
            category: 'entity',
            keywords: [entityName, 'edit', 'update', 'modify', pageKey],
            path: listRoute,
            onSelect: () => {
              navigate(listRoute);
              close();
            },
          });
        }
      }

      // Dashboard pages
      if (pageType === 'dashboard' && route) {
        result.push({
          id: `page-${pageKey}`,
          title: pageTitle || humanize(pageKey),
          description: 'Dashboard view',
          category: 'navigation',
          keywords: [pageKey, 'dashboard'],
          path: route,
          onSelect: () => {
            navigate(route);
            close();
          },
        });
      }
    }

    return result;
  }, [config.pagesConfig, navigate, close]);

  // ── Extension commands from registry ──────────────────────────────────
  const extensionItems = useMemo<CommandItem[]>(() => {
    const commands = ExtensionRegistry.getCommands();
    return commands.map(cmd => ({
      id: `cmd-${cmd.id}`,
      title: cmd.label,
      description: cmd.group ? `${cmd.group} command` : undefined,
      category: cmd.group || 'command',
      keywords: [cmd.id, cmd.label, cmd.group || ''].filter(Boolean),
      shortcut: cmd.shortcut,
      onSelect: () => {
        cmd.handler();
        close();
      },
    }));
  }, [close]);

  // ── Built-in power commands ───────────────────────────────────────────
  const builtInItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    items.push({
      id: 'builtin-copy-url',
      title: 'Copy Current URL',
      description: 'Copy the current page URL to clipboard',
      category: 'action',
      keywords: ['copy', 'url', 'link', 'clipboard', 'share'],
      shortcut: 'Ctrl+L',
      onSelect: () => {
        navigator.clipboard.writeText(window.location.href).catch(() => {});
        close();
      },
    });

    items.push({
      id: 'builtin-reload',
      title: 'Reload Page',
      description: 'Refresh the current page',
      category: 'action',
      keywords: ['reload', 'refresh', 'hard'],
      shortcut: 'Ctrl+R',
      onSelect: () => {
        window.location.reload();
      },
    });

    items.push({
      id: 'builtin-scroll-top',
      title: 'Scroll to Top',
      description: 'Jump to the top of the page',
      category: 'action',
      keywords: ['scroll', 'top', 'beginning', 'jump'],
      onSelect: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        close();
      },
    });

    items.push({
      id: 'builtin-go-home',
      title: 'Go to Dashboard',
      description: 'Navigate to the home page',
      category: 'navigation',
      keywords: ['home', 'dashboard', 'main', 'start'],
      path: '/',
      onSelect: () => {
        navigate('/');
        close();
      },
    });

    items.push({
      id: 'builtin-fullscreen',
      title: 'Toggle Fullscreen',
      description: 'Enter or exit fullscreen mode',
      category: 'action',
      keywords: ['fullscreen', 'maximize', 'screen', 'expand'],
      shortcut: 'F11',
      onSelect: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        close();
      },
    });

    items.push({
      id: 'builtin-go-back',
      title: 'Go Back',
      description: 'Navigate to the previous page',
      category: 'action',
      keywords: ['back', 'previous', 'history'],
      shortcut: 'Alt+Left',
      onSelect: () => {
        window.history.back();
        close();
      },
    });

    items.push({
      id: 'builtin-go-forward',
      title: 'Go Forward',
      description: 'Navigate to the next page',
      category: 'action',
      keywords: ['forward', 'next', 'history'],
      shortcut: 'Alt+Right',
      onSelect: () => {
        window.history.forward();
        close();
      },
    });

    return items;
  }, [navigate, close]);

  // ── Combine all base items ────────────────────────────────────────────
  const recentCount = paletteConfig?.recentCount ?? 5;
  const [recentVersion, setRecentVersion] = useState(0);

  const allBaseItems = useMemo<CommandItem[]>(
    () => [...navigationItems, ...entityItems, ...extensionItems, ...builtInItems],
    [navigationItems, entityItems, extensionItems, builtInItems]
  );

  // ── Recent items from sessionStorage ──────────────────────────────────
  const recentItems = useMemo<CommandItem[]>(() => {
    void recentVersion;
    const recentIds = getRecentIds();
    const itemMap = new Map(allBaseItems.map(item => [item.id, item]));
    return recentIds
      .map(id => itemMap.get(id))
      .filter((item): item is CommandItem => !!item)
      .slice(0, recentCount)
      .map(item => ({ ...item, category: 'recent' as const }));
  }, [allBaseItems, recentCount, recentVersion]);

  // Wrap items to track selection as recent
  const trackAndSelect = useCallback((item: CommandItem) => {
    addRecentId(item.id);
    setRecentVersion(v => v + 1);
    item.onSelect();
  }, []);

  // Final combined item list: recent first, then all base with tracking
  const items = useMemo<CommandItem[]>(() => {
    const wrapped = allBaseItems.map(item => ({
      ...item,
      onSelect: () => trackAndSelect(item),
    }));
    return [...recentItems, ...wrapped];
  }, [allBaseItems, recentItems, trackAndSelect]);

  return { open, toggle, close, items, recentCount };
}
