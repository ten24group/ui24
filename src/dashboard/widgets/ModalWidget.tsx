import React from 'react';
import { Button } from 'antd';
import { OpenInModal, IModalConfig } from '../../modal/Modal';
import { Icon } from '../../core/common';
import './ModalWidget.css';

export interface IModalWidgetProps {
  title?: string;
  triggers: Array<{
    label: string;
    icon?: string;
    modalConfig: IModalConfig;
    buttonType?: 'primary' | 'default' | 'dashed' | 'text';
    color?: string;
  }>;
  layout?: 'grid' | 'list';
}

export const ModalWidget: React.FC<IModalWidgetProps> = ({
  title,
  triggers = [],
  layout = 'grid'
}) => {
  return (
    <div className={`modal-widget-card layout-${layout}`}>
      {title && <div className="modal-widget-header">{title}</div>}
      <div className="modal-widget-content">
        {triggers.map((trigger, idx) => (
          <div key={idx} className="modal-widget-trigger">
            <OpenInModal {...trigger.modalConfig}>
              <Button
                type={trigger.buttonType || 'default'}
                icon={trigger.icon ? <Icon iconName={trigger.icon} /> : undefined}
                style={{
                  ...(trigger.color && {
                    borderColor: trigger.color,
                    color: trigger.color
                  }),
                  width: layout === 'list' ? '100%' : undefined
                }}
              >
                {trigger.label}
              </Button>
            </OpenInModal>
          </div>
        ))}
      </div>
    </div>
  );
}; 