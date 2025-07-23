import React, { useState, useEffect } from 'react';
import { Descriptions, Card, Divider, Typography } from 'antd';
import { useApi } from '../../core/context';

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

const formatKey = (key: string): string => {
  // Convert camelCase to readable format
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
};

const renderValue = (value: any, key: string, level: number = 0): React.ReactNode => {
  if (value === null || value === undefined) {
    return <Text type="secondary">—</Text>;
  }
  
  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <Text type="secondary">—</Text>;
    }
    
    // For nested objects, create a more compact and organized display
    if (level === 0) {
      // Top level nested object - use a bordered description
      return (
        <div style={{ marginTop: 8 }}>
          <Descriptions
            size="small"
            column={1}
            bordered={true}
            colon={true}
            labelStyle={{ backgroundColor: '#fafafa', fontWeight: 500, width: '40%' }}
            contentStyle={{ backgroundColor: '#fff' }}
          >
            {entries.map(([nestedKey, nestedValue]) => (
              <Descriptions.Item key={nestedKey} label={formatKey(nestedKey)}>
                {renderValue(nestedValue, nestedKey, level + 1)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </div>
      );
    } else {
      // Deeper nesting - use a simpler format
      return (
        <div style={{ marginLeft: 8, paddingLeft: 8, borderLeft: '2px solid #e8e8e8' }}>
          {entries.map(([nestedKey, nestedValue], index) => (
            <div key={nestedKey} style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: '12px' }}>{formatKey(nestedKey)}:</Text>{' '}
              <Text style={{ fontSize: '12px' }}>{renderValue(nestedValue, nestedKey, level + 1)}</Text>
            </div>
          ))}
        </div>
      );
    }
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Text type="secondary">—</Text>;
    }
    
    return (
      <div>
        {value.map((item, index) => (
          <div key={index} style={{ marginBottom: index < value.length - 1 ? 8 : 0 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>#{index + 1}:</Text>{' '}
            {renderValue(item, `${key}[${index}]`, level + 1)}
          </div>
        ))}
      </div>
    );
  }
  
  // Handle different types of primitive values
  if (typeof value === 'boolean') {
    return <Text type={value ? 'success' : 'danger'}>{String(value)}</Text>;
  }
  
  if (typeof value === 'number') {
    // Format large numbers with commas
    return <Text>{value.toLocaleString()}</Text>;
  }
  
  // Handle very long strings by truncating them
  const stringValue = String(value);
  if (stringValue.length > 100) {
    return (
      <Text title={stringValue}>
        {stringValue.substring(0, 100)}...
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
      // Use configured items
      return options.items.map(item => (
        <Descriptions.Item 
          key={item.key}
          label={item.label}
          span={item.span}
          labelStyle={item.labelStyle}
          contentStyle={item.contentStyle}
        >
          {renderValue(data[item.key], item.key)}
        </Descriptions.Item>
      ));
    } else {
      // Auto-generate items from data object
      return Object.entries(data).map(([key, value]) => (
        <Descriptions.Item key={key} label={formatKey(key)}>
          {renderValue(value, key)}
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