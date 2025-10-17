import React from 'react';
import { Switch, Button, Select, Slider } from 'antd';
import './ControlWidget.css';

export interface IControlWidgetProps {
  title?: string;
  controls: Array<{
    label: string;
    type: 'toggle' | 'button' | 'select' | 'slider';
    value?: any;
    options?: Array<{ label: string; value: any }>;
    onChange?: (value: any) => void;
    disabled?: boolean;
  }>;
  layout?: 'vertical' | 'horizontal';
}

export const ControlWidget: React.FC<IControlWidgetProps> = ({
  title,
  controls = [],
  layout = 'vertical'
}) => {
  const renderControl = (control: IControlWidgetProps[ 'controls' ][ 0 ], index: number) => {
    const { label, type, value, options, onChange, disabled } = control;

    switch (type) {
      case 'toggle':
        return (
          <div key={index} className="control-item">
            <label className="control-label">{label}</label>
            <Switch
              checked={value}
              onChange={(checked) => onChange?.(checked)}
              disabled={disabled}
            />
          </div>
        );

      case 'button':
        return (
          <div key={index} className="control-item">
            <Button
              type={value ? 'primary' : 'default'}
              onClick={() => onChange?.(!value)}
              disabled={disabled}
            >
              {label}
            </Button>
          </div>
        );

      case 'select':
        return (
          <div key={index} className="control-item">
            <label className="control-label">{label}</label>
            <Select
              value={value}
              onChange={(selectedValue) => onChange?.(selectedValue)}
              disabled={disabled}
              options={options}
              style={{ width: '100%' }}
            />
          </div>
        );

      case 'slider':
        return (
          <div key={index} className="control-item">
            <label className="control-label">{label}</label>
            <Slider
              value={value}
              onChange={(sliderValue) => onChange?.(sliderValue)}
              disabled={disabled}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`control-widget-card layout-${layout}`}>
      {title && <div className="control-widget-header">{title}</div>}
      <div className="control-widget-content">
        {controls.map(renderControl)}
      </div>
    </div>
  );
};
