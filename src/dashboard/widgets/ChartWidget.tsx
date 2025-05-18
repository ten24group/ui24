import React, { useEffect, useState } from 'react';
import { Line, Bar, Area, Column, Pie, LineConfig, BarConfig, AreaConfig, ColumnConfig, PieConfig } from '@ant-design/plots';
import './ChartWidget.css';
import { useApi } from '../../core/context';

export type ChartType = 'line' | 'bar' | 'area' | 'pie';

export interface IChartDataPoint {
  [key: string]: any; // Allow any column names
}

export interface IChartConfig {
  type: ChartType;
  data: IChartDataPoint[];
  xField?: string;
  yField?: string;
  seriesField?: string;
  color?: string | string[];
  smooth?: boolean;
  areaStyle?: {
    fillOpacity?: number;
  };
  point?: {
    size?: number;
    shape?: string;
  };
  legend?: boolean | object;
  tooltip?: boolean;
  animation?: boolean;
  // Pie-specific
  angleField?: string;
  colorField?: string;
  radius?: number;
  innerRadius?: number;
  label?: any;
}

export interface IChartWidgetProps {
  title?: string;
  dataConfig?: {
    apiUrl: string;
    apiMethod?: string;
    payload?: any;
    responseKey?: string;
    headers?: Record<string, string>;
  };
  options?: {
    type?: ChartType;
    xField?: string;
    yField?: string;
    seriesField?: string;
    color?: string | string[];
    smooth?: boolean;
    areaStyle?: {
      fillOpacity?: number;
    };
    point?: {
      size?: number;
      shape?: string;
    };
    legend?: boolean | object;
    tooltip?: boolean;
    animation?: boolean;
    xAxisLabel?: string;
    yAxisLabel?: string;
    // Pie-specific
    angleField?: string;
    colorField?: string;
    radius?: number;
    innerRadius?: number;
    label?: any;
  };
}

const DEFAULT_CHART_CONFIG: Partial<IChartConfig> = {
  smooth: true,
  legend: true,
  tooltip: true,
  animation: true,
  point: {
    size: 4,
    shape: 'circle'
  }
};

export const ChartWidget: React.FC<IChartWidgetProps> = ({ title, dataConfig, options }) => {
  const [chartData, setChartData] = useState<IChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { callApiMethod } = useApi();

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!dataConfig || !dataConfig.apiUrl) {
        setChartData([]);
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
        const data = dataConfig.responseKey ? response.data[dataConfig.responseKey] : response.data;
        if (isMounted) setChartData(data);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to fetch data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [dataConfig, callApiMethod]);

  if (options?.type !== 'pie' && (!options?.xField || !options?.yField)) {
    return <div className="chart-widget-error">Missing required xField or yField configuration</div>;
  }
  if (options?.type !== 'pie') {
    const hasValidYField = chartData.every(d => d && (typeof d[options.yField!] === 'number' || typeof d[options.yField!] === 'string'));
    if (!hasValidYField && chartData.length > 0) {
      return <div className="chart-widget-error">Data is missing the required yField: {options.yField}</div>;
    }
  }

  const chartConfig: IChartConfig = {
    type: options?.type || 'line',
    data: chartData,
    xField: options.xField,
    yField: options.yField,
    seriesField: options.seriesField,
    color: options?.color,
    smooth: options?.smooth ?? DEFAULT_CHART_CONFIG.smooth,
    areaStyle: options?.areaStyle,
    point: options?.point ?? DEFAULT_CHART_CONFIG.point,
    legend: options?.legend ?? true,
    tooltip: options?.tooltip ?? true,
    animation: options?.animation ?? DEFAULT_CHART_CONFIG.animation,
    angleField: options?.angleField,
    colorField: options?.colorField,
    radius: options?.radius,
    innerRadius: options?.innerRadius,
    label: options?.label,
  };

  const axisLabels = {
    xAxis: {
      title: { text: options.xAxisLabel || options.xField, style: { fontWeight: 500 } },
    },
    yAxis: {
      title: { text: options.yAxisLabel || options.yField, style: { fontWeight: 500 } },
    },
  };

  // Only include seriesField if defined
  const commonProps: any = {
    data: chartData,
    color: options?.color,
    animation: options?.animation ?? DEFAULT_CHART_CONFIG.animation,
  };
  if (options.type !== 'pie') {
    commonProps.xField = options.xField;
    commonProps.yField = options.yField;
    commonProps.smooth = options?.smooth ?? DEFAULT_CHART_CONFIG.smooth;
    commonProps.point = options?.point ?? DEFAULT_CHART_CONFIG.point;
    commonProps.xAxis = axisLabels.xAxis;
    commonProps.yAxis = axisLabels.yAxis;
    if (options.seriesField) {
      commonProps.seriesField = options.seriesField;
    }
    if (typeof options.legend !== 'undefined') {
      commonProps.legend = options.legend;
    }
    if (typeof options.tooltip !== 'undefined') {
      commonProps.tooltip = options.tooltip;
    }
  } else {
    // Pie-specific props
    commonProps.angleField = options.angleField;
    commonProps.colorField = options.colorField;
    if (typeof options.radius === 'number') commonProps.radius = options.radius;
    if (typeof options.innerRadius === 'number') commonProps.innerRadius = options.innerRadius;
    if (typeof options.legend !== 'undefined') {
      commonProps.legend = options.legend;
    }
    if (typeof options.tooltip !== 'undefined') {
      commonProps.tooltip = options.tooltip;
    }
    if (options.label) {
      commonProps.label = options.label;
    }
  }

  const renderChart = () => {
    if (loading) return <div className="chart-widget-loading">Loading...</div>;
    if (error) return <div className="chart-widget-error">{error}</div>;
    if (!chartData.length) return <div className="chart-widget-empty">No data available</div>;

    switch (chartConfig.type) {
      case 'line':
        return <Line {...(commonProps as LineConfig)} />;
      case 'bar':
        return <Column {...(commonProps as ColumnConfig)} />;
      case 'area':
        return <Area 
          {...(commonProps as AreaConfig)} 
          area={{ 
            style: options?.areaStyle 
          }} 
        />;
      case 'pie':
        return <Pie {...(commonProps as PieConfig)} />;
      default:
        return <Line {...(commonProps as LineConfig)} />;
    }
  };

  return (
    <div className="chart-widget-card">
      <div className="chart-widget-header">
        <span className="chart-widget-title">{title}</span>
      </div>
      <div className="chart-widget-content">
        {renderChart()}
      </div>
    </div>
  );
}; 