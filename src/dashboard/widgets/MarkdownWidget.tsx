import React from 'react';
import { Card } from 'antd';
import { MarkdownPreview } from '../../core/common/MarkdownPreview';

export interface IMarkdownWidgetProps {
  title?: string;
  description?: string;
  options?: {
    content?: string;
    showBorder?: boolean;
    padding?: number;
  };
}

export const MarkdownWidget: React.FC<IMarkdownWidgetProps> = ({
  title,
  description,
  options = {}
}) => {
  const content = options.content || description || '';
  const showBorder = options.showBorder !== false;
  const padding = options.padding ?? 16;

  return (
    <Card
      title={title}
      bordered={showBorder}
      style={{ height: '100%' }}
      styles={{ body: { padding: `${padding}px` } }}
    >
      <MarkdownPreview
        value={content}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0
        }}
      />
    </Card>
  );
};
