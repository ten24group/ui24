import React, { useMemo } from 'react';
import { Typography, Descriptions, Collapse, Tag, Empty } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  GlobalOutlined,
  SettingOutlined,
  FileSearchOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useUi24Config } from '../../context/UI24Context';
import { getConditionSystemConfig } from '../../context/conditionSystemConfig';
import { useDevToolsStore, BridgeEntry } from '../store/snapshot';

const { Text } = Typography;

const BoolIcon: React.FC<{ value: boolean }> = ({ value }) =>
  value
    ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 13 }} />
    : <CloseCircleFilled style={{ color: '#d9d9d9', fontSize: 13 }} />;

export const ConfigPanel: React.FC = () => {
  const { config } = useUi24Config();
  const systemConfig = getConditionSystemConfig();
  const store = useDevToolsStore();

  const pageEntry = useMemo((): BridgeEntry | undefined => {
    const entries = Array.from(store.values());
    return entries.find(e => e.type === 'page');
  }, [store]);

  const pageData = pageEntry?.data as Record<string, unknown> | undefined;
  const route = pageData?.route as Record<string, unknown> | undefined;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Collapse
        defaultActiveKey={['app', 'page', 'condition']}
        size="small"
        items={[
          {
            key: 'app',
            label: <span><GlobalOutlined style={{ marginRight: 6 }} />App Config</span>,
            children: (
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="App Name">{config.appName || '—'}</Descriptions.Item>
                <Descriptions.Item label="Base URL">
                  <Text copyable style={{ fontSize: 12 }}>{config.baseURL}</Text>
                </Descriptions.Item>
                {config.appURLPrefix && (
                  <Descriptions.Item label="URL Prefix">{config.appURLPrefix}</Descriptions.Item>
                )}
                <Descriptions.Item label="Environment">
                  {config.environment ? (
                    <Tag color={config.environment.color || '#faad14'}>{config.environment.name}</Tag>
                  ) : (
                    <Text type="secondary">not configured</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Maintenance">
                  {config.maintenance?.enabled
                    ? <Tag color="red">ACTIVE</Tag>
                    : <Text type="secondary">off</Text>
                  }
                </Descriptions.Item>
                <Descriptions.Item label="Format">
                  {config.formatConfig ? (
                    <Text style={{ fontSize: 11 }}>
                      date: {config.formatConfig.date} · tz: {config.formatConfig.timezone || 'default'}
                    </Text>
                  ) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Pages Loaded">
                  {config.pagesConfig
                    ? <Tag>{Object.keys(config.pagesConfig).length} pages</Tag>
                    : <Text type="secondary">not loaded</Text>
                  }
                </Descriptions.Item>
                <Descriptions.Item label="Menu Items">
                  {config.menuItems
                    ? <Tag>{config.menuItems.length} items</Tag>
                    : <Text type="secondary">not loaded</Text>
                  }
                </Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: 'page',
            label: <span><FileSearchOutlined style={{ marginRight: 6 }} />Current Page</span>,
            children: pageData ? (
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Page Type">
                  <Tag color="blue">{String(pageData.pageType || '—')}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Entity">
                  {pageData.entityName ? <Tag>{String(pageData.entityName)}</Tag> : <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="Path">
                  <Text copyable style={{ fontSize: 12 }}>
                    {route?.pathname ? String(route.pathname) : window.location.pathname}
                  </Text>
                </Descriptions.Item>
                {route?.routeParams && Object.keys(route.routeParams as object).length > 0 && (
                  <Descriptions.Item label="Route Params">
                    {Object.entries(route.routeParams as Record<string, string>).map(([k, v]) => (
                      <Tag key={k} style={{ fontSize: 11 }}>{k}: {v}</Tag>
                    ))}
                  </Descriptions.Item>
                )}
                {route?.queryParams && Object.keys(route.queryParams as object).length > 0 && (
                  <Descriptions.Item label="Query Params">
                    {Object.entries(route.queryParams as Record<string, string>).map(([k, v]) => (
                      <Tag key={k} style={{ fontSize: 11 }}>{k}: {v}</Tag>
                    ))}
                  </Descriptions.Item>
                )}
                {pageData.modal && (pageData.modal as Record<string, unknown>).isInModal && (
                  <Descriptions.Item label="Modal">
                    <Tag color="volcano">depth: {String((pageData.modal as Record<string, unknown>).depth)}</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            ) : (
              <Empty description="No page context active" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          },
          {
            key: 'condition',
            label: <span><BranchesOutlined style={{ marginRight: 6 }} />Condition System</span>,
            children: (
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Feature Flags">
                  <BoolIcon value={!!systemConfig.featureFlagProvider} />
                </Descriptions.Item>
                <Descriptions.Item label="Tenant Provider">
                  <BoolIcon value={!!systemConfig.tenantProvider} />
                </Descriptions.Item>
                <Descriptions.Item label="Responsive Device">
                  <BoolIcon value={!!systemConfig.responsiveDevice} />
                </Descriptions.Item>
                <Descriptions.Item label="i18n Provider">
                  <BoolIcon value={!!systemConfig.i18nProvider} />
                </Descriptions.Item>
                <Descriptions.Item label="Context Providers">
                  {systemConfig.contextProviders
                    ? Object.keys(systemConfig.contextProviders).map(k => <Tag key={k}>{k}</Tag>)
                    : <Text type="secondary">none</Text>
                  }
                </Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: 'raw',
            label: <span><SettingOutlined style={{ marginRight: 6 }} />Raw Page Config</span>,
            children: pageData?.config ? (
              <JsonViewer data={pageData.config as Record<string, unknown>} maxHeight={400} />
            ) : (
              <Empty description="No page config available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          },
        ]}
      />
    </div>
  );
};
