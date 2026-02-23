/**
 * TreePage — config-driven hierarchical tree view (#47).
 *
 * Features:
 * - Fetches flat records and builds a parent-child tree via `idField` / `parentField`
 * - Search box that filters nodes and preserves ancestors
 * - Node click → navigate to `onClickNavigateTo`
 * - Per-node "⋯" action dropdown via `nodeActions` (edit, add child, delete, custom API)
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Tree, Card, Input, Spin, Alert, Empty, Dropdown, Button, Modal } from 'antd';
import type { TreeProps, MenuProps } from 'antd';
import { SearchOutlined, MoreOutlined } from '@ant-design/icons';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { useEntityList } from '../../core/query/useEntityList';
import type { IApiConfig } from '../../core/context/ApiContext';
import { useApi } from '../../core/context/ApiContext';
import { useCoreNavigator } from '../../routes/Navigation';
import { substituteUrlParams } from '../../core/utils';
import { useNewEvaluationContext } from '../../core/context/NewEvaluationContext';
import { conditionEvaluator } from '../../core/utils/ConditionEvaluator';
import type { Condition } from '../../core/types/evaluation';

type AntTreeDataNode = NonNullable<TreeProps['treeData']>[number];

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface ITreeNodeAction {
  label: string;
  icon?: string;
  action: 'navigate' | 'api';
  /** URL for navigate actions. Supports `:id` / `:idField` placeholders. */
  url?: string;
  apiConfig?: IApiConfig;
  confirmMessage?: string;
  /** Condition evaluated per-node (record available as context) to show/hide this action */
  visibility?: Condition;
}

export interface ITreePageConfig {
  entityName?: string;
  apiConfig: IApiConfig;
  idField: string;
  labelField: string;
  parentField: string;
  /** Navigate here on node click. Supports `:idField` / `:id` placeholder. */
  onClickNavigateTo?: string;
  selectable?: boolean;
  showSearch?: boolean;
  defaultExpandAll?: boolean;
  /** Per-node action buttons shown in a "⋯" dropdown */
  nodeActions?: ITreeNodeAction[];
}

interface TreePageProps
  extends ITreePageConfig,
    Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, string | number | undefined>;
  cardStyle?: React.CSSProperties;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractObjectPayload(
  payload: IApiConfig['payload']
): Record<string, unknown> {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    !(payload instanceof FormData)
  ) {
    return payload;
  }
  return {};
}

function substituteId(pattern: string, id: string, idField: string): string {
  return pattern.replace(`:${idField}`, id).replace(':id', id);
}

// ─── Internal node type carries original record for actions ──────────────────

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
    const id = String(rec[idField] ?? '');
    const label = String(rec[labelField] ?? id);
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
    const id = String(rec[idField] ?? '');
    const parentId = rec[parentField] != null ? String(rec[parentField]) : null;
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
    const filteredChildren = (node.__children)
      .map(filterNode)
      .filter((n): n is TreeNodeData => n !== null);
    const titleStr = typeof node.title === 'string' ? node.title : '';
    if (titleStr.toLowerCase().includes(lq) || filteredChildren.length > 0) {
      return { ...node, __children: filteredChildren, children: filteredChildren.length > 0 ? filteredChildren : undefined };
    }
    return null;
  };

  return roots.map(filterNode).filter((n): n is TreeNodeData => n !== null);
}

// ─── NodeTitle — renders label + action menu ──────────────────────────────────

interface NodeTitleProps {
  node: TreeNodeData;
  nodeActions?: ITreeNodeAction[];
  idField: string;
  evalCtx: ReturnType<typeof useNewEvaluationContext>;
  onNavigate: (url: string) => void;
  onApiAction: (apiConfig: IApiConfig, id: string, idField: string) => Promise<void>;
}

const NodeTitle: React.FC<NodeTitleProps> = ({
  node,
  nodeActions,
  idField,
  evalCtx,
  onNavigate,
  onApiAction,
}) => {
  const visibleActions = useMemo(() => {
    if (!nodeActions?.length) return [];
    return nodeActions.filter((a) => {
      if (!a.visibility) return true;
      return conditionEvaluator.evaluateSync(a.visibility, { ...evalCtx, record: node.record }) !== false;
    });
  }, [nodeActions, evalCtx, node.record]);

  const menuItems: MenuProps['items'] = visibleActions.map((a) => ({
    key: a.label,
    label: a.label,
    onClick: (info) => {
      info.domEvent.stopPropagation();
      if (a.action === 'navigate' && a.url) {
        onNavigate(substituteId(a.url, node.nodeId, idField));
      } else if (a.action === 'api' && a.apiConfig) {
        const execute = () => onApiAction(a.apiConfig!, node.nodeId, idField);
        if (a.confirmMessage) {
          Modal.confirm({ title: a.confirmMessage, onOk: execute });
        } else {
          execute();
        }
      }
    },
  }));

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <span style={{ flex: 1 }}>
        {typeof node.title === 'string' ? node.title : node.nodeId}
      </span>
      {menuItems.length > 0 && (
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            style={{ padding: '0 2px', color: '#aaa' }}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      )}
    </span>
  );
};

// ─── TreePage Component ────────────────────────────────────────────────────────

export const TreePage: React.FC<TreePageProps> = ({
  entityName,
  apiConfig,
  idField,
  labelField,
  parentField,
  onClickNavigateTo,
  selectable = true,
  showSearch = true,
  defaultExpandAll = false,
  nodeActions,
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  cardStyle,
}) => {
  const navigate = useCoreNavigator();
  const { callApiMethod } = useApi();
  const evalCtx = useNewEvaluationContext();
  const [searchQuery, setSearchQuery] = useState('');

  const resolvedUrl = useMemo(
    () => substituteUrlParams(apiConfig.apiUrl, routeParams),
    [apiConfig.apiUrl, routeParams]
  );

  const { data, isLoading, error } = useEntityList({
    entityName: entityName ?? 'tree',
    apiConfig,
    apiUrl: resolvedUrl,
    payload: extractObjectPayload(apiConfig.payload),
  });

  const records = useMemo(
    () => (Array.isArray(data) ? (data as Record<string, unknown>[]) : []),
    [data]
  );

  const treeData = useMemo(
    () => buildTree(records, idField, parentField, labelField, searchQuery),
    [records, idField, parentField, labelField, searchQuery]
  );

  const handleApiAction = useCallback(
    async (actionApiConfig: IApiConfig, id: string, idF: string) => {
      const url = substituteId(actionApiConfig.apiUrl, id, idF);
      await callApiMethod({ ...actionApiConfig, apiUrl: url });
    },
    [callApiMethod]
  );

  const titleRender = useCallback(
    (nodeData: AntTreeDataNode) => {
      const tnd = nodeData as TreeNodeData;
      return (
        <NodeTitle
          node={tnd}
          nodeActions={nodeActions}
          idField={idField}
          evalCtx={evalCtx}
          onNavigate={navigate}
          onApiAction={handleApiAction}
        />
      );
    },
    [nodeActions, idField, evalCtx, navigate, handleApiAction]
  );

  return (
    <>
      <PageHeader
        pageHeaderActions={pageHeaderActions}
        pageTitle={pageTitle}
        breadcrumbs={breadcrumbs}
        routeParams={routeParams}
      />

      <Card style={{ marginTop: 16, ...cardStyle }}>
        {showSearch && (
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search nodes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 12, maxWidth: 320 }}
            allowClear
          />
        )}

        {isLoading && <Spin />}
        {!isLoading && error && (
          <Alert type="error" message="Failed to load tree data" />
        )}
        {!isLoading && !error && records.length === 0 && (
          <Empty description="No records" />
        )}
        {!isLoading && !error && records.length > 0 && (
          <Tree
            treeData={treeData}
            showLine
            selectable={selectable}
            defaultExpandAll={defaultExpandAll}
            titleRender={titleRender}
            onSelect={(keys) => {
              if (onClickNavigateTo && keys.length > 0) {
                const id = String(keys[0]);
                navigate(substituteId(onClickNavigateTo, id, idField));
              }
            }}
          />
        )}
      </Card>
    </>
  );
};
