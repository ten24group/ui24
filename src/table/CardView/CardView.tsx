import React from 'react';
import { Card, Row, Col, Avatar, Empty, Typography } from 'antd';
import { getNestedValue } from '../../core/utils';

const { Text, Paragraph } = Typography;

interface CardConfig {
  columns?: number;
  titleField: string;
  descriptionField?: string;
  imageField?: string;
  summaryFields?: string[];
}

interface CardViewProps {
  records: Record<string, unknown>[];
  cardConfig: CardConfig;
  recordIdentifierKey: string;
  onRecordClick?: (record: Record<string, unknown>) => void;
}

/**
 * Grid-based card view for table data.
 * Renders each record as an antd Card in a responsive Row/Col grid.
 */
export const CardView: React.FC<CardViewProps> = ({
  records,
  cardConfig,
  recordIdentifierKey,
  onRecordClick,
}) => {
  const { columns = 3, titleField, descriptionField, imageField, summaryFields } = cardConfig;

  if (!records.length) {
    return <Empty description="No records" />;
  }

  const colSpan = Math.floor(24 / columns);

  return (
    <Row gutter={[16, 16]}>
      {records.map((record, idx) => {
        const key = String(getNestedValue(record, recordIdentifierKey) ?? `card-${idx}`);
        const title = getNestedValue(record, titleField);
        const description = descriptionField ? getNestedValue(record, descriptionField) : null;
        const image = imageField ? getNestedValue(record, imageField) : null;

        return (
          <Col key={key} xs={24} sm={12} md={colSpan} lg={colSpan}>
            <Card
              hoverable={!!onRecordClick}
              onClick={onRecordClick ? () => onRecordClick(record) : undefined}
              size="small"
              style={{ height: '100%' }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {image && (
                  <Avatar
                    src={String(image)}
                    shape="square"
                    size={48}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong ellipsis style={{ fontSize: 14, display: 'block' }}>
                    {title != null ? String(title) : '—'}
                  </Text>
                  {description != null && (
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ fontSize: 12, marginBottom: 8 }}
                    >
                      {String(description)}
                    </Paragraph>
                  )}
                  {summaryFields && summaryFields.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      {summaryFields.map((field) => {
                        const val = getNestedValue(record, field);
                        if (val == null) return null;
                        return (
                          <Text key={field} type="secondary" style={{ fontSize: 11 }}>
                            {field}: <Text style={{ fontSize: 11 }}>{String(val)}</Text>
                          </Text>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};
