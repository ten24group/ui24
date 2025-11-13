import React, { useState, useMemo } from 'react';
import { Space, Button, Tooltip, message } from 'antd';
import { CopyOutlined, CheckOutlined, TableOutlined, CodeOutlined, ExpandAltOutlined } from '@ant-design/icons';
import { JsonDescription } from '../JsonDescription/JsonDescription';
import { JsonViewer } from '../JsonViewer/JsonViewer';
import { OpenInModal } from '../../../modal/Modal';
import { IDetailsConfig } from '../../../detail/Details';

interface JsonFieldProps {
  data: any;
  title?: string;
  defaultView?: 'description' | 'json';  // Default view mode
  showToggle?: boolean;  // Show view toggle button (default: true)
  showCopy?: boolean;    // Show copy button (default: true)
  showModal?: boolean;   // Show "Open in Modal" button (default: true)
  maxDepth?: number;     // Max depth for description view (default: 2)
  compact?: boolean;     // Compact mode (no controls, just preview)
}

/**
 * JsonField - Unified JSON renderer with copy + view toggle
 * 
 * Provides two view modes:
 * - **Description View**: Formatted table layout (JsonDescription)
 * - **JSON View**: Raw syntax-highlighted JSON (JsonViewer)
 * 
 * Features:
 * - Copy to clipboard button
 * - Toggle between Description ↔ JSON views
 * - Works inline and in modals
 * - Auto-detects best default view based on depth
 * 
 * @example
 * // In Details page or modal
 * <JsonField data={syncMetadata} title="Sync Metadata" />
 * 
 * @example
 * // Force JSON view by default
 * <JsonField data={apiResponse} defaultView="json" />
 * 
 * @example
 * // Compact mode for table cells
 * <JsonField data={data} compact={true} />
 */
export const JsonField: React.FC<JsonFieldProps> = ({
  data,
  title = 'Data',
  defaultView = 'description',
  showToggle = true,
  showCopy = true,
  showModal = true,
  maxDepth = 2,
  compact = false
}) => {
  const [viewMode, setViewMode] = useState<'description' | 'json'>(defaultView);
  const [copied, setCopied] = useState(false);

  // Convert data to JSON string for copying
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  // Create modal config for "Open in Modal" button
  const modalConfig: IDetailsConfig = useMemo(() => ({
    propertiesConfig: [{
      label: undefined,
      fieldType: 'json',
      type: 'map' as const,
      column: 'data'
    }],
    detailResponse: { data }
  }), [data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      message.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      message.error('Failed to copy');
      console.error('Failed to copy:', err);
    }
  };

  const toggleView = () => {
    setViewMode(prev => prev === 'description' ? 'json' : 'description');
  };

  // Compact mode (for table cells) - delegates to JsonViewer
  if (compact) {
    return <JsonViewer data={data} title={title} compact={true} />;
  }

  // Full mode with controls
  return (
    <div style={{ width: '100%' }}>
      {/* Control buttons - right aligned */}
      {(showToggle || showCopy || showModal) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Space size="small">
            {showToggle && (
              <Tooltip title={viewMode === 'description' ? 'Switch to JSON view' : 'Switch to Description view'}>
                <Button
                  size="small"
                  type="link"
                  icon={viewMode === 'description' ? <CodeOutlined /> : <TableOutlined />}
                  onClick={toggleView}
                />
              </Tooltip>
            )}
            {showCopy && (
              <Tooltip title="Copy JSON">
                <Button
                  size="small"
                  type="link"
                  icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={handleCopy}
                />
              </Tooltip>
            )}
            {showModal && (
              <OpenInModal
                modalType="details"
                modalTitle={title || 'JSON Data'}
                modalWidth={800}
                modalPageConfig={modalConfig}
              >
                <Tooltip title="Open in modal">
                  <Button
                    size="small"
                    type="link"
                    icon={<ExpandAltOutlined />}
                  />
                </Tooltip>
              </OpenInModal>
            )}
          </Space>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'description' ? (
        <JsonDescription data={data} maxDepth={maxDepth} />
      ) : (
        <JsonViewer 
          data={data} 
          title={title} 
          defaultExpanded={true}
          showCopy={false}
          showStats={true}
          showModalButton={false}
        />
      )}
    </div>
  );
};

