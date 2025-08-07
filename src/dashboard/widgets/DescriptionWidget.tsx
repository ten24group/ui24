import React, { useState, useEffect } from 'react';
import { Descriptions, Card, Typography } from 'antd';
import { useApi } from '../../core/context';
import { formatKey } from '../../core/utils';
import { JsonDescription } from '../../core/common';

const { Text } = Typography;

export interface IDescriptionWidgetProps {
  title?: string;
  dataConfig?: {
    apiUrl: string;
    apiMethod?: string;
    payload?: any;
    responseKey?: string;
    headers?: Record<string, string>;
  };
  options?: {
    bordered?: boolean;
    column?: number;
    size?: 'default' | 'middle' | 'small';
    layout?: 'horizontal' | 'vertical';
    colon?: boolean;
    items?: Array<{
      key: string;
      label: string;
      span?: number;
      labelStyle?: React.CSSProperties;
      contentStyle?: React.CSSProperties;
    }>;
  };
}

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
    if (stringValue.length > 100) {
        return (
            <Text title={stringValue} ellipsis={{ tooltip: true }}>
                {stringValue}
            </Text>
        );
    }

    return <Text>{stringValue}</Text>;
};

export const DescriptionWidget: React.FC<IDescriptionWidgetProps> = ({
    title,
    dataConfig,
    options = {}
}) => {
    const [data, setData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { callApiMethod } = useApi();

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            if (!dataConfig || !dataConfig.apiUrl) {
                setData({});
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const apiMethod = dataConfig.apiMethod || 'GET';
                const response = await callApiMethod({
                    apiUrl: dataConfig.apiUrl,
                    apiMethod,
                    payload: dataConfig.payload,
                    responseKey: dataConfig.responseKey,
                    headers: dataConfig.headers,
                });

                const responseData = dataConfig.responseKey ? response.data[dataConfig.responseKey] : response.data;
                if (isMounted) setData(responseData || {});
            } catch (err: any) {
                if (isMounted) setError(err?.message || 'Failed to fetch data');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [dataConfig, callApiMethod]);

    const renderDescriptionItems = () => {
        if (options.items) {
            return options.items.map(item => (
                <Descriptions.Item
                    key={item.key}
                    label={item.label}
                    span={item.span}
                    labelStyle={item.labelStyle}
                    contentStyle={item.contentStyle}
                >
                    {renderValue(data[item.key])}
                </Descriptions.Item>
            ));
        } else {
            return Object.entries(data).map(([key, value]) => (
                <Descriptions.Item key={key} label={formatKey(key)}>
                    {renderValue(value)}
                </Descriptions.Item>
            ));
        }
    };

    return (
        <Card
            title={title}
            loading={loading}
            style={{ height: '100%' }}
            bodyStyle={{ padding: '16px' }}
        >
            {error ? (
                <div style={{ color: 'red', padding: '16px', textAlign: 'center' }}>
                    {error}
                </div>
            ) : (
                <Descriptions
                    bordered={options.bordered ?? false}
                    column={options.column ?? 1}
                    size={options.size ?? 'small'}
                    layout={options.layout ?? 'horizontal'}
                    colon={options.colon ?? true}
                >
                    {renderDescriptionItems()}
                </Descriptions>
            )}
        </Card>
    );
}; 