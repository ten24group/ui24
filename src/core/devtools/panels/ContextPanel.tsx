import React, { useMemo } from 'react';
import { Collapse, Tag, Descriptions, Typography, Empty, Alert, Button, type CollapseProps } from 'antd';
import {
  UserOutlined,
  DesktopOutlined,
  FlagOutlined,
  TeamOutlined,
  CodeOutlined,
  ExperimentOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useEvalContextBridge } from '../store/eval-context-bridge';
import { useContextOverrides } from '../store/context-overrides';
import { paddedContent, mono12, textSecondary, tagSmall, colors } from '../utils/devtoolsStyles';

const { Text } = Typography;

/** Pill shown next to a value when it's been overridden via the Overrides panel */
const OverrideTag: React.FC = () => (
  <Tag color="orange" style={{ margin: '0 0 0 4px', fontSize: 9, lineHeight: '14px', padding: '0 4px', verticalAlign: 'middle' }}>
    override
  </Tag>
);

/**
 * ContextPanel — shows the evaluation context, NOT the live bridge state.
 *
 * Displays: Actor, Device, Feature Flags, Tenant, Page context, and the raw
 * evaluation context object. This is the "what conditions see" panel.
 *
 * Values that are being overridden via the Overrides panel are marked with an
 * orange "override" tag so developers can tell what's real vs. mocked.
 *
 * Live bridge state (page configs, form values, table data) is shown in
 * the LiveStatePanel. We intentionally do NOT duplicate that data here.
 */
export const ContextPanel: React.FC<{ onSwitchToOverrides?: () => void }> = ({ onSwitchToOverrides }) => {
  // Read from the eval context bridge — this store is published by page components
  // from inside the page tree. DevTools renders outside that tree, so direct context
  // hooks would return null/undefined for all page-level values.
  const evalCtx = useEvalContextBridge();
  const overrides = useContextOverrides();
  const overrideCount = Object.keys(overrides).length;

  const actor = evalCtx?.actor;
  const device = evalCtx?.device;
  const featureFlags = evalCtx?.featureFlags;
  const tenant = evalCtx?.tenant;

  const actorGroups = useMemo(() => {
    if (!actor) return [];
    const groups = (actor as Record<string, unknown>).groups;
    if (Array.isArray(groups)) return groups;
    return [];
  }, [actor]);

  const flagEntries = useMemo(() => {
    if (!featureFlags || typeof featureFlags !== 'object') return [];
    return Object.entries(featureFlags as Record<string, unknown>);
  }, [featureFlags]);

  const pageContext = useMemo(() => ({
    pageType: evalCtx?.pageType,
    entityName: evalCtx?.entityName,
    route: evalCtx?.route,
    modalDepth: evalCtx?.modalDepth,
    modal: evalCtx?.modal,
  }), [evalCtx?.pageType, evalCtx?.entityName, evalCtx?.route, evalCtx?.modalDepth, evalCtx?.modal]);

  const hasPageContext = Object.values(pageContext).some(v => v != null);

  const hasData = actor || device || featureFlags || tenant;

  // Determine which device fields are overridden
  const deviceOverrideKeys = useMemo(() => new Set(
    Object.keys(overrides).filter(k => k.startsWith('device.')).map(k => k.replace('device.', ''))
  ), [overrides]);

  const actorGroupsOverridden = overrides['actor.groups'] !== undefined;

  const items: CollapseProps['items'] = [
    // ── Actor ──
    actor && {
      key: 'actor',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserOutlined /> Actor
          {actorGroups.length > 0 && (
            <Tag style={tagSmall}>{actorGroups.length} group{actorGroups.length > 1 ? 's' : ''}</Tag>
          )}
          {actorGroupsOverridden && <Tag color="orange" style={{ ...tagSmall, margin: 0 }}>overridden</Tag>}
        </span>
      ),
      children: (
        <div>
          <Descriptions size="small" column={2}>
            {Object.entries(actor as Record<string, unknown>)
              .filter(([k, v]) => k !== 'groups' && v !== undefined && v !== null)
              .map(([key, value]) => {
                const isOverridden = overrides[`actor.${key}`] !== undefined;
                return (
                  <Descriptions.Item key={key} label={<span>{key}{isOverridden && <OverrideTag />}</span>}>
                    {typeof value === 'object' && value !== null
                      ? <Text code style={mono12}>{JSON.stringify(value)}</Text>
                      : <Text style={{ fontSize: 12, color: isOverridden ? colors.orange : undefined }}>{String(value)}</Text>}
                  </Descriptions.Item>
                );
              })}
          </Descriptions>
          {actorGroups.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 600 }}>
                Groups:{actorGroupsOverridden && <OverrideTag />}
              </Text>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {actorGroups.map((g, i) => (
                  <Tag key={i} color={actorGroupsOverridden ? 'orange' : 'blue'} style={tagSmall}>{String(g)}</Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },

    // ── Page Context ──
    {
      key: 'page',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CodeOutlined /> Page Context
          {pageContext.pageType
            ? <Tag style={tagSmall}>{String(pageContext.pageType)}</Tag>
            : <Tag color="default" style={tagSmall}>none</Tag>}
          {pageContext.entityName && (
            <Tag style={{ ...tagSmall, fontFamily: 'monospace' }}>{String(pageContext.entityName)}</Tag>
          )}
        </span>
      ),
      children: hasPageContext ? (
        <Descriptions size="small" column={2}>
          {Object.entries(pageContext)
            .filter(([, v]) => v != null)
            .map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                <Text style={mono12}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Text>
              </Descriptions.Item>
            ))}
        </Descriptions>
      ) : (
        <div style={{ padding: '4px 0' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            No active page context. Navigate to a form, detail, or list page to see page values here.
          </Text>
          <div style={{ marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
              Available keys: <Text code style={{ fontSize: 10 }}>pageType</Text>, <Text code style={{ fontSize: 10 }}>entityName</Text>, <Text code style={{ fontSize: 10 }}>route</Text>, <Text code style={{ fontSize: 10 }}>modal</Text>
            </Text>
          </div>
        </div>
      ),
    },

    // ── Device ──
    device && {
      key: 'device',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DesktopOutlined /> Device
          {deviceOverrideKeys.size > 0 && <Tag color="orange" style={{ ...tagSmall, margin: 0 }}>overridden</Tag>}
        </span>
      ),
      children: (
        <Descriptions size="small" column={2}>
          {Object.entries(device as Record<string, unknown>).map(([key, value]) => {
            const isOverridden = deviceOverrideKeys.has(key);
            return (
              <Descriptions.Item key={key} label={<span>{key}{isOverridden && <OverrideTag />}</span>}>
                {typeof value === 'boolean'
                  ? <Tag color={isOverridden ? 'orange' : (value ? 'green' : 'default')} style={tagSmall}>{String(value)}</Tag>
                  : <Text style={{ fontSize: 12, color: isOverridden ? colors.orange : undefined }}>{String(value)}</Text>}
              </Descriptions.Item>
            );
          })}
        </Descriptions>
      ),
    },

    // ── Feature Flags ──
    flagEntries.length > 0 && {
      key: 'flags',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FlagOutlined /> Feature Flags
          <Tag style={tagSmall}>{flagEntries.length}</Tag>
        </span>
      ),
      children: (
        <Descriptions size="small" column={2} bordered>
          {flagEntries.map(([key, value]) => {
            const isOverridden = overrides[`featureFlags.${key}`] !== undefined;
            return (
              <Descriptions.Item key={key} label={<span><Text style={mono12}>{key}</Text>{isOverridden && <OverrideTag />}</span>}>
                {typeof value === 'boolean'
                  ? <Tag color={isOverridden ? 'orange' : (value ? 'green' : 'red')} style={tagSmall}>{String(value)}</Tag>
                  : <Text code style={mono12}>{JSON.stringify(value)}</Text>}
              </Descriptions.Item>
            );
          })}
        </Descriptions>
      ),
    },

    // ── Tenant ──
    tenant && {
      key: 'tenant',
      label: <span><TeamOutlined style={{ marginRight: 6 }} /> Tenant</span>,
      children: <JsonViewer data={tenant as Record<string, unknown>} maxHeight={300} />,
    },

    // ── Raw Evaluation Context ──
    {
      key: 'raw',
      label: <span><CodeOutlined style={{ marginRight: 6 }} /> Raw Evaluation Context</span>,
      children: <JsonViewer data={evalCtx as Record<string, unknown>} maxHeight={400} />,
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!hasData && !evalCtx) {
    return (
      <div style={{ padding: 12 }}>
        <Empty description="No evaluation context available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div style={paddedContent}>
      <Text style={textSecondary}>
        Evaluation context values — this is what conditions see when evaluating visibility, enablement, etc.
      </Text>

      {/* Active overrides banner */}
      {overrideCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<ExperimentOutlined />}
          message={
            <span>
              <strong>{overrideCount} override{overrideCount > 1 ? 's' : ''} active</strong>
              {' — '}
              <Text type="secondary" style={{ fontSize: 12 }}>
                values marked <Tag color="orange" style={{ margin: '0 2px', fontSize: 9, padding: '0 4px' }}>override</Tag> are mocked
              </Text>
            </span>
          }
          action={onSwitchToOverrides && (
            <Button size="small" icon={<RightOutlined />} onClick={onSwitchToOverrides}>
              Edit
            </Button>
          )}
          style={{ borderRadius: 6 }}
        />
      )}

      <Collapse
        defaultActiveKey={['actor', 'page']}
        size="small"
        items={items}
      />
    </div>
  );
};
