/**
 * TreeLayout — embedded tree view for the unified ViewSwitcher (#119).
 *
 * Data strategy:
 * 1. If config has its own apiConfig → use that (independent fetching)
 * 2. If parentApiConfig is provided (from the parent Table) → use that (independent fetching)
 * 3. If config has static data → use that
 * 4. Fallback to shared records from parent
 *
 * Trees need all records to build the parent-child hierarchy, so independent
 * mode fetches with a high count limit (maxRecords).
 */

import React, { useMemo, useState } from 'react';
import { Tree, Input, Empty, Card, Spin } from 'antd';
import type { TreeProps } from 'antd';
import { SearchOutlined, LoadingOutlined } from '@ant-design/icons';
import type { TreeViewConfig } from '../types';
import { useTreeData } from '../hooks/useTreeData';
import type { IApiConfig } from '../../../context/ApiContext';

type AntTreeDataNode = NonNullable<TreeProps[ 'treeData' ]>[ number ];

export interface TreeLayoutProps {
  /** Shared records from parent (last resort fallback) */
  records?: Record<string, unknown>[];
  config: TreeViewConfig;
  recordIdentifierKey: string;
  onRecordClick?: (record: Record<string, unknown>) => void;
  /** Parent table's API config — used for independent fetching when config has no apiConfig */
  parentApiConfig?: IApiConfig;
  /** Parent table's applied filters — forwarded to independent query */
  appliedFilters?: Record<string, unknown>;
  /** Route params for URL substitution */
  routeParams?: Record<string, string>;
  /** Entity name for cache key scoping */
  entityName?: string;
}

interface TreeNodeData extends AntTreeDataNode {
  record: Record<string, unknown>;
  nodeId: string;
  __children: TreeNodeData[];
}

function buildTree(
  records: Record<string, unknown>[],
  idField: string,
  parentField: string,
  labelField: string,
  searchQuery: string
): TreeNodeData[] {
  const nodeMap = new Map<string, TreeNodeData>();

  for (const rec of records) {
    const id = String(rec[ idField ] ?? '');
    const label = String(rec[ labelField ] ?? id);
    if (!id) continue;
    nodeMap.set(id, {
      key: id,
      title: label,
      record: rec,
      nodeId: id,
      __children: [],
    });
  }

  const roots: TreeNodeData[] = [];

  for (const rec of records) {
    const id = String(rec[ idField ] ?? '');
    const parentId = rec[ parentField ] != null ? String(rec[ parentField ]) : null;
    const node = nodeMap.get(id);
    if (!node) continue;

    if (parentId != null && nodeMap.has(parentId)) {
      const parent = nodeMap.get(parentId)!;
      parent.__children.push(node);
      parent.children = parent.__children;
    } else {
      roots.push(node);
    }
  }

  if (!searchQuery) return roots;

  const lq = searchQuery.toLowerCase();

  const filterNode = (node: TreeNodeData): TreeNodeData | null => {
    const filteredChildren = node.__children
      .map(filterNode)
      .filter((n): n is TreeNodeData => n !== null);
    const titleStr = typeof node.title === 'string' ? node.title : '';
    if (titleStr.toLowerCase().includes(lq) || filteredChildren.length > 0) {
      return {
        ...node,
        __children: filteredChildren,
        children: filteredChildren.length > 0 ? filteredChildren : undefined,
      };
    }
    return null;
  };

  return roots.map(filterNode).filter((n): n is TreeNodeData => n !== null);
}

export const TreeLayout: React.FC<TreeLayoutProps> = ({
  records: sharedRecords,
  config,
  recordIdentifierKey,
  onRecordClick,
  parentApiConfig,
  appliedFilters = {},
  routeParams = {},
  entityName = 'entity',
}) => {
  const { parentField, labelField, defaultExpandDepth } = config;
  const idKey = config.idField || recordIdentifierKey;

  const effectiveApiConfig: IApiConfig | null = config.apiConfig ?? parentApiConfig ?? null;
  const useIndependentData = effectiveApiConfig != null;

  const [ searchQuery, setSearchQuery ] = useState('');

  const independentResult = useTreeData({
    apiConfig: effectiveApiConfig ?? { apiUrl: '', apiMethod: 'GET' },
    appliedFilters,
    routeParams,
    entityName,
    maxRecords: config.maxRecords,
    enabled: useIndependentData,
  });

  const effectiveRecords = useMemo(() => {
    if (useIndependentData) return independentResult.records;
    return config.data ?? sharedRecords ?? [];
  }, [ useIndependentData, independentResult.records, config.data, sharedRecords ]);

  const isLoading = useIndependentData && independentResult.isLoading;

  const treeData = useMemo(
    () => buildTree(effectiveRecords, idKey, parentField, labelField, searchQuery),
    [ effectiveRecords, idKey, parentField, labelField, searchQuery ]
  );

  const recordMap = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const rec of effectiveRecords) m.set(String(rec[ idKey ] ?? ''), rec);
    return m;
  }, [ effectiveRecords, idKey ]);

  const defaultExpandAll = defaultExpandDepth === undefined || defaultExpandDepth === Infinity;

  if (isLoading) {
    return (
      <Card style={{ marginTop: 8, textAlign: 'center', padding: 32 }}>
        <Spin indicator={<LoadingOutlined />} />
      </Card>
    );
  }

  if (effectiveRecords.length === 0) {
    return <Empty description="No records" style={{ padding: 24 }} />;
  }

  return (
    <Card style={{ marginTop: 8 }}>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Search nodes…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ marginBottom: 12, maxWidth: 320 }}
        allowClear
      />
      <Tree
        treeData={treeData}
        showLine
        selectable
        defaultExpandAll={defaultExpandAll}
        onSelect={(keys) => {
          if (onRecordClick && keys.length > 0) {
            const rec = recordMap.get(String(keys[ 0 ]));
            if (rec) onRecordClick(rec);
          }
        }}
      />
    </Card>
  );
};
