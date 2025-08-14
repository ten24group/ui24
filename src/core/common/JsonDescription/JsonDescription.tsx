import React from 'react';
import { Descriptions, List, Typography } from 'antd';
import { formatKey } from '../../../core/utils';

const { Text } = Typography;

const renderValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
        return <Text type="secondary">—</Text>;
    }

    if (typeof value === 'object') {
        return <JsonDescription data={value} />;
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

export const JsonDescription: React.FC<{ data: any; bordered?: boolean }> = ({ data, bordered = true }) => {
    if (typeof data !== 'object' || data === null) {
        return renderValue(data);
    }

    if (Array.isArray(data)) {
        return (
            <List
                bordered={bordered}
                dataSource={data}
                renderItem={(item, index) => (
                    <List.Item>
                        <Text type="secondary" style={{ marginRight: 8 }}>#{index + 1}:</Text>
                        {renderValue(item)}
                    </List.Item>
                )}
                size="small"
            />
        );
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
        return <Text type="secondary">—</Text>;
    }

    return (
        <Descriptions
            size="small"
            column={1}
            bordered={bordered}
            labelStyle={{ fontWeight: 500, width: '30%' }}
        >
            {entries.map(([key, value]) => (
                <Descriptions.Item key={key} label={formatKey(key)}>
                    {renderValue(value)}
                </Descriptions.Item>
            ))}
        </Descriptions>
    );
}; 