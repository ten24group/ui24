import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge, Drawer, Tabs, Tag } from 'antd';
import {
  BugOutlined,
  DashboardOutlined,
  SettingOutlined,
  NodeIndexOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  ExperimentOutlined,
  ApiOutlined,
  BarChartOutlined,
  DiffOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';

// Panels — State group
import { LiveStatePanel } from './panels/LiveStatePanel';
import { FieldInspectorPanel } from './panels/FieldInspectorPanel';
import { MutationPanel } from './panels/MutationPanel';

// Panels — Context group (view + overrides in one place)
import { ContextPanel } from './panels/ContextPanel';
import { ContextOverridesPanel } from './panels/ContextOverridesPanel';

// Panels — Config group
import { ConfigPanel } from './panels/ConfigPanel';
import { ConfigInspectorPanel } from './panels/ConfigInspectorPanel';
import { ConfigWarningsPanel, useConfigWarningCount } from './panels/ConfigWarningsPanel';
import { ConfigDiffPanel } from './panels/ConfigDiffPanel';

// Panels — Debug group
import { TraceViewerPanel } from './panels/TraceViewerPanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { PerformancePanel } from './panels/PerformancePanel';
import { ErrorPanel, useErrorCount } from './panels/ErrorPanel';

// Panels — Tools group
import { RegistryPanel } from './panels/RegistryPanel';
import { ExtensionRegistryPanel } from './panels/ExtensionRegistryPanel';
import { ThemePlaygroundPanel } from './panels/ThemePlaygroundPanel';
import { ConditionPlaygroundPanel } from './panels/ConditionPlaygroundPanel';

// DevTools components
import { QuickActions } from './QuickActions';
import { SearchEverywhere } from './SearchEverywhere';

// App context
import { useUi24Config } from '../context/UI24Context';
import { useDevToolsStore } from './store/snapshot';
import { useContextOverrides } from './store/context-overrides';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { IS_DEV } from '../constants';

// Cross-panel navigation
import { useDevtoolsNavigation, setHighlightedSpanId, setHighlightedNetworkId } from './store/devtools-navigation';

// ── Persistent tab helper ──────────────────────────────────────

function usePersistentTab(key: string, defaultTab: string): [ string, (tab: string) => void ] {
  const [ tab, setTabState ] = useState<string>(() => {
    try { return sessionStorage.getItem(`ui24_dt_tab_${key}`) || defaultTab; } catch { return defaultTab; }
  });
  const setTab = useCallback((t: string) => {
    setTabState(t);
    try { sessionStorage.setItem(`ui24_dt_tab_${key}`, t); } catch { }
  }, [ key ]);
  return [ tab, setTab ];
}

// ── Sub-tab wrappers ───────────────────────────────────────────

const StateGroup: React.FC = () => {
  const [ view, setView ] = usePersistentTab('state', 'bridge');
  return (
    <PanelErrorBoundary panelName="State">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 12px 0', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', background: 'var(--ant-color-bg-layout, #fafafa)' }}>
          <Tabs
            size="small"
            activeKey={view}
            onChange={setView}
            items={[
              { key: 'bridge', label: 'Live State' },
              { key: 'fields', label: 'Fields' },
              { key: 'mutations', label: <span><EditOutlined /> Mutations</span> },
            ]}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {view === 'bridge' && <LiveStatePanel />}
          {view === 'fields' && <FieldInspectorPanel />}
          {view === 'mutations' && <MutationPanel />}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};

const ContextGroup: React.FC = () => {
  const [ view, setView ] = usePersistentTab('context', 'view');
  const overrides = useContextOverrides();
  const overrideCount = Object.keys(overrides).length;

  return (
    <PanelErrorBoundary panelName="Context">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 12px 0', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', background: 'var(--ant-color-bg-layout, #fafafa)' }}>
          <Tabs
            size="small"
            activeKey={view}
            onChange={setView}
            items={[
              { key: 'view', label: 'View' },
              {
                key: 'overrides',
                label: (
                  <Badge count={overrideCount} size="small" offset={[ 8, -2 ]} color="#fa8c16">
                    <span>Overrides</span>
                  </Badge>
                ),
              },
            ]}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {view === 'view' && <ContextPanel onSwitchToOverrides={() => setView('overrides')} />}
          {view === 'overrides' && <ContextOverridesPanel />}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};

const ConfigGroup: React.FC = () => {
  const [ view, setView ] = usePersistentTab('config', 'overview');
  const warningCount = useConfigWarningCount();
  return (
    <PanelErrorBoundary panelName="Config">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 12px 0', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', background: 'var(--ant-color-bg-layout, #fafafa)' }}>
          <Tabs
            size="small"
            activeKey={view}
            onChange={setView}
            items={[
              { key: 'overview', label: 'Overview' },
              {
                key: 'diff',
                label: <span><DiffOutlined /> Diff</span>,
              },
              {
                key: 'warnings',
                label: (
                  <Badge count={warningCount} size="small" offset={[ 8, -2 ]}>
                    <span>Warnings</span>
                  </Badge>
                ),
              },
              { key: 'inspector', label: 'Inspector' },
            ]}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {view === 'overview' && <ConfigPanel />}
          {view === 'diff' && <ConfigDiffPanel />}
          {view === 'warnings' && <ConfigWarningsPanel />}
          {view === 'inspector' && <ConfigInspectorPanel />}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};

const DebugGroup: React.FC<{ highlightSpanId?: string; highlightNetworkId?: string }> = ({
  highlightSpanId,
  highlightNetworkId,
}) => {
  const [ view, setView ] = usePersistentTab('debug', 'traces');
  const { errors } = useErrorCount();

  return (
    <PanelErrorBoundary panelName="Debug">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 12px 0', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', background: 'var(--ant-color-bg-layout, #fafafa)' }}>
          <Tabs
            size="small"
            activeKey={view}
            onChange={setView}
            items={[
              { key: 'traces', label: <span><ThunderboltOutlined /> Traces</span> },
              { key: 'network', label: <span><ApiOutlined /> Network</span> },
              { key: 'perf', label: <span><BarChartOutlined /> Perf</span> },
              {
                key: 'errors',
                label: (
                  <Badge count={errors} size="small" offset={[ 8, -2 ]} color="#f5222d">
                    <span><CloseCircleOutlined /> Errors</span>
                  </Badge>
                ),
              },
            ]}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {view === 'traces' && <TraceViewerPanel highlightSpanId={highlightSpanId} />}
          {view === 'network' && <NetworkPanel highlightNetworkId={highlightNetworkId} />}
          {view === 'perf' && <PerformancePanel />}
          {view === 'errors' && <ErrorPanel />}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};

const ToolsGroup: React.FC = () => {
  const [ view, setView ] = usePersistentTab('tools', 'conditions');
  return (
    <PanelErrorBoundary panelName="Tools">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 12px 0', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', background: 'var(--ant-color-bg-layout, #fafafa)' }}>
          <Tabs
            size="small"
            activeKey={view}
            onChange={setView}
            items={[
              { key: 'conditions', label: 'Conditions' },
              { key: 'playground', label: <span><PlayCircleOutlined /> Playground</span> },
              { key: 'extensions', label: 'Extensions' },
              { key: 'theme', label: 'Theme' },
            ]}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {view === 'conditions' && <RegistryPanel onOpenPlayground={() => setView('playground')} />}
          {view === 'playground' && <ConditionPlaygroundPanel />}
          {view === 'extensions' && <ExtensionRegistryPanel />}
          {view === 'theme' && <ThemePlaygroundPanel />}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};

// ── Floating trigger styles ────────────────────────────────────

const triggerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 9999,
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: '#1677ff',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  fontSize: 18,
  border: 'none',
  padding: 0,
  transition: 'transform 0.2s, box-shadow 0.2s',
};

const badgeDotBase: React.CSSProperties = {
  position: 'absolute',
  width: 16,
  height: 16,
  borderRadius: '50%',
  fontSize: 9,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  border: '2px solid #fff',
  color: '#fff',
};

/**
 * Config DevTools overlay.
 * Toggled with Ctrl+Shift+D. Only renders in development mode.
 *
 * Top-level tabs: State | Context | Config | Debug | Tools
 */
export const ConfigDevTools: React.FC = React.memo(() => {
  const [ open, setOpen ] = useState(false);
  const [ activeTab, setActiveTab ] = usePersistentTab('main', 'state');
  const [ activeDebugSubTab, setActiveDebugSubTab ] = useState<string | undefined>();
  const [ highlightSpanId, setHighlightSpanIdLocal ] = useState<string | undefined>();
  const [ highlightNetworkId, setHighlightNetworkIdLocal ] = useState<string | undefined>();
  const [ drawerWidth, setDrawerWidth ] = useState<number>(() => {
    try { return parseInt(sessionStorage.getItem('ui24_dt_width') || '900', 10) || 900; } catch { return 900; }
  });

  const { config } = useUi24Config();
  const store = useDevToolsStore();
  const warningCount = useConfigWarningCount();
  const { errors: errorCount } = useErrorCount();

  const overrides = useContextOverrides();
  const ctxOverrideCount = Object.keys(overrides).length;
  const activeCount = store.size;

  // Cross-panel navigation — fired by panels requesting navigation
  const navRequest = useDevtoolsNavigation();
  useEffect(() => {
    if (!navRequest) return;
    setOpen(true);
    setActiveTab(navRequest.tab);
    if (navRequest.spanId) {
      setHighlightSpanIdLocal(navRequest.spanId);
      setHighlightedSpanId(navRequest.spanId);
    }
    if (navRequest.networkId) {
      setHighlightNetworkIdLocal(navRequest.networkId);
      setHighlightedNetworkId(navRequest.networkId);
    }
    if (navRequest.subTab) setActiveDebugSubTab(navRequest.subTab);
  }, [ navRequest, setActiveTab ]);

  // Resize handle
  const isResizing = useRef(false);
  const lastX = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    lastX.current = e.clientX;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = lastX.current - ev.clientX;
      setDrawerWidth(prev => {
        const next = Math.max(520, Math.min(1600, prev + delta));
        try { sessionStorage.setItem('ui24_dt_width', String(next)); } catch { }
        return next;
      });
      lastX.current = ev.clientX;
    };
    const onUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ handleKeyDown ]);

  const handleSearchNavigate = useCallback((tabKey: string) => {
    const tabMap: Record<string, string> = {
      live: 'state', fields: 'state', mutations: 'state',
      context: 'context', overrides: 'context',
      config: 'config', inspector: 'config', warnings: 'config', diff: 'config',
      traces: 'debug', network: 'debug', perf: 'debug', errors: 'debug',
      conditions: 'tools', playground: 'tools', extensions: 'tools', theme: 'tools',
    };
    setActiveTab(tabMap[ tabKey ] || tabKey);
  }, [ setActiveTab ]);

  const tabs = useMemo(() => [
    {
      key: 'state',
      label: (
        <span>
          <DashboardOutlined /> State
          {activeCount > 0 && (
            <span style={{ marginLeft: 4, fontSize: 10, color: '#52c41a', fontWeight: 600 }}>({activeCount})</span>
          )}
        </span>
      ),
      children: <StateGroup />,
    },
    {
      key: 'context',
      label: (
        <span>
          <NodeIndexOutlined /> Context
          {ctxOverrideCount > 0 && (
            <span style={{ marginLeft: 4, fontSize: 10, color: '#fa8c16', fontWeight: 600 }}>({ctxOverrideCount})</span>
          )}
        </span>
      ),
      children: <ContextGroup />,
    },
    {
      key: 'config',
      label: (
        <Badge count={warningCount} size="small" offset={[ 8, -2 ]} color={warningCount > 0 ? '#faad14' : undefined}>
          <span><SettingOutlined /> Config</span>
        </Badge>
      ),
      children: <ConfigGroup />,
    },
    {
      key: 'debug',
      label: (
        <Badge count={errorCount} size="small" offset={[ 8, -2 ]} color="#f5222d">
          <span><ThunderboltOutlined /> Debug</span>
        </Badge>
      ),
      children: (
        <DebugGroup
          highlightSpanId={highlightSpanId}
          highlightNetworkId={highlightNetworkId}
        />
      ),
    },
    {
      key: 'tools',
      label: <span><AppstoreOutlined /> Tools</span>,
      children: <ToolsGroup />,
    },
  ], [ warningCount, activeCount, ctxOverrideCount, errorCount, highlightSpanId, highlightNetworkId ]);

  if (!IS_DEV) return null;

  const envConfig = config.environment;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={triggerStyle}
        className="ui24-devtools-trigger"
        title="Config DevTools (Ctrl+Shift+D)"
      >
        <BugOutlined />
        {activeCount > 0 && (
          <span style={{ ...badgeDotBase, top: -2, right: -2, background: '#52c41a' }}>
            {activeCount > 9 ? '9+' : activeCount}
          </span>
        )}
        {warningCount > 0 && (
          <span style={{ ...badgeDotBase, top: -2, left: -2, background: '#faad14' }}>
            {warningCount > 9 ? '!' : warningCount}
          </span>
        )}
        {ctxOverrideCount > 0 && (
          <span style={{ ...badgeDotBase, bottom: -2, right: -2, background: '#fa8c16' }}>
            !
          </span>
        )}
        {errorCount > 0 && (
          <span style={{ ...badgeDotBase, bottom: -2, left: -2, background: '#f5222d' }}>
            {errorCount > 9 ? '9+' : errorCount}
          </span>
        )}
      </button>

      {/* Override banner */}
      {ctxOverrideCount > 0 && !open && (
        <div style={{
          position: 'fixed',
          bottom: 64,
          right: 16,
          zIndex: 9998,
          background: '#fff7e6',
          border: '1px solid #ffd591',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          color: '#d46b08',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <ExperimentOutlined />
          {ctxOverrideCount} override{ctxOverrideCount > 1 ? 's' : ''} active
        </div>
      )}

      {/* DevTools drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BugOutlined style={{ color: '#1677ff', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>DevTools</span>
            {envConfig && (
              <Tag color={envConfig.color || '#faad14'} style={{ fontSize: 11, lineHeight: '16px', padding: '0 6px' }}>
                {envConfig.name}
              </Tag>
            )}
          </div>
        }
        placement="right"
        width={drawerWidth}
        open={open}
        onClose={() => setOpen(false)}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column' },
          footer: { padding: '6px 16px', borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)' },
          header: { padding: '12px 16px', minHeight: 'auto' },
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' }}>
            <span>
              ui24 DevTools
              <span style={{ margin: '0 6px', color: '#d9d9d9' }}>|</span>
              <span>{activeCount} active</span>
              {ctxOverrideCount > 0 && (
                <>
                  <span style={{ margin: '0 6px', color: '#d9d9d9' }}>|</span>
                  <span style={{ color: '#fa8c16' }}>{ctxOverrideCount} overrides</span>
                </>
              )}
            </span>
            <span>
              {config.baseURL}
              {envConfig && <> · {envConfig.name}</>}
            </span>
          </div>
        }
      >
        {/* Drag-to-resize handle on the left edge */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            cursor: 'ew-resize',
            zIndex: 10,
            background: 'transparent',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1677ff40'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          title="Drag to resize"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SearchEverywhere onNavigate={handleSearchNavigate} />
          <QuickActions />
        </div>
        <Tabs
          items={tabs}
          activeKey={activeTab}
          onChange={setActiveTab}
          tabPosition="top"
          size="small"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          tabBarStyle={{
            paddingLeft: 12,
            marginBottom: 0,
            background: 'var(--ant-color-bg-container, #fff)',
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        />
      </Drawer>

      <style>{`
        .ui24-devtools-trigger:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
        }
      `}</style>
    </>
  );
});
