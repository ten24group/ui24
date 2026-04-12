/**
 * RelatedTabs — renders antd Tabs containing embedded sub-tables for related entities (#91).
 *
 * Each tab maps to a `pageConfigKey` in the page config registry.
 * The parent record's route params are merged in, so `:id` and other placeholders resolve correctly.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Tabs } from 'antd';
import type { IRelatedTab } from '../../core/types/field-config';
import { useNewEvaluationContext } from '../../core/context/NewEvaluationContext';
import { conditionEvaluator } from '../../core/utils/ConditionEvaluator';
import { useUi24Config } from '../../core/context';
import { TablePage } from './TablePage';

interface RelatedTabsProps {
  tabs: IRelatedTab[];
  /** Parent record — used for placeholder resolution and condition evaluation */
  record: Record<string, unknown> | null;
  /** Parent route params — merged with record for placeholder resolution */
  routeParams?: Record<string, unknown>;
}

/**
 * Resolves `:param` placeholders in filter values using routeParams + record.
 */
function resolveFilters(
  filters: Record<string, string> | undefined,
  ctx: Record<string, unknown>
): Record<string, string> {
  if (!filters) return {};
  const resolved: Record<string, string> = {};
  for (const [ k, v ] of Object.entries(filters)) {
    resolved[ k ] = v.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key) => {
      const val = ctx[ key ];
      return val != null ? String(val) : v;
    });
  }
  return resolved;
}

export const RelatedTabs: React.FC<RelatedTabsProps> = ({ tabs, record, routeParams = {} }) => {
  const { getPageConfig } = useUi24Config();
  const evalCtx = useNewEvaluationContext();

  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        if (!tab.visibility) return true;
        return conditionEvaluator.evaluateSync(tab.visibility, evalCtx) !== false;
      }),
    [ tabs, evalCtx ]
  );

  // Track which tabs have been activated so we only mount their TablePage on demand
  const [ activatedKeys, setActivatedKeys ] = useState<Set<string>>(() =>
    new Set(visibleTabs.length > 0 ? [ visibleTabs[ 0 ].key ] : [])
  );
  const [ activeKey, setActiveKey ] = useState<string>(visibleTabs[ 0 ]?.key ?? '');

  const handleTabChange = useCallback((key: string) => {
    setActiveKey(key);
    setActivatedKeys(prev => {
      if (prev.has(key)) return prev;
      return new Set([ ...Array.from(prev), key ]);
    });
  }, []);

  if (visibleTabs.length === 0) return null;

  const mergedCtx: Record<string, unknown> = { ...routeParams, ...(record ?? {}) };

  const mergedRouteParams: Record<string, string | number | undefined> = Object.fromEntries(
    Object.entries(mergedCtx).filter(
      ([ , v ]) => v === undefined || typeof v === 'string' || typeof v === 'number'
    ) as Array<[ string, string | number | undefined ]>
  );

  const tabItems = visibleTabs.map((tab) => {
    const isActivated = activatedKeys.has(tab.key);

    // Only resolve config and create TablePage for tabs that have been activated
    if (!isActivated) {
      return { key: tab.key, label: tab.label, children: null };
    }

    const rawConfig = getPageConfig(tab.pageConfigKey);
    const resolvedFilters = resolveFilters(tab.defaultFilters, mergedCtx);
    const tableConfig = rawConfig?.listPageConfig ?? rawConfig;

    return {
      key: tab.key,
      label: tab.label,
      children: tableConfig ? (
        <TablePage
          {...tableConfig}
          routeParams={mergedRouteParams}
          defaultFilters={{ ...(tableConfig.defaultFilters ?? {}), ...resolvedFilters }}
          pageTitle={undefined}
          pageHeaderActions={[]}
        />
      ) : (
        <div style={{ padding: 16, color: '#888' }}>
          Page config &quot;{tab.pageConfigKey}&quot; not found.
        </div>
      ),
    };
  });

  return (
    <div style={{ marginTop: 16 }}>
      <Tabs
        items={tabItems}
        activeKey={activeKey}
        onChange={handleTabChange}
        destroyOnHidden
      />
    </div>
  );
};
