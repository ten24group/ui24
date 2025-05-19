import React, { useEffect, useState } from 'react';
import { Line, Bar, Area, Column, Pie, LineConfig, BarConfig, AreaConfig, ColumnConfig, PieConfig } from '@ant-design/plots';
import './ChartWidget.css';
import { useApi } from '../../core/context';
import { TimePeriodSelector, TimePeriodSelectorProps } from './TimePeriodSelector';

export type ChartType = 'line' | 'bar' | 'area' | 'pie';

export interface IChartDataPoint {
  [key: string]: any; // Allow any column names
}

export interface IChartConfig {
  type: ChartType;
  data: IChartDataPoint[];
  xField?: string;
  yField?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
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
  height?: number;
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
  options?: Partial<IChartConfig>;
  timePeriodSelectorProps?: TimePeriodSelectorProps;
}

const DEFAULT_CHART_CONFIG: Partial<IChartConfig> = {
  smooth: true,
  legend: true,
  tooltip: true,
  animation: true,
  point: {
    size: 4,
    shape: 'circle'
  },
  height: 300,
};

export const ChartWidget: React.FC<IChartWidgetProps> = ({ title, dataConfig, options, timePeriodSelectorProps }) => {
  const [chartData, setChartData] = useState<IChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { callApiMethod } = useApi();

  // Compute effective payload with time period if present
  const effectivePayload = React.useMemo(() => {
    let basePayload = dataConfig?.payload || {};
    if (timePeriodSelectorProps && timePeriodSelectorProps.value?.range) {
      const [start, end] = timePeriodSelectorProps.value.range;
      // Use the timezone of the start/end Dayjs objects
      return {
        ...basePayload,
        startDate: start.format('YYYY-MM-DDTHH:mm:ss'),
        endDate: end.format('YYYY-MM-DDTHH:mm:ss'),
        period: timePeriodSelectorProps.value.period,
      };
    }
    return basePayload;
  }, [dataConfig?.payload, timePeriodSelectorProps]);

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
          payload: effectivePayload,
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
  }, [dataConfig, callApiMethod, effectivePayload]);

  if (options?.type !== 'pie' && (!options?.xField || !options?.yField)) {
    return <div className="chart-widget-error">Missing required xField or yField configuration</div>;
  }
  if (options?.type !== 'pie') {
    const hasValidYField = chartData.every(d => d && (typeof d[options.yField!] === 'number' || typeof d[options.yField!] === 'string'));
    if (!hasValidYField && chartData.length > 0) {
      return <div className="chart-widget-error">Data is missing the required yField: {options.yField}</div>;
    }
  }

  const axisLabels = {
    xAxis: {
      title: { text: options.xAxisLabel || options.xField, style: { fontWeight: 500 } },
    },
    yAxis: {
      title: { text: options.yAxisLabel || options.yField, style: { fontWeight: 500 } },
    },
  };

  const chartConfig: any = {
    data: chartData,
    color: options?.color,
    animation: options?.animation ?? DEFAULT_CHART_CONFIG.animation,
    height: options?.height ?? DEFAULT_CHART_CONFIG.height,
  };
  if (options.type !== 'pie') {
    chartConfig.xField = options.xField;
    chartConfig.yField = options.yField;
    chartConfig.smooth = options?.smooth ?? DEFAULT_CHART_CONFIG.smooth;
    chartConfig.point = options?.point ?? DEFAULT_CHART_CONFIG.point;
    chartConfig.xAxis = axisLabels.xAxis;
    chartConfig.yAxis = axisLabels.yAxis;
    if (options.seriesField) {
      chartConfig.seriesField = options.seriesField;
    }
    if (typeof options.legend !== 'undefined') {
      chartConfig.legend = options.legend;
    }
    if (typeof options.tooltip !== 'undefined') {
      chartConfig.tooltip = options.tooltip;
    }
  } else {
    // Pie-specific props
    chartConfig.angleField = options.angleField;
    chartConfig.colorField = options.colorField;
    if (typeof options.radius === 'number') chartConfig.radius = options.radius;
    if (typeof options.innerRadius === 'number') chartConfig.innerRadius = options.innerRadius;
    if (typeof options.legend !== 'undefined') {
      chartConfig.legend = options.legend;
    }
    if (typeof options.tooltip !== 'undefined') {
      chartConfig.tooltip = options.tooltip;
    }
    if (options.label) {
      chartConfig.label = options.label;
    }
  }

  const renderChart = () => {
    if (loading) return <div className="chart-widget-loading">Loading...</div>;
    if (error) return <div className="chart-widget-error">{error}</div>;
    if (!chartData.length) return <div className="chart-widget-empty">No data available</div>;

    switch (options?.type) {
      case 'line':
        return <Line {...(chartConfig as LineConfig)} />;
      case 'bar':
        return <Column {...(chartConfig as ColumnConfig)} />;
      case 'area':
        return <Area 
          {...(chartConfig as AreaConfig)} 
          area={{ 
            style: options?.areaStyle 
          }} 
        />;
      case 'pie':
        return <Pie {...(chartConfig as PieConfig)} />;
      default:
        return <Line {...(chartConfig as LineConfig)} />;
    }
  };

  return (
    <div className="chart-widget-card">
      <div className="chart-widget-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="chart-widget-title">{title}</span>
        {timePeriodSelectorProps && typeof timePeriodSelectorProps.onChange === 'function' && (
          <div style={{ marginLeft: 'auto' }}>
            <TimePeriodSelector {...timePeriodSelectorProps} />
          </div>
        )}
      </div>
      <div className="chart-widget-content">
        {renderChart()}
      </div>
    </div>
  );
}; 