import React from 'react';
import { Button, Input, Modal } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import { MarkdownPreview } from '../../common/MarkdownPreview';

/** Resolve embedConfig from field config */
function getEmbedConfig(config: Record<string, unknown>): { type: 'iframe' | 'markdown'; height: number; sandbox: string } {
  const raw = config.embedConfig as Record<string, unknown> | undefined;
  return {
    type: (raw?.type as 'iframe' | 'markdown') || 'iframe',
    height: (raw?.height as number) || 400,
    sandbox: (raw?.sandbox as string) || 'allow-scripts',
  };
}

/** Form: URL input for editing, read-only link preview when disabled */
const EmbedForm: React.FC<BuiltInFormFieldProps> = ({ value, onChange, readOnly, placeholder }) => {
  if (readOnly) {
    if (!value) return <span style={{ color: '#8c8c8c' }}>No content</span>;
    return (
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, background: '#fafafa' }}>
        <a href={String(value)} target="_blank" rel="noopener noreferrer">
          <LinkOutlined /> {String(value)}
        </a>
      </div>
    );
  }

  return (
    <Input
      value={value ? String(value) : ''}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder || 'Enter URL or content...'}
      prefix={<LinkOutlined />}
      allowClear
    />
  );
};

/** Detail: render iframe or markdown content */
const EmbedDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  if (!value) return <span>—</span>;

  const embed = getEmbedConfig(config as Record<string, unknown>);

  if (embed.type === 'markdown') {
    return (
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12, maxHeight: embed.height, overflow: 'auto' }}>
        <MarkdownPreview value={String(value)} />
      </div>
    );
  }

  return (
    <iframe
      src={String(value)}
      sandbox={embed.sandbox}
      style={{ width: '100%', height: embed.height, border: '1px solid #f0f0f0', borderRadius: 6 }}
      title="Embedded content"
    />
  );
};

/** Table: show "View" button that opens content in a modal */
const EmbedTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  const [open, setOpen] = React.useState(false);

  if (!value) return <span>—</span>;

  const embed = getEmbedConfig(column as Record<string, unknown>);
  const label = String(value).length > 40 ? String(value).slice(0, 40) + '…' : String(value);

  return (
    <>
      <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={800}
        title="Embedded Content"
        destroyOnClose
      >
        {embed.type === 'markdown' ? (
          <MarkdownPreview value={String(value)} />
        ) : (
          <iframe
            src={String(value)}
            sandbox={embed.sandbox}
            style={{ width: '100%', height: embed.height, border: 'none' }}
            title="Embedded content"
          />
        )}
      </Modal>
    </>
  );
};

export const embedRegistrations: Record<string, FieldTypeRegistration> = {
  embed: { form: EmbedForm, detail: EmbedDetail, table: EmbedTable },
};
