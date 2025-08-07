import React from 'react';
import { Progress } from 'antd';
import './ProgressWidget.css';

export interface IProgressWidgetProps {
  title?: string;
  progressType: 'circle' | 'line' | 'dashboard';
  value: number;
  total?: number;
  status?: 'normal' | 'exception' | 'active' | 'success';
  showPercent?: boolean;
  strokeColor?: string;
  label?: string;
  description?: string;
}

export const ProgressWidget: React.FC<IProgressWidgetProps> = ({
  title,
  progressType = 'line',
  value,
  total = 100,
  status = 'normal',
  showPercent = true,
  strokeColor,
  label,
  description
}) => {
  const percent = Math.round((value / total) * 100);

  return (
    <div className={`progress-widget-card type-${progressType}`}>
      {title && <div className="progress-widget-header">{title}</div>}
      <div className="progress-widget-content">
        {label && <div className="progress-widget-label">{label}</div>}

        <div className="progress-widget-display">
          {progressType === 'circle' ? (
            <Progress
              type="circle"
              percent={percent}
              status={status}
              strokeColor={strokeColor}
              format={showPercent ? undefined : () => ''}
              size={120}
            />
          ) : progressType === 'dashboard' ? (
            <Progress
              type="dashboard"
              percent={percent}
              status={status}
              strokeColor={strokeColor}
              format={showPercent ? undefined : () => ''}
              size={120}
            />
          ) : (
            <Progress
              percent={percent}
              status={status}
              strokeColor={strokeColor}
              showInfo={showPercent}
              strokeWidth={8}
            />
          )}
        </div>

        {description && (
          <div className="progress-widget-description">{description}</div>
        )}

        <div className="progress-widget-stats">
          <span className="progress-value">{value}</span>
          <span className="progress-separator">/</span>
          <span className="progress-total">{total}</span>
        </div>
      </div>
    </div>
  );
}; 