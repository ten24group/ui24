import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Modal } from 'antd';
import { Command } from 'cmdk';
import MiniSearch, { type SearchResult } from 'minisearch';
import { ErrorBoundary } from 'react-error-boundary';
import {
  SearchOutlined,
  CompassOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  RightOutlined,
  FileOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import { useResolveRoute } from '../../hooks/useResolveRoute';
import { RenderFromPageType, isValidPageType, type IRenderFromPageType } from '../../../pages/PostAuth/PostAuthPage';
import { ModalContextProvider } from '../../context';
import { useModalDepth, ModalDepthContext } from '../../../modal/Modal';
import { getDefaultModalWidth, toModalSizeType } from '../../../modal/modalUtils';
import { ErrorFallback } from '../index';
import {
  isPageConfigEntry,
  toRenderProps,
  type PageConfigEntry,
} from '../../types/pageConfig';
import './CommandPalette.css';

// ============================================================================
// TYPES
// ============================================================================

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  category: 'navigation' | 'action' | 'entity' | 'recent' | 'custom' | 'command' | string;
  onSelect: () => void;
  keywords?: string[];
  shortcut?: string;
  path?: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  recentCount?: number;
  placeholder?: string;
}

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  recent: { label: 'Recent', icon: <ClockCircleOutlined /> },
  navigation: { label: 'Pages', icon: <CompassOutlined /> },
  entity: { label: 'Entities', icon: <AppstoreOutlined /> },
  action: { label: 'Actions', icon: <ThunderboltOutlined /> },
  command: { label: 'Commands', icon: <CodeOutlined /> },
  custom: { label: 'Custom', icon: <FileOutlined /> },
};

const getCategoryMeta = (cat: string) =>
  CATEGORY_META[ cat ] || { label: cat.charAt(0).toUpperCase() + cat.slice(1), icon: <FileOutlined /> };

const CATEGORY_ORDER = [ 'recent', 'navigation', 'entity', 'action', 'command', 'custom' ];

const FILTER_PREFIXES: Record<string, { categories: string[]; label: string }> = {
  '>': { categories: [ 'command', 'action' ], label: 'Commands' },
  '/': { categories: [ 'navigation' ], label: 'Pages' },
  '@': { categories: [ 'entity' ], label: 'Entities' },
};

// ============================================================================
// HIGHLIGHT HELPER
// ============================================================================

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (!terms || terms.length === 0) return <>{text}</>;

  const escaped = terms
    .filter(t => t.length > 0)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escaped.length === 0) return <>{text}</>;

  escaped.sort((a, b) => b.length - a.length);

  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="cmd-highlight">{part}</mark>
        ) : part ? (
          <React.Fragment key={i}>{part}</React.Fragment>
        ) : null
      )}
    </>
  );
}

// ============================================================================
// SHORTCUT BADGE
// ============================================================================

const ShortcutBadge: React.FC<{ shortcut: string }> = ({ shortcut }) => {
  const parts = shortcut.split('+');
  return (
    <span className="cmd-shortcut">
      {parts.map((key, i) => (
        <React.Fragment key={key}>
          <kbd className="cmd-kbd">{key}</kbd>
          {i < parts.length - 1 && <span className="cmd-kbd-sep">+</span>}
        </React.Fragment>
      ))}
    </span>
  );
};

// ============================================================================
// MINISEARCH SETUP
// ============================================================================

function flatKeywords(item: CommandItem): string {
  return (item.keywords || []).join(' ');
}

function buildIndex(items: CommandItem[]): MiniSearch {
  const ms = new MiniSearch({
    fields: [ 'title', 'description', 'keywordsText', 'path' ],
    storeFields: [ 'id' ],
    searchOptions: {
      boost: { title: 3, description: 1, keywordsText: 2, path: 1 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'OR',
    },
  });

  const seen = new Set<string>();
  const docs: Array<{ id: string; title: string; description: string; keywordsText: string; path: string }> = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    docs.push({
      id: item.id,
      title: item.title,
      description: item.description || '',
      keywordsText: flatKeywords(item),
      path: item.path || '',
    });
  }

  ms.addAll(docs);
  return ms;
}

// ============================================================================
// PEEK MODAL — opens a page route inside a modal
// ============================================================================

interface PeekModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

const PeekModal: React.FC<PeekModalProps> = ({ url, title, onClose }) => {
  const { found, pageConfig, params } = useResolveRoute(url);
  const currentDepth = useModalDepth();
  const nextDepth = currentDepth + 1;

  const width = useMemo(() => {
    if (!pageConfig) return 1200;
    const pageType = isPageConfigEntry(pageConfig) ? pageConfig.pageType : undefined;
    return getDefaultModalWidth(toModalSizeType(pageType), undefined) || 1200;
  }, [ pageConfig ]);

  if (!found || !pageConfig) {
    return (
      <Modal
        open
        onCancel={onClose}
        footer={null}
        title={title}
        width={640}
        destroyOnHidden
      >
        <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>
          Could not resolve page configuration for this route.
        </div>
      </Modal>
    );
  }

  return (
    <ModalDepthContext.Provider value={nextDepth}>
      <Modal
        open
        onCancel={onClose}
        footer={null}
        title={title}
        width={width}
        destroyOnHidden
        wrapClassName={`modal-depth-${currentDepth}`}
      >
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={onClose}>
          <ModalContextProvider>
            <RenderFromPageType
              {...toRenderProps(pageConfig, {
                routeParams: params,
                onCancelCallback: onClose,
              })}
            />
          </ModalContextProvider>
        </ErrorBoundary>
      </Modal>
    </ModalDepthContext.Provider>
  );
};

// ============================================================================
// COMMAND PALETTE COMPONENT
// ============================================================================

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  items,
  recentCount = 5,
  placeholder = 'Type a command or search…',
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ search, setSearch ] = useState('');
  const shiftHeld = useRef(false);

  // Peek modal state
  const [ peekItem, setPeekItem ] = useState<{ url: string; title: string } | null>(null);

  // Track Shift key globally
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = false; };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, []);

  // Force focus after modal animation
  useEffect(() => {
    if (open) {
      const timers = [ 50, 150, 300 ].map(ms =>
        setTimeout(() => inputRef.current?.focus(), ms)
      );
      return () => timers.forEach(clearTimeout);
    } else {
      setSearch('');
    }
  }, [ open ]);

  // Reset scroll on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => listRef.current?.scrollTo(0, 0));
    }
  }, [ open ]);

  // ── Parse prefix + query ──────────────────────────────────────────────
  const activePrefix = Object.keys(FILTER_PREFIXES).find(p => search.startsWith(p));
  const prefixMeta = activePrefix ? FILTER_PREFIXES[ activePrefix ] : null;
  const query = activePrefix ? search.slice(activePrefix.length).trimStart() : search.trim();

  // ── Pre-filter items by prefix category ───────────────────────────────
  const prefilteredItems = useMemo(() => {
    if (!prefixMeta) return items;
    return items.filter(i => prefixMeta.categories.includes(i.category));
  }, [ items, prefixMeta ]);

  // ── MiniSearch index ──────────────────────────────────────────────────
  const miniSearch = useMemo(() => buildIndex(prefilteredItems), [ prefilteredItems ]);

  // ── Item lookup map ───────────────────────────────────────────────────
  const itemMap = useMemo(() => {
    const map = new Map<string, CommandItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [ items ]);

  // ── Search ────────────────────────────────────────────────────────────
  const { results, searchTerms } = useMemo<{
    results: CommandItem[];
    searchTerms: string[];
  }>(() => {
    if (!query) {
      return { results: prefilteredItems, searchTerms: [] };
    }

    const searchResults: SearchResult[] = miniSearch.search(query);

    const allTerms = new Set<string>();
    for (const sr of searchResults) {
      if (sr.terms) for (const t of sr.terms) allTerms.add(t);
      if (sr.queryTerms) for (const t of sr.queryTerms) allTerms.add(t);
    }
    const rawTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    for (const t of rawTokens) allTerms.add(t);

    const matched = searchResults
      .map(sr => itemMap.get(sr.id as string))
      .filter((item): item is CommandItem => !!item);

    return { results: matched, searchTerms: Array.from(allTerms) };
  }, [ query, miniSearch, prefilteredItems, itemMap ]);

  // ── Group results by category ─────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups: Array<{ category: string; items: CommandItem[] }> = [];
    const seen = new Set<string>();

    for (const cat of CATEGORY_ORDER) {
      const catItems = results.filter(i => i.category === cat);
      if (catItems.length > 0) {
        groups.push({
          category: cat,
          items: cat === 'recent' ? catItems.slice(0, recentCount) : catItems,
        });
        seen.add(cat);
      }
    }
    const remaining = results.filter(i => !seen.has(i.category));
    const extraCats = Array.from(new Set(remaining.map(i => i.category)));
    for (const cat of extraCats) {
      groups.push({ category: cat, items: remaining.filter(i => i.category === cat) });
    }
    return groups;
  }, [ results, recentCount ]);

  const totalResults = results.length;

  const handleSelect = useCallback((item: CommandItem) => {
    // Shift+Enter on items with a path → open in peek modal
    if (shiftHeld.current && item.path) {
      setPeekItem({ url: item.path, title: item.title });
      onClose();
      return;
    }
    item.onSelect();
    onClose();
  }, [ onClose ]);

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        closable={false}
        width={640}
        style={{ top: '12vh' }}
        styles={{ body: { padding: 0 }, mask: { backdropFilter: 'blur(4px)' } }}
        destroyOnHidden
        className="cmd-palette-modal"
      >
        <Command
          className="cmd-palette"
          shouldFilter={false}
          label="Command palette"
        >
          {/* Search input */}
          <div className="cmd-palette-input-wrapper">
            <SearchOutlined className="cmd-palette-search-icon" />
            <Command.Input
              ref={inputRef}
              className="cmd-palette-input"
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
            />
            {prefixMeta && (
              <span className="cmd-palette-filter-badge">{prefixMeta.label}</span>
            )}
            {search && (
              <button
                className="cmd-palette-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                Esc
              </button>
            )}
          </div>

          {/* Filter hints when empty */}
          {!search && (
            <div className="cmd-palette-hints">
              <span className="cmd-palette-hint"><kbd>/</kbd> Pages</span>
              <span className="cmd-palette-hint"><kbd>&gt;</kbd> Commands</span>
              <span className="cmd-palette-hint"><kbd>@</kbd> Entities</span>
            </div>
          )}

          {/* Results */}
          <Command.List ref={listRef} className="cmd-palette-list">
            {totalResults === 0 && query && (
              <div className="cmd-palette-empty">
                <div className="cmd-palette-empty-icon"><SearchOutlined /></div>
                <div className="cmd-palette-empty-title">No results for &ldquo;{query}&rdquo;</div>
                <div className="cmd-palette-empty-hint">
                  Try a different term, or use <kbd>/</kbd> <kbd>&gt;</kbd> <kbd>@</kbd> to filter
                </div>
              </div>
            )}

            {grouped.map(group => {
              const meta = getCategoryMeta(group.category);
              return (
                <Command.Group
                  key={group.category}
                  heading={
                    <span className="cmd-palette-group-heading">
                      <span className="cmd-palette-group-icon">{meta.icon}</span>
                      {meta.label}
                      <span className="cmd-palette-group-count">{group.items.length}</span>
                    </span>
                  }
                >
                  {group.items.map(item => (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item)}
                      className="cmd-palette-item"
                    >
                      <span className="cmd-palette-item-icon">
                        {item.icon || getCategoryMeta(item.category).icon}
                      </span>
                      <div className="cmd-palette-item-content">
                        <span className="cmd-palette-item-title">
                          <HighlightedText text={item.title} terms={searchTerms} />
                        </span>
                        {(item.description || item.path) && (
                          <span className="cmd-palette-item-meta">
                            {item.description && (
                              <span className="cmd-palette-item-description">
                                <HighlightedText text={item.description} terms={searchTerms} />
                              </span>
                            )}
                            {item.path && (
                              <span className="cmd-palette-item-path">{item.path}</span>
                            )}
                          </span>
                        )}
                      </div>
                      {item.shortcut && <ShortcutBadge shortcut={item.shortcut} />}
                      {item.path && (
                        <ExpandOutlined
                          className="cmd-palette-item-peek"
                          title="Shift+Enter to open in modal"
                        />
                      )}
                      <RightOutlined className="cmd-palette-item-arrow" />
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>

          {/* Footer */}
          <div className="cmd-palette-footer">
            <div className="cmd-palette-footer-left">
              <span className="cmd-palette-footer-hint">
                <kbd className="cmd-kbd-sm">&uarr;&darr;</kbd> Navigate
              </span>
              <span className="cmd-palette-footer-hint">
                <kbd className="cmd-kbd-sm">&crarr;</kbd> Open
              </span>
              <span className="cmd-palette-footer-hint">
                <kbd className="cmd-kbd-sm">&#8679;&crarr;</kbd> Preview
              </span>
              <span className="cmd-palette-footer-hint">
                <kbd className="cmd-kbd-sm">Esc</kbd> Close
              </span>
            </div>
            <div className="cmd-palette-footer-right">
              <span className="cmd-palette-result-count">
                {totalResults} result{totalResults !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </Command>
      </Modal>

      {/* Peek modal — renders selected page in a modal overlay */}
      {peekItem && (
        <PeekModal
          url={peekItem.url}
          title={peekItem.title}
          onClose={() => setPeekItem(null)}
        />
      )}
    </>
  );
};
