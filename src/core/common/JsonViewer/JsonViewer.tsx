import React, { useState, useMemo } from 'react';
import { Collapse, Typography, Space, Button, Tooltip } from 'antd';
import { CopyOutlined, CheckOutlined, ExpandAltOutlined } from '@ant-design/icons';
import { OpenInModal } from '../../../modal/Modal';
import type { IDetailsConfig } from '../../types/field-config';
import { generateJsonPreview } from '../../utils/jsonUtils';

interface JsonViewerProps {
  data: any;
  title?: string;
  defaultExpanded?: boolean;
  maxHeight?: string | number;
  showCopy?: boolean;
  showStats?: boolean;
  charThreshold?: number;  // Show "Open in Modal" button if chars exceed this (default: 2000)
  lineThreshold?: number;  // Show "Open in Modal" button if lines exceed this (default: 50)
  compact?: boolean;       // Force compact mode (preview + modal button only)
  showModalButton?: boolean; // Force show/hide modal button (overrides threshold detection)
}

/**
 * JsonViewer - Smart JSON viewer with flexible inline + modal rendering
 * 
 * Two rendering modes:
 * 1. **Standard Mode (default)**: Collapsible inline viewer with optional modal button
 * 2. **Compact Mode**: Preview + modal button only (for table rows)
 * 
 * Features:
 * - **Inline + Modal Option**: Shows collapsible JSON inline, adds "Open in Modal" button for large JSON
 * - **Threshold-Based Modal Button**: Auto-shows modal button when JSON exceeds thresholds
 * - **Syntax Highlighting**: VSCode-style colors for keys, strings, numbers, booleans, null
 * - **Copy to Clipboard**: One-click copy with visual feedback
 * - **Smart Preview**: Shows first 3 keys for objects, item count for arrays, truncated text for strings
 * - **Consistent Pattern**: Uses same OpenInModal approach as Table's jsonRenderer
 * 
 * @example
 * // Small JSON - shows as collapsible panel only
 * <JsonViewer data={{ name: "John", age: 30 }} title="User" />
 * 
 * @example
 * // Large JSON - shows collapsible panel + "Open in Modal" button (both options!)
 * <JsonViewer data={largeApiResponse} title="API Response" />
 * 
 * @example
 * // Force compact mode - preview + modal button only (used in table rows)
 * <JsonViewer data={myData} compact={true} />
 * 
 * @example
 * // Always show modal button regardless of size
 * <JsonViewer data={myData} showModalButton={true} />
 */
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
  const [ isExpanded, setIsExpanded ] = useState(defaultExpanded);

  // Convert to formatted JSON string (data is already deserialized by Details)
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isEmpty = !data || (typeof data === 'object' && Object.keys(data).length === 0);

  // Calculate stats
  const charCount = jsonString.length;
  const lineCount = jsonString.split('\n').length;

  // Determine if content is large (for modal button)
  const isLarge = charCount > charThreshold || lineCount > lineThreshold;
  const shouldShowModalButton = showModalButton !== undefined ? showModalButton : isLarge;

  // Use shared utility for consistent preview generation (memoized for performance)
  const previewText = useMemo(() =>
    generateJsonPreview(data, { maxStringLength: 50, maxKeys: 3 })
    , [ data ]);

  // Syntax highlighting function
  const syntaxHighlight = (json: string) => {
    // Replace special characters and add color classes
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
  };

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

  const highlightedJson = syntaxHighlight(jsonString);

  // Create details config for modal (reused in both compact and standard modes)
  const detailsConfig: IDetailsConfig = useMemo(() => ({
    propertiesConfig: [ {
      label: undefined,
      fieldType: 'json',
      type: 'map' as const,
      column: 'data'
    } ],
    dataSource: { data }
  }), [ data, title ]);

  // Compact mode: Show ONLY preview with modal button (for table rows)
  if (compact) {
    return (
      <Space size="small" style={{ width: '100%' }}>
        <Typography.Text
          type="secondary"
          ellipsis
          style={{
            flex: 1,
            fontSize: '13px',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace'
          }}
        >
          {previewText}
        </Typography.Text>
        <OpenInModal
          modalType="details"
          modalTitle={title || 'JSON Data'}
          modalWidth={1000}
          modalPageConfig={detailsConfig}
        >
          <Button
            type="link"
            size="small"
            icon={<ExpandAltOutlined />}
          >
          </Button>
        </OpenInModal>
      </Space>
    );
  }

  // Standard mode: Show collapsible JSON viewer (+ optional modal button for large JSON)
  return (
    <div className="json-viewer-container" style={{ width: '100%' }}>
      <style>{`
        .json-viewer-container {
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        
        .json-viewer-pre {
          background-color: #282c34;
          color: #abb2bf;
          padding: 8px;
          overflow: auto;
          margin: 0;
          font-size: 12.5px;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        .json-viewer-pre.light-theme {
          background-color: #fafafa;
          color: #383a42;
        }
        
        /* Dark theme colors (VSCode Dark+) */
        .json-key {
          color: #9cdcfe;
        }
        
        .json-string {
          color: #ce9178;
        }
        
        .json-number {
          color: #b5cea8;
        }
        
        .json-boolean {
          color: #569cd6;
        }
        
        .json-null {
          color: #569cd6;
        }
        
        /* Light theme colors */
        .light-theme .json-key {
          color: #0451a5;
          font-weight: 500;
        }
        
        .light-theme .json-string {
          color: #a31515;
        }
        
        .light-theme .json-number {
          color: #098658;
        }
        
        .light-theme .json-boolean {
          color: #0000ff;
        }
        
        .light-theme .json-null {
          color: #0000ff;
        }
        
      `}</style>

      <Collapse
        size="small"
        activeKey={isExpanded ? [ '1' ] : []}
        onChange={(keys) => setIsExpanded(keys.includes('1'))}
        items={[
          {
            key: '1',
            label: (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontWeight: 500 }}>{title}</span>
                  {(showCopy || shouldShowModalButton) && (
                    <Space size="small" onClick={(e) => e.stopPropagation()}>
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
                      {shouldShowModalButton && (
                        <OpenInModal
                          modalType="details"
                          modalTitle={title || 'JSON Data'}
                          modalPageConfig={detailsConfig}
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
                  )}
                </div>
                {showStats && (
                  <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                    ({lineCount} lines, {charCount.toLocaleString()} chars)
                  </Typography.Text>
                )}
              </div>
            ),
            children: (
              <pre
                className="json-viewer-pre light-theme"
                style={{ maxHeight, margin: 0 }}
                dangerouslySetInnerHTML={{ __html: highlightedJson }}
              />
            )
          }
        ]}
        style={{ backgroundColor: '#fff', border: '1px solid #d9d9d9' }}
      />
    </div>
  );
};

