import React, { useMemo, useState } from 'react';
import { Typography, Tag, Empty, Segmented, Alert } from 'antd';
import {
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useDevToolsStore, BridgeEntry, BridgeEntryType } from '../devtoolsBridge';
import { fieldTypeRegistry } from '../../registry/FieldTypeRegistry';
import { ExtensionRegistry } from '../../registry';

const { Text } = Typography;

type Severity = 'error' | 'warning' | 'info';

interface ConfigWarning {
  severity: Severity;
  field?: string;
  message: string;
  suggestion?: string;
}

function analyzePageConfig(pageData: Record<string, unknown>): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];
  const config = (pageData?.config ?? pageData) as Record<string, unknown>;

  const pageType = pageData?.pageType as string | undefined;

  // Gather all known field types
  const knownFieldTypes = new Set<string>();
  const allTypes = fieldTypeRegistry.listAll();
  for (const ft of Object.keys(allTypes)) {
    knownFieldTypes.add(ft);
  }
  const extComponents = ExtensionRegistry.listComponents();
  for (const c of extComponents) {
    if (c.category === 'field') knownFieldTypes.add(c.key);
  }

  const analyzeFields = (fields: unknown[], source: string) => {
    const seenNames = new Map<string, number>();

    for (const item of fields) {
      if (!item || typeof item !== 'object') continue;
      const f = item as Record<string, unknown>;
      const name = String(f.name || f.column || f.dataIndex || f.key || '');

      if (!name) {
        warnings.push({
          severity: 'error',
          message: `Empty field name in ${source}`,
          suggestion: 'Every field must have a name, column, or dataIndex.',
        });
        continue;
      }

      // Duplicate check
      seenNames.set(name, (seenNames.get(name) || 0) + 1);
      if (seenNames.get(name)! === 2) {
        warnings.push({
          severity: 'warning',
          field: name,
          message: `Duplicate field "${name}" in ${source}`,
          suggestion: 'Remove the duplicate or use unique names.',
        });
      }

      // Unknown field type
      const ft = f.fieldType as string | undefined;
      if (ft && !knownFieldTypes.has(ft)) {
        warnings.push({
          severity: 'warning',
          field: name,
          message: `Unknown fieldType "${ft}" on field "${name}"`,
          suggestion: `Registered types: ${Array.from(knownFieldTypes).slice(0, 10).join(', ')}...`,
        });
      }
    }
  };

  // Analyze top-level propertiesConfig
  if (Array.isArray(config.propertiesConfig)) {
    analyzeFields(config.propertiesConfig, 'propertiesConfig');
  }
  if (Array.isArray(config.columns)) {
    analyzeFields(config.columns, 'columns');
  }

  // Analyze nested page configs
  for (const key of [ 'formPageConfig', 'listPageConfig', 'detailsPageConfig', 'detailPageConfig' ]) {
    const sub = config[ key ] as Record<string, unknown> | undefined;
    if (sub?.propertiesConfig && Array.isArray(sub.propertiesConfig)) {
      analyzeFields(sub.propertiesConfig, key);
    }
    if (sub?.columns && Array.isArray(sub.columns)) {
      analyzeFields(sub.columns, key);
    }
  }

  // Missing config section checks
  if (pageType === 'form' && !config.propertiesConfig && !(config as any).formPageConfig) {
    warnings.push({
      severity: 'error',
      message: 'Form page missing propertiesConfig or formPageConfig',
      suggestion: 'A form page requires field definitions.',
    });
  }
  if (pageType === 'list' && !config.columns && !(config as any).listPageConfig) {
    warnings.push({
      severity: 'warning',
      message: 'List page missing columns or listPageConfig',
      suggestion: 'Column definitions drive the table display.',
    });
  }
  if (pageType === 'details' && !config.propertiesConfig && !(config as any).detailsPageConfig && !(config as any).detailPageConfig) {
    warnings.push({
      severity: 'warning',
      message: 'Details page missing propertiesConfig or detailsPageConfig',
      suggestion: 'Detail field definitions drive the layout.',
    });
  }

  return warnings;
}

const SEVERITY_CONFIG: Record<Severity, { color: string; icon: React.ReactNode }> = {
  error: { color: 'red', icon: <CloseCircleOutlined /> },
  warning: { color: 'orange', icon: <WarningOutlined /> },
  info: { color: 'blue', icon: <InfoCircleOutlined /> },
};

type SeverityFilter = 'all' | Severity;

export const ConfigWarningsPanel: React.FC = () => {
  const store = useDevToolsStore();
  const [ filter, setFilter ] = useState<SeverityFilter>('all');

  const pageEntries = useMemo(() => {
    return Array.from(store.values()).filter((e: BridgeEntry) => e.type === ('page' as BridgeEntryType));
  }, [ store ]);

  const allWarnings = useMemo(() => {
    const result: Array<ConfigWarning & { pageLabel: string }> = [];
    for (const entry of pageEntries) {
      const data = entry.data as Record<string, unknown> | null;
      if (!data) continue;
      const warnings = analyzePageConfig(data);
      for (const w of warnings) {
        result.push({ ...w, pageLabel: entry.label });
      }
    }
    return result;
  }, [ pageEntries ]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allWarnings;
    return allWarnings.filter(w => w.severity === filter);
  }, [ allWarnings, filter ]);

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const w of allWarnings) c[ w.severity ]++;
    return c;
  }, [ allWarnings ]);

  if (pageEntries.length === 0) {
    return (
      <div style={{ padding: 12 }}>
        <Empty description="No page context active" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      {allWarnings.length === 0 ? (
        <Alert
          type="success"
          showIcon
          message="No config warnings"
          description="Current page configuration looks good."
          style={{ marginBottom: 12 }}
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <Segmented
              size="small"
              value={filter}
              onChange={val => setFilter(val as SeverityFilter)}
              options={[
                { label: `All (${allWarnings.length})`, value: 'all' },
                { label: `Errors (${counts.error})`, value: 'error' },
                { label: `Warnings (${counts.warning})`, value: 'warning' },
                { label: `Info (${counts.info})`, value: 'info' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((w, idx) => {
              const cfg = SEVERITY_CONFIG[ w.severity ];
              return (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #f0f0f0',
                    borderLeft: `3px solid`,
                    borderLeftColor: cfg.color === 'red' ? '#ff4d4f' : cfg.color === 'orange' ? '#faad14' : '#1677ff',
                    borderRadius: 4,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Tag color={cfg.color} icon={cfg.icon} style={{ margin: 0, fontSize: 10 }}>{w.severity}</Tag>
                    {w.field && (
                      <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{w.field}</Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>{w.pageLabel}</Text>
                  </div>
                  <Text style={{ fontSize: 12 }}>{w.message}</Text>
                  {w.suggestion && (
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                      {w.suggestion}
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/** Export warning count for badge display */
export function useConfigWarningCount(): number {
  const store = useDevToolsStore();
  return useMemo(() => {
    let count = 0;
    for (const entry of Array.from(store.values())) {
      if (entry.type !== 'page') continue;
      const data = entry.data as Record<string, unknown> | null;
      if (!data) continue;
      count += analyzePageConfig(data).length;
    }
    return count;
  }, [ store ]);
}
