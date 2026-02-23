import React, { useState, useMemo, useCallback } from 'react';
import { Typography, Switch, Tag, Input, Button, Alert, Tooltip, Space, Divider, Empty, Select } from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ClearOutlined,
  ExperimentOutlined,
  UserOutlined,
  MobileOutlined,
  FlagOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useEvalContextBridge } from '../store/eval-context-bridge';
import type { NewEvaluationContext } from '../../types/evaluation';
import {
  useContextOverrides,
  setContextOverride,
  removeContextOverride,
  clearContextOverrides,
} from '../store/context-overrides';

const { Text } = Typography;

const VIEWPORT_OPTIONS = ['xs', 'sm', 'md', 'lg', 'xl'];

const OverrideBanner: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      icon={<ExperimentOutlined />}
      message={
        <span>
          <strong>{count} context override{count > 1 ? 's' : ''} active</strong>
          {' — '}
          <Text type="secondary" style={{ fontSize: 12 }}>conditions re-evaluate with overridden values</Text>
        </span>
      }
      action={
        <Button size="small" danger onClick={clearContextOverrides}>
          Clear All
        </Button>
      }
      style={{ marginBottom: 12, borderRadius: 6 }}
    />
  );
};

const GroupEditor: React.FC<{
  groups: string[];
  onGroupsChange: (groups: string[]) => void;
}> = ({ groups, onGroupsChange }) => {
  const [newGroup, setNewGroup] = useState('');

  const addGroup = () => {
    if (newGroup && !groups.includes(newGroup)) {
      onGroupsChange([...groups, newGroup]);
      setNewGroup('');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {groups.map(g => (
          <Tag
            key={g}
            closable
            onClose={() => onGroupsChange(groups.filter(x => x !== g))}
            color="blue"
            style={{ margin: 0 }}
          >
            {g}
          </Tag>
        ))}
        {groups.length === 0 && <Text type="secondary" style={{ fontSize: 11 }}>No groups</Text>}
      </div>
      <Space.Compact size="small" style={{ width: '100%' }}>
        <Input
          placeholder="Add group..."
          value={newGroup}
          onChange={e => setNewGroup(e.target.value)}
          onPressEnter={addGroup}
          style={{ flex: 1 }}
        />
        <Button icon={<PlusOutlined />} onClick={addGroup} disabled={!newGroup} />
      </Space.Compact>
    </div>
  );
};

const CustomOverrideRow: React.FC<{
  path: string;
  value: unknown;
  onRemove: () => void;
}> = ({ path, value, onRemove }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 4,
    background: '#fff7e6',
    border: '1px solid #ffd591',
    marginBottom: 4,
  }}>
    <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>override</Tag>
    <Text code style={{ fontSize: 11 }}>{path}</Text>
    <Text type="secondary" style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      = {typeof value === 'object' ? JSON.stringify(value) : String(value)}
    </Text>
    <Tooltip title="Remove override">
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} style={{ flexShrink: 0 }} />
    </Tooltip>
  </div>
);

export const ContextOverridesPanel: React.FC = () => {
  const evalCtxRaw = useEvalContextBridge();
  // Provide empty fallback so all callers can use optional chaining without checking undefined.
  const evalCtx = evalCtxRaw ?? ({} as Partial<NewEvaluationContext>);
  const overrides = useContextOverrides();
  const overrideCount = Object.keys(overrides).length;

  const [customPath, setCustomPath] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [showRawContext, setShowRawContext] = useState(false);

  const currentGroups = useMemo(() => {
    const overrideGroups = overrides['actor.groups'];
    if (overrideGroups !== undefined) return overrideGroups as string[];
    return evalCtx.actor?.groups || [];
  }, [evalCtx.actor?.groups, overrides]);

  const currentDevice = useMemo(() => {
    return {
      isMobile: overrides['device.isMobile'] !== undefined ? overrides['device.isMobile'] as boolean : evalCtx.device?.isMobile ?? false,
      isTablet: overrides['device.isTablet'] !== undefined ? overrides['device.isTablet'] as boolean : evalCtx.device?.isTablet ?? false,
      isDesktop: overrides['device.isDesktop'] !== undefined ? overrides['device.isDesktop'] as boolean : evalCtx.device?.isDesktop ?? true,
      viewport: (overrides['device.viewport'] !== undefined ? overrides['device.viewport'] : evalCtx.device?.viewport ?? 'xl') as string,
    };
  }, [evalCtx.device, overrides]);

  const featureFlags = useMemo(() => {
    const base = { ...evalCtx.featureFlags };
    for (const [key, val] of Object.entries(overrides)) {
      if (key.startsWith('featureFlags.')) {
        const flagName = key.replace('featureFlags.', '');
        base[flagName] = val as boolean | string;
      }
    }
    return base;
  }, [evalCtx.featureFlags, overrides]);

  const customOverrides = useMemo(() => {
    return Object.entries(overrides).filter(([path]) =>
      !path.startsWith('actor.groups') &&
      !path.startsWith('device.') &&
      !path.startsWith('featureFlags.')
    );
  }, [overrides]);

  const handleDevicePreset = useCallback((preset: 'desktop' | 'tablet' | 'mobile') => {
    const configs: Record<string, { isMobile: boolean; isTablet: boolean; isDesktop: boolean; viewport: string }> = {
      desktop: { isMobile: false, isTablet: false, isDesktop: true, viewport: 'xl' },
      tablet: { isMobile: false, isTablet: true, isDesktop: false, viewport: 'md' },
      mobile: { isMobile: true, isTablet: false, isDesktop: false, viewport: 'xs' },
    };
    const c = configs[preset];
    setContextOverride('device.isMobile', c.isMobile);
    setContextOverride('device.isTablet', c.isTablet);
    setContextOverride('device.isDesktop', c.isDesktop);
    setContextOverride('device.viewport', c.viewport);
  }, []);

  const addCustomOverride = useCallback(() => {
    if (!customPath) return;
    try {
      const parsed = JSON.parse(customValue);
      setContextOverride(customPath, parsed);
    } catch {
      setContextOverride(customPath, customValue);
    }
    setCustomPath('');
    setCustomValue('');
  }, [customPath, customValue]);

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <OverrideBanner count={overrideCount} />

      <div style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', marginBottom: -4 }}>
        Override evaluation context values to test how conditions behave with different data.
        Changes apply instantly to all conditions on the page.
      </div>

      {/* Actor Groups */}
      <div style={{ border: '1px solid var(--ant-color-border-secondary, #f0f0f0)', borderRadius: 6, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <UserOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ fontSize: 13 }}>Actor Groups</Text>
          {overrides['actor.groups'] !== undefined && (
            <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>overridden</Tag>
          )}
          {overrides['actor.groups'] !== undefined && (
            <Button size="small" type="link" danger onClick={() => removeContextOverride('actor.groups')} style={{ marginLeft: 'auto', fontSize: 11, padding: 0 }}>
              Reset
            </Button>
          )}
        </div>
        <GroupEditor
          groups={currentGroups}
          onGroupsChange={(groups) => setContextOverride('actor.groups', groups)}
        />
      </div>

      {/* Device */}
      <div style={{ border: '1px solid var(--ant-color-border-secondary, #f0f0f0)', borderRadius: 6, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <MobileOutlined style={{ color: '#722ed1' }} />
          <Text strong style={{ fontSize: 13 }}>Device</Text>
          {(overrides['device.isMobile'] !== undefined || overrides['device.viewport'] !== undefined) && (
            <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>overridden</Tag>
          )}
          {(overrides['device.isMobile'] !== undefined || overrides['device.viewport'] !== undefined) && (
            <Button size="small" type="link" danger onClick={() => {
              removeContextOverride('device.isMobile');
              removeContextOverride('device.isTablet');
              removeContextOverride('device.isDesktop');
              removeContextOverride('device.viewport');
            }} style={{ marginLeft: 'auto', fontSize: 11, padding: 0 }}>
              Reset
            </Button>
          )}
        </div>
        <Space size={8} wrap>
          <Button
            size="small"
            type={currentDevice.isDesktop ? 'primary' : 'default'}
            onClick={() => handleDevicePreset('desktop')}
          >
            Desktop
          </Button>
          <Button
            size="small"
            type={currentDevice.isTablet ? 'primary' : 'default'}
            onClick={() => handleDevicePreset('tablet')}
          >
            Tablet
          </Button>
          <Button
            size="small"
            type={currentDevice.isMobile ? 'primary' : 'default'}
            onClick={() => handleDevicePreset('mobile')}
          >
            Mobile
          </Button>
          <Select
            size="small"
            value={currentDevice.viewport}
            onChange={val => setContextOverride('device.viewport', val)}
            options={VIEWPORT_OPTIONS.map(v => ({ label: v, value: v }))}
            style={{ width: 80 }}
          />
        </Space>
      </div>

      {/* Feature Flags */}
      <div style={{ border: '1px solid var(--ant-color-border-secondary, #f0f0f0)', borderRadius: 6, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <FlagOutlined style={{ color: '#52c41a' }} />
          <Text strong style={{ fontSize: 13 }}>Feature Flags</Text>
        </div>
        {Object.keys(featureFlags).length === 0 ? (
          <Text type="secondary" style={{ fontSize: 11 }}>No feature flags configured</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(featureFlags).map(([flag, value]) => {
              const isOverridden = overrides[`featureFlags.${flag}`] !== undefined;
              return (
                <div key={flag} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    size="small"
                    checked={value === true || value === 'true'}
                    onChange={checked => setContextOverride(`featureFlags.${flag}`, checked)}
                  />
                  <Text style={{ fontSize: 12 }}>{flag}</Text>
                  {isOverridden && (
                    <>
                      <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>overridden</Tag>
                      <Button
                        size="small" type="text" danger
                        icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                        onClick={() => removeContextOverride(`featureFlags.${flag}`)}
                        style={{ padding: '0 4px' }}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Overrides */}
      <div style={{ border: '1px solid var(--ant-color-border-secondary, #f0f0f0)', borderRadius: 6, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TeamOutlined style={{ color: '#fa8c16' }} />
          <Text strong style={{ fontSize: 13 }}>Custom Overrides</Text>
        </div>
        {customOverrides.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {customOverrides.map(([path, value]) => (
              <CustomOverrideRow
                key={path}
                path={path}
                value={value}
                onRemove={() => removeContextOverride(path)}
              />
            ))}
          </div>
        )}
        <Space.Compact size="small" style={{ width: '100%' }}>
          <Input
            placeholder="Path (e.g. tenant.plan)"
            value={customPath}
            onChange={e => setCustomPath(e.target.value)}
            style={{ flex: 1 }}
          />
          <Input
            placeholder="Value (JSON or string)"
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            onPressEnter={addCustomOverride}
            style={{ flex: 1 }}
          />
          <Button icon={<PlusOutlined />} onClick={addCustomOverride} disabled={!customPath} />
        </Space.Compact>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* Raw context viewer */}
      <div>
        <Button
          size="small"
          type="text"
          onClick={() => setShowRawContext(!showRawContext)}
          style={{ fontSize: 12, padding: '2px 8px', color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' }}
        >
          {showRawContext ? 'Hide' : 'Show'} merged evaluation context
        </Button>
        {showRawContext && (
          <div style={{ marginTop: 8 }}>
            <JsonViewer data={evalCtx as unknown as Record<string, unknown>} maxHeight={400} />
          </div>
        )}
      </div>
    </div>
  );
};
