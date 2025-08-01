import React from 'react';
import { Details, IDetailsConfig } from '../../detail/Details';
import './DetailWidget.css';

export interface IDetailWidgetProps extends IDetailsConfig {
  title?: string;
  layout?: 'horizontal' | 'vertical';
  maxFields?: number;
}

export const DetailWidget: React.FC<IDetailWidgetProps> = ({
  title,
  layout = 'horizontal',
  maxFields = 6,
  ...detailProps
}) => {
  // Limit properties config if maxFields is specified
  const limitedProps = maxFields ? {
    ...detailProps,
    propertiesConfig: detailProps.propertiesConfig?.slice(0, maxFields) || []
  } : detailProps;

  return (
    <div className={`detail-widget-card layout-${layout}`}>
      {title && <div className="detail-widget-header">{title}</div>}
      <div className="detail-widget-content">
        <Details {...limitedProps} />
      </div>
    </div>
  );
}; 