/**
 * Cross-panel navigation store.
 * Allows panels to request navigation to another panel and highlight a specific item.
 *
 * Usage:
 *   // From NetworkPanel: jump to trace for a span
 *   devtoolsNavigate('debug', 'traces', { spanId: 'abc123' });
 *
 *   // From TraceViewer: jump to network entry
 *   devtoolsNavigate('debug', 'network', { networkId: 'net_123' });
 *
 * ConfigDevTools subscribes to this store and switches tabs accordingly.
 */

import { useEffect, useState } from 'react';

export interface DevtoolsNavigationTarget {
  tab: string;
  subTab?: string;
  /** Highlight a specific span in TraceViewerPanel */
  spanId?: string;
  /** Highlight a specific network entry in NetworkPanel */
  networkId?: string;
}

let _pending: DevtoolsNavigationTarget | null = null;
const _listeners = new Set<() => void>();

export function devtoolsNavigate(
  tab: string,
  subTab?: string,
  extra?: { spanId?: string; networkId?: string },
): void {
  _pending = { tab, subTab, ...extra };
  _listeners.forEach(fn => fn());
}

/** Consume the pending navigation (clears it after reading). */
export function consumeNavigation(): DevtoolsNavigationTarget | null {
  const v = _pending;
  _pending = null;
  return v;
}

export function useDevtoolsNavigation(): DevtoolsNavigationTarget | null {
  const [nav, setNav] = useState<DevtoolsNavigationTarget | null>(null);

  useEffect(() => {
    const handler = () => {
      setNav(consumeNavigation());
    };
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);

  return nav;
}

/** Reactive: returns the highlighted spanId from last navigation to traces */
let _highlightedSpanId: string | undefined;
let _highlightedNetworkId: string | undefined;
const _highlightListeners = new Set<() => void>();

export function setHighlightedSpanId(id: string | undefined): void {
  _highlightedSpanId = id;
  _highlightListeners.forEach(fn => fn());
}

export function setHighlightedNetworkId(id: string | undefined): void {
  _highlightedNetworkId = id;
  _highlightListeners.forEach(fn => fn());
}

export function useHighlightedSpanId(): string | undefined {
  const [id, setId] = useState<string | undefined>(_highlightedSpanId);
  useEffect(() => {
    const handler = () => setId(_highlightedSpanId);
    _highlightListeners.add(handler);
    return () => { _highlightListeners.delete(handler); };
  }, []);
  return id;
}

export function useHighlightedNetworkId(): string | undefined {
  const [id, setId] = useState<string | undefined>(_highlightedNetworkId);
  useEffect(() => {
    const handler = () => setId(_highlightedNetworkId);
    _highlightListeners.add(handler);
    return () => { _highlightListeners.delete(handler); };
  }, []);
  return id;
}
