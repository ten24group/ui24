import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge, Drawer, Tabs, Tag } from 'antd';
import {
  BugOutlined,
  DashboardOutlined,
  SettingOutlined,
  NodeIndexOutlined,
  BranchesOutlined,
  AppstoreOutlined,
  ApiOutlined,
  FieldBinaryOutlined,
  HistoryOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { LiveStatePanel } from './panels/LiveStatePanel';
import { ConfigPanel } from './panels/ConfigPanel';
import { ContextPanel } from './panels/ContextPanel';
import { RegistryPanel } from './panels/RegistryPanel';
import { ExtensionRegistryPanel } from './panels/ExtensionRegistryPanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { FieldInspectorPanel } from './panels/FieldInspectorPanel';
import { TimelinePanel } from './panels/TimelinePanel';
import { ConfigWarningsPanel, useConfigWarningCount } from './panels/ConfigWarningsPanel';
import { QuickActions } from './QuickActions';
import { useUi24Config } from '../context/UI24Context';
import { useDevToolsStore, logActivity, useActivityLog } from './devtoolsBridge';

const PANEL_STYLE: React.CSSProperties = {
  height: 'calc(100vh - 180px)',
  overflow: 'auto',
};

/**
 * Config DevTools overlay (#23).
 * Toggled with Ctrl+Shift+D. Only renders in development mode.
 */
export const ConfigDevTools: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { config } = useUi24Config();
  const store = useDevToolsStore();
  const activityLog = useActivityLog();
  const warningCount = useConfigWarningCount();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  const activeCount = store.size;

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      logActivity({
        type: 'navigation',
        label: location.pathname,
        data: { from: prevPathRef.current, to: location.pathname, search: location.search },
      });
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, location.search]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const tabs = useMemo(() => [
    {
      key: 'live',
      label: (
        <span>
          <DashboardOutlined /> State
          {activeCount > 0 && (
            <span style={{ marginLeft: 4, fontSize: 10, color: '#52c41a', fontWeight: 600 }}>({activeCount})</span>
          )}
        </span>
      ),
      children: <div style={PANEL_STYLE}><LiveStatePanel /></div>,
    },
    {
      key: 'fields',
      label: <span><FieldBinaryOutlined /> Fields</span>,
      children: <div style={PANEL_STYLE}><FieldInspectorPanel /></div>,
    },
    {
      key: 'network',
      label: <span><ApiOutlined /> Network</span>,
      children: <div style={PANEL_STYLE}><NetworkPanel /></div>,
    },
    {
      key: 'timeline',
      label: <span><HistoryOutlined /> Timeline</span>,
      children: <div style={PANEL_STYLE}><TimelinePanel /></div>,
    },
    {
      key: 'config',
      label: (
        <Badge count={warningCount} size="small" offset={[8, -2]} color={warningCount > 0 ? '#faad14' : undefined}>
          <span><SettingOutlined /> Config</span>
        </Badge>
      ),
      children: <div style={PANEL_STYLE}><ConfigPanel /></div>,
    },
    {
      key: 'warnings',
      label: (
        <Badge count={warningCount} size="small" offset={[8, -2]}>
          <span><WarningOutlined /> Warnings</span>
        </Badge>
      ),
      children: <div style={PANEL_STYLE}><ConfigWarningsPanel /></div>,
    },
    {
      key: 'context',
      label: <span><NodeIndexOutlined /> Context</span>,
      children: <div style={PANEL_STYLE}><ContextPanel /></div>,
    },
    {
      key: 'registry',
      label: <span><BranchesOutlined /> Conditions</span>,
      children: <div style={PANEL_STYLE}><RegistryPanel /></div>,
    },
    {
      key: 'extensions',
      label: <span><AppstoreOutlined /> Extensions</span>,
      children: <div style={PANEL_STYLE}><ExtensionRegistryPanel /></div>,
    },
  ], [warningCount, activeCount]);

  if (process.env.NODE_ENV === 'production') return null;

  const envConfig = config.environment;

  return (
    <>
      {/* Floating trigger button */}
      <div
        onClick={() => setOpen(true)}
        style={{
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
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        title="Config DevTools (Ctrl+Shift+D)"
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
        }}
      >
        <BugOutlined />
        {/* Active state count badge */}
        {activeCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#52c41a',
            fontSize: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            border: '2px solid #fff',
          }}>
            {activeCount > 9 ? '9+' : activeCount}
          </span>
        )}
        {/* Warning badge */}
        {warningCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            left: -2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#faad14',
            fontSize: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            border: '2px solid #fff',
            color: '#fff',
          }}>
            {warningCount > 9 ? '!' : warningCount}
          </span>
        )}
      </div>

      {/* DevTools drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BugOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 600 }}>UI24 DevTools</span>
            {envConfig && (
              <Tag color={envConfig.color || '#faad14'} style={{ fontSize: 11, lineHeight: '18px' }}>
                {envConfig.name}
              </Tag>
            )}
          </div>
        }
        placement="right"
        width={900}
        open={open}
        onClose={() => setOpen(false)}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column' },
          footer: { padding: '6px 16px', borderTop: '1px solid #f0f0f0' },
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#8c8c8c' }}>
            <span>
              ui24 DevTools
              <span style={{ margin: '0 6px', color: '#d9d9d9' }}>|</span>
              <span>{activityLog.length} events</span>
              <span style={{ margin: '0 6px', color: '#d9d9d9' }}>|</span>
              <span>{activeCount} active</span>
            </span>
            <span>
              {config.baseURL}
              {envConfig && <> · {envConfig.name}</>}
            </span>
          </div>
        }
      >
        <QuickActions />
        <Tabs
          items={tabs}
          defaultActiveKey="live"
          tabPosition="top"
          size="small"
          style={{ flex: 1 }}
          tabBarStyle={{
            paddingLeft: 12,
            marginBottom: 0,
            background: '#fff',
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        />
      </Drawer>
    </>
  );
};
