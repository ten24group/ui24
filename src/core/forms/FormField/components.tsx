import React from 'react';
import { Typography, Tooltip, Popover, Button } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { formStyles } from './styles';
import type { IHelpConfig } from '../../types/field-config';

const { Text } = Typography;

/**
 * Normalizes legacy `helpText` + `tooltip` fields into a single `IHelpConfig`.
 * 
 * Resolution priority:
 * 1. Explicit `help` config (if present, returned as-is)
 * 2. Legacy `helpText` → `help.description` with `placement: 'below'`
 * 3. Legacy `tooltip` → `help.tooltip` with `placement: 'tooltip'`
 * 
 * Returns `undefined` when no help info is present.
 */
export function resolveHelpConfig(
  item: { helpText?: string; tooltip?: string; help?: IHelpConfig }
): IHelpConfig | undefined {
  if (item.help) return item.help;
  if (!item.helpText && !item.tooltip) return undefined;

  return {
    description: item.helpText,
    tooltip: item.tooltip,
    placement: item.tooltip ? 'tooltip' : 'below',
  };
}

/**
 * HelpText component — renders below-field help text.
 * Returns null for tooltip/popover placement (those are handled by HelpIcon).
 */
export const HelpText: React.FC<{ help?: IHelpConfig }> = ({ help }) => {
  if (!help) return null;
  if (help.placement && help.placement !== 'below') return null;

  const text = help.description;
  if (!text) return null;

  return (
    <Text
      type="secondary"
      style={{
        ...formStyles.helpText,
        marginBottom: '8px',
      }}
    >
      {text}
    </Text>
  );
};

/**
 * Inline help icon rendered next to a field label.
 * Shows a tooltip or popover depending on `help.placement`.
 * Returns null if no tooltip/popover help is configured.
 */
export const HelpIcon: React.FC<{ help?: IHelpConfig }> = ({ help }) => {
  if (!help) return null;

  const iconStyle: React.CSSProperties = { marginLeft: 4, fontSize: 13, color: 'var(--ant-color-text-tertiary, #8c8c8c)', cursor: 'help' };

  if (help.placement === 'tooltip') {
    return (
      <Tooltip title={help.tooltip || help.description}>
        <InfoCircleOutlined style={iconStyle} />
      </Tooltip>
    );
  }

  if (help.placement === 'popover') {
    const content = (
      <div style={{ maxWidth: 280 }}>
        {help.description && <div>{help.description}</div>}
        {help.docsUrl && (
          <a href={help.docsUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 8, display: 'inline-block' }}>
            View documentation
          </a>
        )}
      </div>
    );

    return (
      <Popover content={content} title={help.tooltip} trigger="click">
        <InfoCircleOutlined style={iconStyle} />
      </Popover>
    );
  }

  return null;
};

/** Reusable Label + Help (icon & text) wrapper */
export const LabelAndHelpText: React.FC<{ label: string; help?: IHelpConfig }> = ({ label, help }) => {
  if (!label) return null;

  return (
    <div style={formStyles.labelContainer}>
      <div style={{ fontWeight: 500, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
        {label}
        <HelpIcon help={help} />
      </div>
      <HelpText help={help} />
    </div>
  );
};

// Reusable Form Column component
export const FormColumn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="form-column" style={formStyles.column}>
      {children}
    </div>
  );
};

// Reusable Form Container component
export const FormContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div style={formStyles.container}>
      {children}
    </div>
  );
}; 