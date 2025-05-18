import React, { useEffect, useState } from 'react';
import * as AntIcons from '@ant-design/icons';
import './StatWidget.css';
import { useApi } from '../../core/context';

export interface ITrendConfig {
  direction: 'up' | 'down';
  label?: string;
  upColor?: string;
  downColor?: string;
}

export interface ISecondaryStatConfig {
  label?: string;
  trend?: ITrendConfigOptions;
}

export interface IStatWidgetIconConfig {
  name?: string; // AntD icon name, e.g. 'StarFilled'
  color?: string;
  size?: number;
  greyscale?: boolean;
  emoji?: string; // Emoji string
  url?: string; // Image URL
}

export type ITrendConfigOptions = Partial<ITrendConfig>;

export interface IStatWidgetProps {
  title?: string;
  dataConfig?: any;
  options?: {
    color?: string;
    trend?: ITrendConfigOptions;
    secondary?: ISecondaryStatConfig;
    icon?: React.ReactNode | string | IStatWidgetIconConfig;
  };
}

const ICON_DEFAULT_SIZE = 72;

const TrendArrow: React.FC<ITrendConfig & { value: string | number; color?: string }> = ({ value, direction, color, label, upColor, downColor }) => {
  const arrowColor =
    color ||
    (direction === 'up' ? upColor : downColor) ||
    (direction === 'up' ? '#52c41a' : '#ff4d4f');
  return (
    <span
      className="stat-widget-trend-arrow"
      style={{ color: arrowColor }}
    >
      {direction === 'up' ? '▲' : '▼'} {value}
      {label && <span className="stat-widget-trend-label">{label}</span>}
    </span>
  );
};

export const StatWidget: React.FC<IStatWidgetProps> = ({ title, dataConfig, options }) => {
  const [apiData, setApiData] = useState<any>({ value: '—' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { callApiMethod } = useApi();

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!dataConfig || !dataConfig.apiUrl) {
        setApiData({ value: '—' });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let data;
        const apiMethod = dataConfig.apiMethod || 'GET';
        const response = await callApiMethod({
          apiUrl: dataConfig.apiUrl,
          apiMethod,
          payload: dataConfig.payload,
          responseKey: dataConfig.responseKey,
          headers: dataConfig.headers,
        });
        // Use responseKey if provided, else use response.data
        data = dataConfig.responseKey ? response.data[dataConfig.responseKey] : response.data;
        if (isMounted) setApiData(data);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to fetch data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [dataConfig, callApiMethod]);

  // Enhanced icon rendering for background
  const renderBackgroundIcon = (icon: React.ReactNode | string | IStatWidgetIconConfig | undefined): React.ReactNode => {
    if (!icon) return null;
    let iconNode = null;
    if (typeof icon === 'object' && icon !== null && !(React.isValidElement(icon))) {
      const cfg = icon as IStatWidgetIconConfig;
      // Emoji
      if (cfg.emoji) {
        iconNode = <span style={{ fontSize: cfg.size || ICON_DEFAULT_SIZE }}>{cfg.emoji}</span>;
      } else if (cfg.url) {
        iconNode = <img src={cfg.url} alt="icon" style={{ width: cfg.size || ICON_DEFAULT_SIZE, height: cfg.size || ICON_DEFAULT_SIZE }} />;
      } else if (cfg.name && (AntIcons as any)[cfg.name]) {
        const IconComp = (AntIcons as any)[cfg.name];
        iconNode = <IconComp style={{ fontSize: cfg.size || ICON_DEFAULT_SIZE }} />;
      } else if (cfg.name) {
        iconNode = <span style={{ fontSize: cfg.size || ICON_DEFAULT_SIZE }}>{cfg.name}</span>;
      }
    } else if (typeof icon === 'string') {
      if (icon.startsWith('http') || icon.startsWith('/')) {
        iconNode = <img src={icon} alt="icon" style={{ width: ICON_DEFAULT_SIZE, height: ICON_DEFAULT_SIZE }} />;
      } else if ((AntIcons as any)[icon]) {
        const IconComp = (AntIcons as any)[icon];
        iconNode = <IconComp style={{ fontSize: ICON_DEFAULT_SIZE }} />;
      } else {
        iconNode = <span style={{ fontSize: ICON_DEFAULT_SIZE }}>{icon}</span>;
      }
    } else if (React.isValidElement(icon)) {
      iconNode = icon;
    }
    if (!iconNode) return null;
    return (
      <div className="stat-widget-bg-icon">
        {iconNode}
      </div>
    );
  };

  return (
    <div className="stat-widget-card">
      {options && 'icon' in options ? renderBackgroundIcon(options.icon) : null}
      <div className="stat-widget-header">
        <span className="stat-widget-title">
          {title}
        </span>
      </div>
      <div
        className="stat-widget-value-row"
        style={{ color: options?.color || undefined }}
      >
        {loading ? '...' : error ? <span style={{ color: 'red' }}>{error}</span> : apiData.value}
        {!loading && !error && apiData.trend && (
          <TrendArrow
            value={apiData.trend.value}
            direction={apiData.trend.direction}
            upColor={options?.trend?.upColor}
            downColor={options?.trend?.downColor}
            color={apiData.trend.color}
            label={apiData.trend.label || options?.trend?.label}
          />
        )}
      </div>
      {/* Bottom bar for secondary stat */}
      {!loading && !error && apiData.secondary && (
        <div className="stat-widget-secondary">
          <span>
            {(apiData.secondary.label || options?.secondary?.label) && <span>{apiData.secondary.label || options?.secondary?.label} </span>}
            {apiData.secondary.value && <span style={{ color: '#222', fontWeight: 500 }}>{apiData.secondary.value}</span>}
          </span>
          {apiData.secondary.trend && (
            <TrendArrow
              value={apiData.secondary.trend.value}
              direction={apiData.secondary.trend.direction}
              upColor={options?.secondary?.trend?.upColor}
              downColor={options?.secondary?.trend?.downColor}
              color={apiData.secondary.trend.color}
              label={apiData.secondary.trend.label || options?.secondary?.trend?.label}
            />
          )}
        </div>
      )}
    </div>
  );
}; 