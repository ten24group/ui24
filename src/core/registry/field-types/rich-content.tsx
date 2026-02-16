import React from 'react';
import { CustomBlockNoteEditor } from '../../common/';
import { CodeEditor } from '../../common/CodeEditor';
import { MarkdownPreview } from '../../common/MarkdownPreview';
import type { Block } from '@blocknote/core';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps } from './types';
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

export const richContentRegistrations: Record<string, FieldTypeRegistration> = {
  'rich-text': { form: RichTextForm, detail: RichTextDetail },
  wysiwyg: { form: RichTextForm, detail: RichTextDetail },
  code: { form: CodeForm },
  json: { form: JsonForm },
  markdown: { form: MarkdownForm, detail: MarkdownDetail },
};
