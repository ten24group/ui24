import React, { useMemo } from 'react';
import { Collapse, Tag, Descriptions, Typography, Empty } from 'antd';
import {
  UserOutlined,
  DesktopOutlined,
  FlagOutlined,
  TeamOutlined,
  FileOutlined,
  FormOutlined,
  TableOutlined,
  FileTextOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useNewEvaluationContext } from '../../context/NewEvaluationContext';
import { useAppStaticContext } from '../../context/AppStaticContext';
import { useDevToolsStore, BridgeEntry, BridgeEntryType } from '../devtoolsBridge';

const { Text } = Typography;

function pickBridgeEntries(store: ReadonlyMap<string, BridgeEntry>, type: BridgeEntryType): BridgeEntry[] {
  return Array.from(store.values()).filter(e => e.type === type);
}

export const ContextPanel: React.FC = () => {
  const appStatic = useAppStaticContext();
  const evalCtx = useNewEvaluationContext();
  const store = useDevToolsStore();

  const pageEntries = useMemo(() => pickBridgeEntries(store, 'page'), [store]);
  const formEntries = useMemo(() => pickBridgeEntries(store, 'form'), [store]);
  const tableEntries = useMemo(() => pickBridgeEntries(store, 'table'), [store]);
  const detailEntries = useMemo(() => pickBridgeEntries(store, 'detail'), [store]);

  const actor = appStatic?.actor;
  const device = appStatic?.device;

  return (
    <div style={{ padding: 12 }}>
      <Collapse
        defaultActiveKey={['actor', 'device']}
        size="small"
        items={[
          {
            key: 'actor',
            label: (
              <span>
                <UserOutlined style={{ marginRight: 6 }} />
                Actor
                {actor?.email && <Tag style={{ marginLeft: 8, fontSize: 11 }}>{actor.email}</Tag>}
              </span>
            ),
            children: actor ? (
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Actor ID">
                  <Text copyable style={{ fontSize: 12 }}>{actor.actorId || '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Username">{actor.username || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{actor.email || '—'}</Descriptions.Item>
                <Descriptions.Item label="Groups">
                  {actor.groups?.length > 0
                    ? actor.groups.map(g => <Tag key={g} color="blue">{g}</Tag>)
                    : <Text type="secondary">none</Text>
                  }
                </Descriptions.Item>
                {actor.permissions && actor.permissions.length > 0 && (
                  <Descriptions.Item label="Permissions">
                    {actor.permissions.map(p => <Tag key={p}>{p}</Tag>)}
                  </Descriptions.Item>
                )}
              </Descriptions>
            ) : <Text type="secondary">Not authenticated</Text>,
          },
          {
            key: 'device',
            label: (
              <span>
                <DesktopOutlined style={{ marginRight: 6 }} />
                Device
                {device && <Tag style={{ marginLeft: 8, fontSize: 11 }}>{device.viewport}</Tag>}
              </span>
            ),
            children: device ? (
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="Viewport"><Tag>{device.viewport}</Tag></Descriptions.Item>
                <Descriptions.Item label="Desktop">{device.isDesktop ? 'Yes' : 'No'}</Descriptions.Item>
                <Descriptions.Item label="Tablet">{device.isTablet ? 'Yes' : 'No'}</Descriptions.Item>
                <Descriptions.Item label="Mobile">{device.isMobile ? 'Yes' : 'No'}</Descriptions.Item>
              </Descriptions>
            ) : <Text type="secondary">—</Text>,
          },
          {
            key: 'flags',
            label: (
              <span>
                <FlagOutlined style={{ marginRight: 6 }} />
                Feature Flags
                <Tag style={{ marginLeft: 8, fontSize: 11 }}>
                  {Object.keys(appStatic?.featureFlags || {}).length}
                </Tag>
              </span>
            ),
            children: appStatic?.featureFlags && Object.keys(appStatic.featureFlags).length > 0 ? (
              <Descriptions size="small" column={1} bordered>
                {Object.entries(appStatic.featureFlags).map(([k, v]) => (
                  <Descriptions.Item key={k} label={k}>
                    {typeof v === 'boolean'
                      ? <Tag color={v ? 'green' : 'default'}>{String(v)}</Tag>
                      : <Tag>{String(v)}</Tag>
                    }
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : <Text type="secondary">No feature flags configured</Text>,
          },
          {
            key: 'tenant',
            label: (
              <span>
                <TeamOutlined style={{ marginRight: 6 }} />
                Tenant
                {appStatic?.tenant?.name && <Tag style={{ marginLeft: 8, fontSize: 11 }}>{appStatic.tenant.name}</Tag>}
              </span>
            ),
            children: appStatic?.tenant ? (
              <JsonViewer data={appStatic.tenant as unknown as Record<string, unknown>} defaultExpanded />
            ) : <Text type="secondary">No tenant configured</Text>,
          },
          {
            key: 'page',
            label: (
              <span>
                <FileOutlined style={{ marginRight: 6 }} />
                Page Static
                <Tag style={{ marginLeft: 8, fontSize: 11 }}>{pageEntries.length} active</Tag>
              </span>
            ),
            children: pageEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pageEntries.map(e => (
                  <div key={e.id}>
                    <Text strong style={{ fontSize: 12 }}>{e.label}</Text>
                    {e.modalDepth != null && e.modalDepth > 0 && (
                      <Tag color="volcano" style={{ marginLeft: 6, fontSize: 10 }}>modal:{e.modalDepth}</Tag>
                    )}
                    <JsonViewer data={e.data as Record<string, unknown>} maxHeight={300} />
                  </div>
                ))}
              </div>
            ) : <Text type="secondary">No page context active</Text>,
          },
          {
            key: 'form',
            label: (
              <span>
                <FormOutlined style={{ marginRight: 6 }} />
                Form State
                <Tag style={{ marginLeft: 8, fontSize: 11 }} color={formEntries.length > 0 ? 'blue' : 'default'}>
                  {formEntries.length}
                </Tag>
              </span>
            ),
            children: formEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {formEntries.map(e => {
                  const d = e.data as Record<string, unknown> | null;
                  return (
                    <div key={e.id}>
                      <div style={{ marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 12 }}>{e.label}</Text>
                        {d?.isDirty && <Tag color="orange" style={{ fontSize: 10 }}>dirty</Tag>}
                        {d?.isValid === false && <Tag color="red" style={{ fontSize: 10 }}>invalid</Tag>}
                      </div>
                      <JsonViewer data={d as Record<string, unknown>} maxHeight={300} />
                    </div>
                  );
                })}
              </div>
            ) : <Empty description="No active forms" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          },
          {
            key: 'table',
            label: (
              <span>
                <TableOutlined style={{ marginRight: 6 }} />
                Table State
                <Tag style={{ marginLeft: 8, fontSize: 11 }} color={tableEntries.length > 0 ? 'green' : 'default'}>
                  {tableEntries.length}
                </Tag>
              </span>
            ),
            children: tableEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tableEntries.map(e => (
                  <div key={e.id}>
                    <Text strong style={{ fontSize: 12 }}>{e.label}</Text>
                    <JsonViewer data={e.data as Record<string, unknown>} maxHeight={300} />
                  </div>
                ))}
              </div>
            ) : <Empty description="No active tables" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          },
          {
            key: 'detail',
            label: (
              <span>
                <FileTextOutlined style={{ marginRight: 6 }} />
                Detail State
                <Tag style={{ marginLeft: 8, fontSize: 11 }} color={detailEntries.length > 0 ? 'purple' : 'default'}>
                  {detailEntries.length}
                </Tag>
              </span>
            ),
            children: detailEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detailEntries.map(e => (
                  <div key={e.id}>
                    <Text strong style={{ fontSize: 12 }}>{e.label}</Text>
                    <JsonViewer data={e.data as Record<string, unknown>} maxHeight={300} />
                  </div>
                ))}
              </div>
            ) : <Empty description="No active detail views" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          },
          {
            key: 'raw',
            label: <span><CodeOutlined style={{ marginRight: 6 }} />Raw Evaluation Context</span>,
            children: <JsonViewer data={evalCtx as unknown as Record<string, unknown>} maxHeight={500} />,
          },
        ]}
      />
    </div>
  );
};
