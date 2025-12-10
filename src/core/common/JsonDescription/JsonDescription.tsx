import React from 'react';
import { Descriptions, List, Typography } from 'antd';
import { formatKey } from '../../../core/utils';
import { JsonViewer } from '../JsonViewer';

const { Text } = Typography;

/**
 * Calculate the depth of a nested object/array
 */
const getObjectDepth = (obj: any, currentDepth: number = 0): number => {
  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }
  
  if (Object.keys(obj).length === 0) {
    return currentDepth;
  }
  
  const depths = Object.values(obj).map(value => 
    getObjectDepth(value, currentDepth + 1)
  );
  
  return Math.max(...depths);
};

const renderValue = (value: any, maxDepth: number = 2): React.ReactNode => {
    if (value === null || value === undefined) {
        return <Text type="secondary">—</Text>;
    }

    if (typeof value === 'object') {
        // Check depth of THIS value before rendering
        const valueDepth = getObjectDepth(value);
        
        // If this specific value is too deep, render as JsonViewer
        // Let JsonViewer decide compact vs full based on size thresholds
        if (valueDepth > maxDepth) {
            return <JsonViewer 
                data={value} 
                title="Data" 
                defaultExpanded={false}
                showStats={true}
                // Let JsonViewer auto-detect if compact mode is needed based on char/line thresholds
                // compact will be true only if it exceeds thresholds (1000 chars or 30 lines)
            />;
        }
        
        // Otherwise, render recursively with JsonDescription
        return <JsonDescription data={value} maxDepth={maxDepth} />;
    }

    if (typeof value === 'boolean') {
        return <Text type={value ? 'success' : 'danger'}>{String(value)}</Text>;
    }

    if (typeof value === 'number') {
        return <Text>{value.toLocaleString()}</Text>;
    }

    const stringValue = String(value);
    if (stringValue.length > 200) {
        return (
            <Text title={stringValue} ellipsis={{ tooltip: true }}>
                {stringValue}
            </Text>
        );
    }

    return <Text>{stringValue}</Text>;
};

/**
 * JsonDescription - Smart JSON/Object renderer with per-property depth-based display
 * 
 * Features:
 * - **Always tries to render as Descriptions table first**
 * - **Per-property depth checking**: Each property is evaluated individually
 * - **Shallow properties (depth ≤ maxDepth)**: Rendered as formatted table rows
 * - **Deep properties (depth > maxDepth)**: Rendered as JsonViewer (compact if large, expanded if small)
 * - **Mixed depth objects**: Shallow fields as rows, deep fields as preview + "View Full JSON" button
 * - **Smart preview**: Shows sampled keys/values, not full JSON clutter
 * 
 * @param data - Object or array to render
 * @param bordered - Whether to show borders (default: true)
 * @param maxDepth - Maximum depth per property before switching to JsonViewer (default: 2)
 * 
 * @example
 * // syncMetadata with mixed depths:
 * // { syncAttempts: 0, syncDuration: 0, apiResponse: { deeply: { nested: { data } } } }
 * // Result:
 * // - Last Error: — (as table row)
 * // - Sync Attempts: 0 (as table row)
 * // - Sync Duration: 0 (as table row)  
 * // - Api Response: { fixture, venue, ... } [View Full JSON →] (compact with modal button)
 */
export const JsonDescription: React.FC<{ 
  data: any; 
  bordered?: boolean;
  maxDepth?: number;  // Maximum depth before switching to JsonViewer (default: 2)
}> = ({ data, bordered = true, maxDepth = 2 }) => {
    if (typeof data !== 'object' || data === null) {
        return renderValue(data, maxDepth);
    }

    // For arrays, check if items are complex
    if (Array.isArray(data)) {
        const hasComplexItems = data.some(item => {
            if (typeof item === 'object' && item !== null) {
                return getObjectDepth(item) > maxDepth;
            }
            return false;
        });
        
        if (hasComplexItems) {
            return <JsonViewer data={data} title="Array Data" defaultExpanded={false} showStats={true} />;
        }
        
        return (
            <List
                bordered={bordered}
                dataSource={data}
                renderItem={(item, index) => (
                    <List.Item>
                        <Text type="secondary" style={{ marginRight: 8 }}>#{index + 1}:</Text>
                        {renderValue(item, maxDepth)}
                    </List.Item>
                )}
                size="small"
            />
        );
    }

    // For objects, always try to render as Descriptions first
    // Individual properties that are too deep will be rendered as JsonViewer by renderValue
    const entries = Object.entries(data);
    if (entries.length === 0) {
        return <Text type="secondary">—</Text>;
    }

    return (
        <Descriptions
            size="small"
            column={1}
            bordered={bordered}
            styles={{ label: { fontWeight: 500, width: '30%'} }}
        >
            {entries.map(([key, value]) => (
                <Descriptions.Item key={key} label={formatKey(key)}>
                    {renderValue(value, maxDepth)}
                </Descriptions.Item>
            ))}
        </Descriptions>
    );
}; 