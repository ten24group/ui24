import React from 'react';
import { Form } from '../../forms/Form';
import { IForm } from '../../core/forms/formConfig';
import './FormWidget.css';

export interface IFormWidgetProps extends IForm {
  title?: string;
  compact?: boolean;
  submitButtonText?: string;
}

export const FormWidget: React.FC<IFormWidgetProps> = ({
  title,
  compact = true,
  submitButtonText = 'Submit',
  formButtons,
  ...formProps
}) => {
  // Override form buttons if submitButtonText is provided
  const widgetFormButtons = submitButtonText ? [
    {
      text: submitButtonText,
      buttonType: 'primary' as const,
      htmlType: 'submit' as const
    }
  ] : formButtons;

  return (
    <div className={`form-widget-card ${compact ? 'compact' : ''}`}>
      {title && <div className="form-widget-header">{title}</div>}
      <div className="form-widget-content">
        <Form
          {...formProps}
          formButtons={widgetFormButtons}
        />
      </div>
    </div>
  );
}; 