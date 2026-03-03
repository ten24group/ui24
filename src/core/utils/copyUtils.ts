import { message } from 'antd';
import { evaluateTemplateValue } from './template';
import type { Template } from '../types';
import type { MessageInstance } from 'antd/es/message/interface';

export interface CopyConfig {
  format?: 'json' | 'csv' | 'text';
  fields?: string[];
  template?: Template;
}

/** Strip internal metadata keys (prefixed with __) from a record. */
export function cleanRecord(r: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r).filter(([ k ]) => !k.startsWith('__')));
}

/** Escape a CSV cell value (wraps in quotes if it contains comma, quote, or newline). */
function escapeCsvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/**
 * Formats records according to copyConfig and writes to clipboard.
 * Provides user feedback via antd message API.
 * 
 * @param records - The records to copy
 * @param copyConfig - Configuration for copy format
 * @param messageApi - Optional context-aware message API from useAntdApp() hook
 */
export function executeCopyToClipboard<T extends Record<string, unknown>>(
  records: ReadonlyArray<T>,
  copyConfig: CopyConfig,
  messageApi?: MessageInstance
): void {
  if (records.length === 0) return;

  const { format = 'json', fields, template } = copyConfig;

  let text = '';

  if (format === 'json') {
    const data = records.map(r =>
      fields
        ? Object.fromEntries(fields.filter(f => f in r).map(f => [ f, r[ f ] ]))
        : cleanRecord(r)
    );
    text = JSON.stringify(data.length === 1 ? data[ 0 ] : data, null, 2);
  } else if (format === 'csv') {
    const selectedFields = fields || Object.keys(records[ 0 ]).filter(k => !k.startsWith('__'));
    const header = selectedFields.join(',');
    const rows = records.map(r =>
      selectedFields.map(f => escapeCsvCell(r[ f ])).join(',')
    );
    text = [ header, ...rows ].join('\n');
  } else {
    text = records.map(r =>
      template
        ? evaluateTemplateValue(template, r, '')
        : JSON.stringify(cleanRecord(r), null, 2)
    ).join('\n');
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      if (messageApi) {
        messageApi.success('Copied to clipboard');
      } else {
        // Fallback to static API (theme-unaware but functional)
        message.success('Copied to clipboard');
      }
    })
    .catch(() => {
      if (messageApi) {
        messageApi.error('Failed to copy');
      } else {
        // Fallback to static API (theme-unaware but functional)
        message.error('Failed to copy');
      }
    });
}
