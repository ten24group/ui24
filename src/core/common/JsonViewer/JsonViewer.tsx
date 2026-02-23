import React, { useState, useMemo } from 'react';
import { Typography, Space, Button, Tooltip } from 'antd';
import { CopyOutlined, CheckOutlined, ExpandAltOutlined } from '@ant-design/icons';
import { JsonView, allExpanded, darkStyles, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { OpenInModal } from '../../../modal/Modal';
import type { IDetailsConfig } from '../../types/field-config';
import { generateJsonPreview } from '../../utils/jsonUtils';
import { useThemeMode } from '../../stores/theme';

interface JsonViewerProps {
  data: any;
  title?: string;
  defaultExpanded?: boolean;
  maxHeight?: string | number;
  showCopy?: boolean;
  showStats?: boolean;
  charThreshold?: number;
  lineThreshold?: number;
  compact?: boolean;
  showModalButton?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title = 'JSON',
  defaultExpanded = false,
  maxHeight = '500px',
  showCopy = true,
  showStats = true,
  charThreshold = 1000,
  lineThreshold = 30,
  compact = false,
  showModalButton
}) => {
  const [ copied, setCopied ] = useState(false);
  const isDark = useThemeMode() === 'dark';

  const parsedData = useMemo(() => {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return data; }
    }
    return data;
  }, [ data ]);

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isEmpty = !parsedData || (typeof parsedData === 'object' && Object.keys(parsedData).length === 0);

  const charCount = jsonString.length;
  const lineCount = jsonString.split('\n').length;
  const isLarge = charCount > charThreshold || lineCount > lineThreshold;
  const shouldShowModalButton = showModalButton !== undefined ? showModalButton : isLarge;

  const previewText = useMemo(() =>
    generateJsonPreview(parsedData, { maxStringLength: 50, maxKeys: 3 })
  , [ parsedData ]);

  const detailsConfig: IDetailsConfig = useMemo(() => ({
    propertiesConfig: [ {
      label: undefined,
      fieldType: 'json',
      type: 'map' as const,
      column: 'data'
    } ],
    dataSource: { data: parsedData }
  }), [ parsedData ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isEmpty) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  if (compact) {
    return (
      <Space size="small" style={{ width: '100%' }}>
        <Typography.Text
          type="secondary"
          ellipsis
          style={{ flex: 1, fontSize: '13px', fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
        >
          {previewText}
        </Typography.Text>
        <OpenInModal
          modalType="details"
          modalTitle={title || 'JSON Data'}
          modalWidth={1000}
          modalPageConfig={detailsConfig}
        >
          <Button type="link" size="small" icon={<ExpandAltOutlined />} />
        </OpenInModal>
      </Space>
    );
  }

  return (
    <div style={{ width: '100%', border: '1px solid var(--ant-color-border-secondary, #f0f0f0)', borderRadius: 4, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 8px',
        borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        background: 'var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02))',
      }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>{title}</span>
        <Space size="small">
          {showStats && (
            <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
              {lineCount} lines, {charCount.toLocaleString()} chars
            </Typography.Text>
          )}
          {showCopy && (
            <Tooltip title="Copy JSON">
              <Button
                size="small"
                type="text"
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
              />
            </Tooltip>
          )}
          {shouldShowModalButton && (
            <OpenInModal
              modalType="details"
              modalTitle={title || 'JSON Data'}
              modalPageConfig={detailsConfig}
            >
              <Tooltip title="Open in modal">
                <Button size="small" type="text" icon={<ExpandAltOutlined />} />
              </Tooltip>
            </OpenInModal>
          )}
        </Space>
      </div>
      {/* JSON content — library handles its own dark/light colors */}
      <div style={{ maxHeight, overflow: 'auto', fontSize: 12 }}>
        <JsonView
          data={parsedData}
          shouldExpandNode={defaultExpanded ? allExpanded : undefined}
          style={isDark ? darkStyles : defaultStyles}
        />
      </div>
    </div>
  );
};
