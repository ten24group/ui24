import React from 'react';
import { Input, Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import { resolveAnchorProps } from '../../utils/link-utils';
import { MaskedInput } from '../../common/MaskedInput';
import { OpenInModal } from '../../../modal/Modal';
import { createModalConfig } from '../../../table/utils/modalConfigHelper';
import { generateContentPreview } from '../../utils/contentPreview';

const { TextArea } = Input;

// ============================================================================
// Helpers
// ============================================================================

/** Formats that trigger MaskedInput rendering */
const MASKED_FORMATS = new Set([ 'phone', 'ssn', 'zip', 'zipPlus4', 'creditCard', 'date', 'ein' ]);

/** Check if a field has mask or format that should trigger masked input */
const shouldUseMask = (props: BuiltInFormFieldProps): boolean => {
  if (props.mask) return true;
  return !!(props.format && MASKED_FORMATS.has(props.format));
};

// ============================================================================
// Form renderers
// ============================================================================

const TextForm: React.FC<BuiltInFormFieldProps> = (props) => {
  const { placeholder, prefixIcon, value, onChange, id, mask, format, maskOptions } = props;
  if (shouldUseMask(props)) {
    return <MaskedInput mask={mask} format={format} maskOptions={maskOptions} value={value} onChange={onChange} placeholder={placeholder} id={id} />;
  }
  return <Input type="text" prefix={prefixIcon} placeholder={placeholder} value={value} onChange={onChange} id={id} />;
};

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

const PhoneForm: React.FC<BuiltInFormFieldProps> = (props) => {
  const { placeholder, prefixIcon, value, onChange, id, mask, maskOptions } = props;
  // Phone fields default to masked input with phone preset
  return <MaskedInput mask={mask} format="phone" maskOptions={maskOptions} value={value} onChange={onChange} placeholder={placeholder || '(___) ___-____'} id={id} />;
};

const HiddenForm: React.FC<BuiltInFormFieldProps> = ({ value, onChange, id }) => <Input type="hidden" value={value} onChange={onChange} id={id} />;
const CustomForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, value, onChange, id }) => <Input placeholder={placeholder} value={value} onChange={onChange} id={id} />;
const LinkFormField: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input type="url" prefix={prefixIcon} placeholder={placeholder || "Enter URL"} value={value} onChange={onChange} id={id} />
);

// ============================================================================
// Detail renderers
// ============================================================================

const TextDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  if (value === null || value === undefined || value === '') return <span>—</span>;
  const str = String(value);
  if (str.match(/^https?:\/\//i)) {
    const { target, rel } = resolveAnchorProps(config.target, str);
    return <a href={str} target={target} rel={rel}>{str}</a>;
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

const UrlDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const str = String(value);
  const { target, rel } = resolveAnchorProps(config.target, str);
  return <a href={str} target={target} rel={rel}>{str}</a>;
};

const PhoneDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const str = String(value);
  return <a href={`tel:${str}`}>{str}</a>;
};

const CodeDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <div className="details-fixed-block">
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(value)}</pre>
    </div>
  );
};

// ============================================================================
// Table renderers
// ============================================================================

const TextTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const str = String(value);
  if (str.match(/^https?:\/\//i)) {
    const { target, rel } = resolveAnchorProps(column?.target, str);
    return <a href={str} target={target} rel={rel} style={{ color: '#1677ff' }}>{str.length > 30 ? str.substring(0, 30) + '...' : str}</a>;
  }
  return <>{str}</>;
};

const UrlTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const url = String(value);
  const { target, rel } = resolveAnchorProps(column?.target, url);
  return <a href={url} target={target} rel={rel} style={{ color: '#1677ff' }}>{url.length > 30 ? url.substring(0, 30) + '...' : url}</a>;
};

const PhoneTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  return <a href={`tel:${value}`} style={{ color: '#1677ff' }}>{String(value)}</a>;
};

const LinkTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const url = String(value);
  const { target, rel } = resolveAnchorProps(column?.target, url);
  return <a href={url} target={target} rel={rel} style={{ color: '#1677ff' }}>Link</a>;
};

/** Table renderer for textarea / longtext — inline if short, modal if long */
const TextareaTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const preview = generateContentPreview(value);
  if (!preview) return <span>—</span>;
  if (typeof value === 'string' && value.length < 50) return <span>{value}</span>;

  const dataKey = column?.column || column?.name || 'value';
  const detailsConfig = createModalConfig(
    column?.fieldType || 'textarea',
    value,
    { dataIndex: dataKey },
  );
  const columnName = (typeof column?.label === 'string' ? column.label : undefined) || dataKey;

  return (
    <OpenInModal modalType="details" modalTitle={columnName} modalWidth={800} modalPageConfig={detailsConfig}>
      <Button size="small" icon={<FileTextOutlined />} type="link">{preview}</Button>
    </OpenInModal>
  );
};

// ============================================================================
// Registrations
// ============================================================================

export const textRegistrations: Record<string, FieldTypeRegistration> = {
  text: {
    form: TextForm, detail: TextDetail, table: TextTable,
    defaults: { table: { ellipsis: true } },
  },
  textarea: {
    form: TextareaForm, detail: TextareaDetail, table: TextareaTable,
    defaults: { table: { ellipsis: true, width: 200 } },
  },
  password: { form: PasswordForm, detail: TextDetail },
  email: {
    form: EmailForm,
    detail: TextDetail,
    table: TextTable,
    defaults: {
      detail: { target: '_blank' },  // mailto link in detail
      table: { target: '_blank' },
    },
  },
  url: {
    form: UrlForm,
    detail: UrlDetail,
    table: UrlTable,
    defaults: {
      detail: { target: '_blank' },
      table: { target: '_blank' },
    },
  },
  phone: { form: PhoneForm, detail: PhoneDetail, table: PhoneTable },
  hidden: { form: HiddenForm },
  custom: { form: CustomForm, detail: TextDetail },
  link: {
    form: LinkFormField,
    detail: UrlDetail,
    table: LinkTable,
    defaults: {
      detail: { target: '_blank' },
      table: { target: '_blank' },
    },
  },
  longtext: {
    form: TextareaForm, detail: TextareaDetail, table: TextareaTable,
    defaults: { table: { ellipsis: true, width: 200 } },
  },
  code: { detail: CodeDetail },
};
