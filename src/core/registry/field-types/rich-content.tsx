import React from 'react';
import { Button } from 'antd';
import { EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import { CustomBlockNoteEditor } from '../../common/';
import { CodeEditor } from '../../common/CodeEditor';
import { MarkdownPreview } from '../../common/MarkdownPreview';
import { OpenInModal } from '../../../modal/Modal';
import { createModalConfig } from '../../../table/utils/modalConfigHelper';
import { generateContentPreview } from '../../utils/contentPreview';
import { generateJsonPreview } from '../../utils/jsonUtils';
import type { Block } from '@blocknote/core';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

interface CodeEditorFormControlProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: 'json' | 'html' | 'javascript' | 'handlebars' | 'text' | 'markdown';
  height?: number;
  readOnly?: boolean;
  darkTheme?: boolean;
  placeholder?: string;
  lineNumbers?: boolean;
  validateJson?: boolean;
}

const CodeEditorFormControl: React.FC<CodeEditorFormControlProps> = ({ value, onChange, ...restProps }) => (
  <CodeEditor value={value || ''} onChange={onChange} {...restProps} />
);

const RichTextForm: React.FC<BuiltInFormFieldProps> = ({ theme, readOnly, fileNamePrefix, getSignedUploadUrlAPIConfig, uploadFile, value, onChange }) => {
  const resolvedTheme = theme === 'light' || theme === 'dark' ? theme : undefined;
  return (
    <CustomBlockNoteEditor
      theme={resolvedTheme}
      readOnly={readOnly ?? undefined}
      fileNamePrefix={fileNamePrefix ?? undefined}
      getSignedUploadUrlAPIConfig={getSignedUploadUrlAPIConfig ?? undefined}
      uploadFile={uploadFile ?? undefined}
      value={value}
      onChange={onChange}
    />
  );
};

const CodeForm: React.FC<BuiltInFormFieldProps> = ({ codeLanguage, height, readOnly, darkTheme, placeholder, lineNumbers, validateJson, value, onChange }) => (
  <CodeEditorFormControl
    language={codeLanguage || 'text'}
    height={height ?? 300}
    readOnly={readOnly ?? false}
    darkTheme={darkTheme ?? false}
    placeholder={placeholder}
    lineNumbers={lineNumbers ?? true}
    validateJson={validateJson ?? true}
    value={value}
    onChange={onChange}
  />
);

const JsonForm: React.FC<BuiltInFormFieldProps> = ({ height, readOnly, darkTheme, placeholder, lineNumbers, validateJson, value, onChange }) => (
  <CodeEditorFormControl
    language="json"
    height={height ?? 300}
    readOnly={readOnly ?? false}
    darkTheme={darkTheme ?? false}
    placeholder={placeholder}
    lineNumbers={lineNumbers ?? true}
    validateJson={validateJson ?? true}
    value={value}
    onChange={onChange}
  />
);

const MarkdownForm: React.FC<BuiltInFormFieldProps> = ({ readOnly, height, darkTheme, placeholder, lineNumbers, value, onChange }) => {
  if (readOnly) {
    return <MarkdownPreview value={value} />;
  }
  return (
    <CodeEditorFormControl
      language="markdown"
      height={height ?? 300}
      readOnly={false}
      darkTheme={darkTheme ?? false}
      placeholder={placeholder}
      lineNumbers={lineNumbers ?? true}
      validateJson={false}
      value={value}
      onChange={onChange}
    />
  );
};

// Detail renderers
const RichTextDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  const blocks = Array.isArray(value) ? value as Block[] : undefined;
  return (
    <div className="details-fixed-block">
      <CustomBlockNoteEditor value={blocks} readOnly={true} />
    </div>
  );
};

const MarkdownDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => (
  <div className="details-fixed-block">
    <MarkdownPreview value={typeof value === 'string' ? value : String(value ?? '')} />
  </div>
);

// ============================================================================
// Table renderers (modal-based preview)
// ============================================================================

/** Resolve the data key from column config (table columns pass name/column, not dataIndex) */
const getDataKey = (column: BuiltInTableFieldProps['column']): string =>
  column?.column || column?.name || 'value';

/** Resolve a displayable column name from column config */
const getColumnName = (column: BuiltInTableFieldProps['column'], fallback: string): string =>
  (typeof column?.label === 'string' ? column.label : undefined) || getDataKey(column) || fallback;

const RichTextTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const preview = generateContentPreview(value);
  const detailsConfig = createModalConfig('rich-text', value, { dataIndex: getDataKey(column) });

  return (
    <OpenInModal modalType="details" modalTitle={getColumnName(column, 'Content')} modalWidth={900} modalPageConfig={detailsConfig}>
      <Button size="small" icon={<EyeOutlined />} type="link">
        {preview || 'View Content'}
      </Button>
    </OpenInModal>
  );
};

const CodeTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const preview = generateContentPreview(value);
  if (!preview) return <span>—</span>;
  if (typeof value === 'string' && value.length < 50) return <span>{value}</span>;

  const detailsConfig = createModalConfig('code', value, { dataIndex: getDataKey(column) });

  return (
    <OpenInModal modalType="details" modalTitle={getColumnName(column, 'Code')} modalWidth={800} modalPageConfig={detailsConfig}>
      <Button size="small" icon={<FileTextOutlined />} type="link">{preview}</Button>
    </OpenInModal>
  );
};

const JsonTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value || (typeof value === 'object' && Object.keys(value as object).length === 0)) {
    return <span>—</span>;
  }
  const previewLabel = generateJsonPreview(value, { maxStringLength: 20, maxKeys: 2 });
  const detailsConfig = createModalConfig('json', value, { dataIndex: getDataKey(column) }, 'map');

  return (
    <OpenInModal modalType="details" modalTitle={getColumnName(column, 'JSON')} modalWidth={800} modalPageConfig={detailsConfig}>
      <Button
        size="small"
        icon={<FileTextOutlined />}
        type="link"
        style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace', fontSize: '12px' }}
      >
        {previewLabel}
      </Button>
    </OpenInModal>
  );
};

const MarkdownTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const preview = generateContentPreview(value);
  if (!preview) return <span>—</span>;
  if (typeof value === 'string' && value.length < 50) return <span>{value}</span>;

  const detailsConfig = createModalConfig('markdown', value, { dataIndex: getDataKey(column) });

  return (
    <OpenInModal modalType="details" modalTitle={getColumnName(column, 'Markdown')} modalWidth={800} modalPageConfig={detailsConfig}>
      <Button size="small" icon={<FileTextOutlined />} type="link">{preview}</Button>
    </OpenInModal>
  );
};

// ============================================================================
// Registrations
// ============================================================================

export const richContentRegistrations: Record<string, FieldTypeRegistration> = {
  'rich-text': { form: RichTextForm, detail: RichTextDetail, table: RichTextTable },
  wysiwyg: { form: RichTextForm, detail: RichTextDetail, table: RichTextTable },
  code: { form: CodeForm, table: CodeTable },
  json: { form: JsonForm, table: JsonTable },
  markdown: { form: MarkdownForm, detail: MarkdownDetail, table: MarkdownTable },
};
