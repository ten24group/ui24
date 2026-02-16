import React from 'react';
import { Input } from 'antd';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

const { TextArea } = Input;

const TextForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input type="text" prefix={prefixIcon} placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const TextareaForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, value, onChange, id }) => (
  <TextArea placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const PasswordForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input.Password type="password" prefix={prefixIcon} placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const EmailForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input type="email" prefix={prefixIcon} placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const UrlForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input type="url" prefix={prefixIcon} placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const PhoneForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input type="tel" prefix={prefixIcon} placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const HiddenForm: React.FC<BuiltInFormFieldProps> = ({ value, onChange, id }) => <Input type="hidden" value={value} onChange={onChange} id={id} />;
const CustomForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, value, onChange, id }) => <Input placeholder={placeholder} value={value} onChange={onChange} id={id} />;

// Detail renderers
const TextDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (value === null || value === undefined || value === '') return <span>—</span>;
  const str = String(value);
  if (str.match(/^https?:\/\//i)) {
    return <a href={str} target="_blank" rel="noopener noreferrer">{str}</a>;
  }
  if (str.length > 100) {
    return (
      <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%' }}>
        {str}
      </div>
    );
  }
  return <>{str}</>;
};

const TextareaDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <div className="details-fixed-block">
      <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>{String(value)}</div>
    </div>
  );
};

const UrlDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const str = String(value);
  return <a href={str} target="_blank" rel="noopener noreferrer">{str}</a>;
};

const PhoneDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const str = String(value);
  return <a href={`tel:${str}`}>{str}</a>;
};

const LinkFormField: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input type="url" prefix={prefixIcon} placeholder={placeholder || "Enter URL"} value={value} onChange={onChange} id={id} />
);

const CodeDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <div className="details-fixed-block">
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(value)}</pre>
    </div>
  );
};

// Table renderers
import type { BuiltInTableFieldProps } from './types';

const TextTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const str = String(value);
  if (str.match(/^https?:\/\//i)) {
    return <a href={str} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>{str.length > 30 ? str.substring(0, 30) + '...' : str}</a>;
  }
  return <>{str}</>;
};

const UrlTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  const url = String(value);
  return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>{url.length > 30 ? url.substring(0, 30) + '...' : url}</a>;
};

const PhoneTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  return <a href={`tel:${value}`} style={{ color: '#1677ff' }}>{String(value)}</a>;
};

const LinkTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  const url = String(value);
  return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>Link</a>;
};

export const textRegistrations: Record<string, FieldTypeRegistration> = {
  text: { form: TextForm, detail: TextDetail, table: TextTable },
  textarea: { form: TextareaForm, detail: TextareaDetail },
  password: { form: PasswordForm, detail: TextDetail },
  email: { form: EmailForm, detail: TextDetail, table: TextTable },
  url: { form: UrlForm, detail: UrlDetail, table: UrlTable },
  phone: { form: PhoneForm, detail: PhoneDetail, table: PhoneTable },
  hidden: { form: HiddenForm },
  custom: { form: CustomForm, detail: TextDetail },
  link: { form: LinkFormField, detail: UrlDetail, table: LinkTable },
  code: { detail: CodeDetail },
};
