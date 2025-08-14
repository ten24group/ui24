import React from 'react';
import { Typography } from 'antd';
import { formStyles } from './styles';

const { Text } = Typography;

// Reusable HelpText component
export const HelpText: React.FC<{ helpText?: string }> = ({ helpText }) => {
  if (!helpText) return null;
  
  return (
    <Text 
      type="secondary" 
      style={{
        ...formStyles.helpText,
        marginBottom: '8px', // Consistent spacing for Details component
      }}
    >
      {helpText}
    </Text>
  );
};

// Reusable Label and HelpText component
export const LabelAndHelpText: React.FC<{ label: string, helpText?: string }> = ({ label, helpText }) => {
  if (!label) return null;
  
  return (
    <div style={formStyles.labelContainer}>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <HelpText helpText={helpText} />
    </div>
  );
};

// Reusable Form Column component
export const FormColumn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      className="form-column"
      style={{
        ...formStyles.column,
        ...formStyles.card,
      }}
    >
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