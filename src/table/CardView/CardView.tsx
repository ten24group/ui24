/**
 * CardView — grid-based card view for table data (#119).
 *
 * Renders each record as an antd Card in a responsive Row/Col grid.
 * Supports enriched rendering: cover images, avatars, tags, status badges,
 * date display, action buttons, horizontal/vertical orientation, and dividers.
 */

import React, { useCallback } from 'react';
import { Card, Row, Col, Avatar, Empty, Typography, Tag, Badge, Divider, Button, Space } from 'antd';
import dayjs from 'dayjs';
import { getNestedValue } from '../../core/utils';
import type { CardGridConfig } from '../../core/common/ViewSwitcher/types';

const { Text, Paragraph } = Typography;

interface CardViewProps {
  records: Record<string, unknown>[];
  cardConfig: CardGridConfig;
  recordIdentifierKey: string;
  onRecordClick?: (record: Record<string, unknown>) => void;
  onActionClick?: (url: string, record: Record<string, unknown>) => void;
}

export const CardView: React.FC<CardViewProps> = React.memo(({
  records,
  cardConfig,
  recordIdentifierKey,
  onRecordClick,
  onActionClick,
}) => {
  const {
    columns = 3,
    titleField,
    descriptionField,
    imageField,
    avatarField,
    coverImageField,
    summaryFields,
    tagFields,
    dateField,
    statusField,
    statusMapping,
    actions,
    layout: cardLayout = 'vertical',
    showDivider = false,
  } = cardConfig;

  const resolveActionUrl = useCallback(
    (url: string, record: Record<string, unknown>): string => {
      const idKey = recordIdentifierKey;
      const idValue = String(getNestedValue(record, idKey) ?? '');
      let resolved = url.replace(':id', idValue).replace(`:${idKey}`, idValue);
      for (const [ key, val ] of Object.entries(record)) {
        if (typeof val === 'string' || typeof val === 'number') {
          resolved = resolved.replace(`:${key}`, String(val));
        }
      }
      return resolved;
    },
    [ recordIdentifierKey ]
  );

  if (!records.length) {
    return <Empty description="No records" />;
  }

  const colSpan = Math.floor(24 / columns);

  return (
    <Row gutter={[ 16, 16 ]}>
      {records.map((record, idx) => {
        const key = String(getNestedValue(record, recordIdentifierKey) ?? `card-${idx}`);
        const title = getNestedValue(record, titleField);
        const description = descriptionField ? getNestedValue(record, descriptionField) : null;
        const image = imageField ? getNestedValue(record, imageField) : null;
        const avatar = avatarField ? getNestedValue(record, avatarField) : null;
        const coverImage = coverImageField ? getNestedValue(record, coverImageField) : null;
        const date = dateField ? getNestedValue(record, dateField) : null;
        const statusValue = statusField ? String(getNestedValue(record, statusField) ?? '') : null;
        const statusBadge = statusValue && statusMapping
          ? statusMapping[ statusValue ]
          : null;

        const isHorizontal = cardLayout === 'horizontal';

        const coverElement = coverImage
          ? (
            <img
              alt=""
              src={String(coverImage)}
              style={{
                width: isHorizontal ? 120 : '100%',
                height: isHorizontal ? '100%' : 140,
                objectFit: 'cover',
                borderRadius: isHorizontal ? '6px 0 0 6px' : undefined,
                flexShrink: 0,
              }}
            />
          )
          : null;

        const bodyContent = (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Title row with avatar and status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {avatar && !coverImage && (
                <Avatar src={String(avatar)} size={32} style={{ flexShrink: 0 }} />
              )}
              {image && !avatar && !coverImage && (
                <Avatar src={String(image)} shape="square" size={40} style={{ flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong ellipsis style={{ fontSize: 14, display: 'block' }}>
                  {title != null ? String(title) : '—'}
                </Text>
                {statusBadge && (
                  <Badge
                    color={statusBadge.color}
                    text={<Text style={{ fontSize: 11 }}>{statusBadge.label ?? statusValue}</Text>}
                    style={{ marginTop: 2 }}
                  />
                )}
              </div>
            </div>

            {/* Description */}
            {description != null && (
              <Paragraph
                type="secondary"
                ellipsis={{ rows: 2 }}
                style={{ fontSize: 12, marginBottom: 0 }}
              >
                {String(description)}
              </Paragraph>
            )}

            {/* Date */}
            {date != null && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(String(date)).format('MMM D, YYYY')}
              </Text>
            )}

            {/* Tags */}
            {tagFields && tagFields.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {tagFields.map(({ field, colorMapping: tagColors }) => {
                  const val = getNestedValue(record, field);
                  if (val == null || val === '') return null;
                  const color = tagColors?.[ String(val) ];
                  return (
                    <Tag key={field} color={color} style={{ fontSize: 11, margin: 0 }}>
                      {String(val)}
                    </Tag>
                  );
                })}
              </div>
            )}

            {/* Divider before summary section */}
            {showDivider && summaryFields && summaryFields.length > 0 && (
              <Divider style={{ margin: '6px 0' }} />
            )}

            {/* Summary fields */}
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

            {/* Actions */}
            {actions && actions.length > 0 && (
              <Space size={4} style={{ marginTop: 4 }}>
                {actions.map((action, i) => (
                  <Button
                    key={i}
                    type="link"
                    size="small"
                    style={{ fontSize: 12, padding: '0 4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const resolved = resolveActionUrl(action.url, record);
                      onActionClick?.(resolved, record);
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </Space>
            )}
          </div>
        );

        if (isHorizontal) {
          return (
            <Col key={key} xs={24} sm={24} md={colSpan > 12 ? 24 : colSpan * 2} lg={colSpan > 12 ? 24 : colSpan * 2}>
              <Card
                hoverable={!!onRecordClick}
                onClick={onRecordClick ? () => onRecordClick(record) : undefined}
                size="small"
                styles={{ body: { padding: coverElement ? 0 : undefined } }}
                style={{ height: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  {coverElement}
                  <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
                    {bodyContent}
                  </div>
                </div>
              </Card>
            </Col>
          );
        }

        return (
          <Col key={key} xs={24} sm={12} md={colSpan} lg={colSpan}>
            <Card
              hoverable={!!onRecordClick}
              onClick={onRecordClick ? () => onRecordClick(record) : undefined}
              size="small"
              cover={coverElement}
              style={{ height: '100%' }}
            >
              {bodyContent}
            </Card>
          </Col>
        );
      })}
    </Row>
  );
});
