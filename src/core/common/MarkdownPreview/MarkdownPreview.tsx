/**
 * MarkdownPreview - Component for rendering markdown content as rich HTML
 * 
 * Uses react-markdown with GitHub Flavored Markdown support for proper rendering
 * of bold, italic, links, images, code blocks, tables, lists, and more.
 * 
 * @example
 * <MarkdownPreview value={markdownContent} />
 */

import React from 'react';
import { Typography } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import './MarkdownPreview.css';

const { Paragraph } = Typography;

export interface MarkdownPreviewProps {
  /** Markdown content to render */
  value?: string;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  value = '',
  className,
  style
}) => {
  if (!value) {
    return (
      <Paragraph type="secondary" style={style} className={className}>
        <em>No content</em>
      </Paragraph>
    );
  }

  return (
    <div
      className={`markdown-preview ${className || ''}`}
      style={{
        padding: '16px',
        backgroundColor: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        minHeight: '50px',
        ...style
      }}
    >
      <ReactMarkdown
        remarkPlugins={[ remarkGfm ]}
        rehypePlugins={[ rehypeRaw, rehypeSanitize ]}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
