import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Typography, Button, Input, Slider, Space, Divider, Tag, message, Tooltip, Collapse, theme } from 'antd';
import {
  CopyOutlined,
  UndoOutlined,
  BgColorsOutlined,
  RadiusSettingOutlined,
} from '@ant-design/icons';
import { useUi24Config } from '../../context/UI24Context';

const { Text } = Typography;

interface TokenDef {
  key: string;
  label: string;
  type: 'color' | 'number';
  group: 'Brand Colors' | 'Neutral Colors' | 'Sizing & Radius' | 'Typography';
  min?: number;
  max?: number;
}

const EDITABLE_TOKENS: TokenDef[] = [
  { key: 'colorPrimary', label: 'Primary', type: 'color', group: 'Brand Colors' },
  { key: 'colorSuccess', label: 'Success', type: 'color', group: 'Brand Colors' },
  { key: 'colorWarning', label: 'Warning', type: 'color', group: 'Brand Colors' },
  { key: 'colorError', label: 'Error', type: 'color', group: 'Brand Colors' },
  { key: 'colorInfo', label: 'Info', type: 'color', group: 'Brand Colors' },
  { key: 'colorBgContainer', label: 'Container BG', type: 'color', group: 'Neutral Colors' },
  { key: 'colorBgLayout', label: 'Layout BG', type: 'color', group: 'Neutral Colors' },
  { key: 'colorText', label: 'Text', type: 'color', group: 'Neutral Colors' },
  { key: 'colorBorder', label: 'Border', type: 'color', group: 'Neutral Colors' },
  { key: 'borderRadius', label: 'Border Radius', type: 'number', group: 'Sizing & Radius', min: 0, max: 24 },
  { key: 'controlHeight', label: 'Control Height', type: 'number', group: 'Sizing & Radius', min: 24, max: 60 },
  { key: 'fontSize', label: 'Font Size', type: 'number', group: 'Typography', min: 10, max: 24 },
];

const PRESETS: Record<string, { label: string; token: Record<string, unknown> }> = {
  compact: { label: 'Compact', token: { fontSize: 12, controlHeight: 28, borderRadius: 4 } },
  cozy: { label: 'Cozy', token: { fontSize: 16, controlHeight: 40, borderRadius: 8 } },
  rounded: { label: 'Rounded', token: { borderRadius: 16 } },
  sharp: { label: 'Sharp', token: { borderRadius: 0 } },
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  'Brand Colors': <BgColorsOutlined />,
  'Neutral Colors': <BgColorsOutlined />,
  'Sizing & Radius': <RadiusSettingOutlined />,
  'Typography': <RadiusSettingOutlined />,
};

const STORAGE_KEY = 'ui24:devtools:theme-overrides';

function loadPersistedOverrides(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const ThemePlaygroundPanel: React.FC = () => {
  const { config, updateConfig } = useUi24Config();
  const { token: runtimeToken } = theme.useToken();

  const [ overrides, setOverrides ] = useState<Record<string, unknown>>(loadPersistedOverrides);
  const [ originalTheme ] = useState(() => config.themeConfig);

  const modifiedCount = Object.keys(overrides).length;

  // Restore persisted overrides on mount
  useEffect(() => {
    const persisted = loadPersistedOverrides();
    if (Object.keys(persisted).length > 0) {
      const currentTheme = (config.themeConfig || {}) as Record<string, unknown>;
      const currentToken = (currentTheme.token || {}) as Record<string, unknown>;
      updateConfig({ themeConfig: { ...currentTheme, token: { ...currentToken, ...persisted } } as any });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyOverrides = useCallback((next: Record<string, unknown>) => {
    setOverrides(next);
    try {
      if (Object.keys(next).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage may be unavailable
    }
    const currentTheme = (config.themeConfig || {}) as Record<string, unknown>;
    const currentToken = (currentTheme.token || {}) as Record<string, unknown>;
    updateConfig({ themeConfig: { ...currentTheme, token: { ...currentToken, ...next } } as any });
  }, [ config.themeConfig, updateConfig ]);

  const handleTokenChange = useCallback((key: string, value: unknown) => {
    applyOverrides({ ...overrides, [ key ]: value });
  }, [ overrides, applyOverrides ]);

  const handlePreset = useCallback((presetKey: string) => {
    const preset = PRESETS[ presetKey ];
    applyOverrides({ ...overrides, ...preset.token });
    message.success(`Applied "${preset.label}" preset`);
  }, [ overrides, applyOverrides ]);

  const handleReset = useCallback(() => {
    updateConfig({ themeConfig: originalTheme });
    setOverrides({});
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    message.success('Theme reset to original');
  }, [ originalTheme, updateConfig ]);

  const handleCopy = useCallback(async () => {
    if (modifiedCount === 0) {
      message.info('No overrides to export');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify({ token: overrides }, null, 2));
      message.success('Theme overrides copied');
    } catch {
      message.error('Failed to copy');
    }
  }, [ overrides, modifiedCount ]);

  const groups = useMemo(() => {
    const map: Record<string, TokenDef[]> = {};
    for (const t of EDITABLE_TOKENS) {
      if (!map[ t.group ]) map[ t.group ] = [];
      map[ t.group ].push(t);
    }
    return map;
  }, []);

  const getRuntimeValue = useCallback((key: string): unknown => {
    return runtimeToken[ key ];
  }, [ runtimeToken ]);

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' }}>
        Edit design tokens live — changes apply instantly and persist across reloads. Use Export to copy overrides into your app config.
      </div>

      {/* Presets */}
      <div>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Quick Presets</Text>
        <Space size={6} wrap>
          {Object.entries(PRESETS).map(([ key, p ]) => (
            <Button key={key} size="small" onClick={() => handlePreset(key)}>
              {p.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {modifiedCount > 0 && <Tag color="orange">{modifiedCount} modified</Tag>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} disabled={modifiedCount === 0}>
            Export Overrides
          </Button>
          <Button size="small" icon={<UndoOutlined />} onClick={handleReset} disabled={modifiedCount === 0}>
            Reset All
          </Button>
        </div>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* Token editors by group */}
      <Collapse
        defaultActiveKey={[ 'Brand Colors', 'Sizing & Radius' ]}
        size="small"
        items={Object.entries(groups).map(([ group, tokens ]) => ({
          key: group,
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {GROUP_ICONS[ group ]}
              <span>{group}</span>
              <Tag style={{ margin: 0, fontSize: 10 }}>{tokens.length}</Tag>
            </span>
          ),
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tokens.map(tokenDef => {
                const runtimeVal = getRuntimeValue(tokenDef.key);
                const overrideVal = overrides[ tokenDef.key ];
                const displayVal = overrideVal ?? runtimeVal;
                const isModified = overrideVal !== undefined;

                return (
                  <div key={tokenDef.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '4px 8px', borderRadius: 4,
                    background: isModified ? '#fffbe6' : 'transparent',
                  }}>
                    <Text style={{ fontSize: 12, width: 120, flexShrink: 0 }}>
                      {tokenDef.label}
                      {isModified && <span style={{ color: '#fa8c16' }}> *</span>}
                    </Text>

                    {tokenDef.type === 'color' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <input
                          type="color"
                          value={String(displayVal || '#000000').replace(/[^#0-9a-fA-F]/g, '') || '#000000'}
                          onChange={e => handleTokenChange(tokenDef.key, e.target.value)}
                          style={{ width: 32, height: 24, border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer', padding: 1 }}
                        />
                        <Text code style={{ fontSize: 11 }}>{String(displayVal)}</Text>
                        {isModified && (
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            was: {String(runtimeVal)}
                          </Text>
                        )}
                      </div>
                    )}

                    {tokenDef.type === 'number' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Slider
                          min={tokenDef.min ?? 0}
                          max={tokenDef.max ?? 40}
                          value={Number(displayVal) || 0}
                          onChange={v => handleTokenChange(tokenDef.key, v)}
                          style={{ flex: 1 }}
                        />
                        <Text code style={{ fontSize: 11, width: 32, textAlign: 'right', flexShrink: 0 }}>
                          {String(displayVal)}
                        </Text>
                      </div>
                    )}

                    {isModified && (
                      <Tooltip title="Reset to original">
                        <Button
                          size="small" type="text" danger
                          icon={<UndoOutlined style={{ fontSize: 10 }} />}
                          onClick={() => {
                            const next = { ...overrides };
                            delete next[ tokenDef.key ];
                            applyOverrides(next);
                          }}
                          style={{ padding: '0 4px', flexShrink: 0 }}
                        />
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          ),
        }))}
      />
    </div>
  );
};
