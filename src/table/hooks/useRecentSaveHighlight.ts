import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  escapeCssAttributeValue,
  getStableTableRecordId,
  UI24_RECENT_HIGHLIGHT_DATA_ATTR,
} from '../../core/utils/list-highlight';
import {
  getRecentlyTouchedRecordIds,
  getRecentTouchesSnapshotKey,
  subscribeRecentRecordTouches,
} from '../../core/utils/recent-save-handoff-store';
import type { ITableConfig } from '../type';

/**
 * Highlights list/card rows whose ids are still in the global recent-mutation registry.
 * How long they stay highlighted is controlled at save time via `recentMutationTouch` on the operation.
 */
export function useRecentSaveHighlight(
  config: ITableConfig[ 'recentSaveHighlight' ],
  recordIdentifierKey: string,
  listRecords: Array<Record<string, unknown>>,
  isInitialLoad: boolean,
  layout: 'table' | 'card'
): { activeHighlightIds: ReadonlySet<string> } {
  const enabled = config !== false;

  const snapshotKey = useSyncExternalStore(
    subscribeRecentRecordTouches,
    getRecentTouchesSnapshotKey,
    () => ''
  );

  const activeHighlightIds = useMemo(() => {
    if (!enabled) return new Set<string>();
    const touched = getRecentlyTouchedRecordIds();
    if (touched.size === 0) return new Set<string>();
    return touched;
  }, [ enabled, snapshotKey ]);

  const scrollIdsKey = useMemo(() => {
    if (!enabled || activeHighlightIds.size === 0) return '';
    const onPage = listRecords
      .map(r => getStableTableRecordId(r as Record<string, unknown>, recordIdentifierKey))
      .filter(rid => rid && activeHighlightIds.has(rid));
    return onPage.join(',');
  }, [ enabled, activeHighlightIds, listRecords, recordIdentifierKey ]);

  const scrolledRef = useRef(false);
  useEffect(() => {
    scrolledRef.current = false;
  }, [ scrollIdsKey, layout ]);

  useEffect(() => {
    if (!enabled || activeHighlightIds.size === 0 || isInitialLoad) return;
    const hit = listRecords.find(r => {
      const sid = getStableTableRecordId(r as Record<string, unknown>, recordIdentifierKey);
      return !!sid && activeHighlightIds.has(sid);
    });
    if (!hit || scrolledRef.current) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      if (layout === 'table') {
        // Ant Design rowKey uses the synthetic field value (JSON), not the plain entity id.
        const domKey = String((hit as Record<string, unknown>)[ recordIdentifierKey ] ?? '');
        const safe = escapeCssAttributeValue(domKey);
        document.querySelector(`tr[data-row-key="${safe}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        const sid = getStableTableRecordId(hit as Record<string, unknown>, recordIdentifierKey);
        const safe = escapeCssAttributeValue(sid);
        const card = document.querySelector(`[${UI24_RECENT_HIGHLIGHT_DATA_ATTR}="${safe}"]`);
        card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }, [ enabled, activeHighlightIds.size, isInitialLoad, layout, listRecords, recordIdentifierKey, scrollIdsKey ]);

  return { activeHighlightIds: enabled ? activeHighlightIds : new Set() };
}
