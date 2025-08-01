import React from 'react';
import { Timeline } from 'antd';
import { Icon } from '../../core/common';
import dayjs from 'dayjs';
import './TimelineWidget.css';

export interface ITimelineWidgetProps {
  title?: string;
  events: Array<{
    timestamp: string;
    title: string;
    description?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    icon?: string;
    color?: string;
  }>;
  mode?: 'left' | 'alternate' | 'right';
  reverse?: boolean;
  maxEvents?: number;
}

export const TimelineWidget: React.FC<ITimelineWidgetProps> = ({
  title,
  events = [],
  mode = 'left',
  reverse = false,
  maxEvents = 10
}) => {
  const limitedEvents = maxEvents ? events.slice(0, maxEvents) : events;
  const sortedEvents = reverse ? [ ...limitedEvents ].reverse() : limitedEvents;

  const getColorFromType = (type?: string) => {
    switch (type) {
      case 'success': return '#52c41a';
      case 'warning': return '#faad14';
      case 'error': return '#ff4d4f';
      case 'info':
      default: return '#1890ff';
    }
  };

  const timelineItems = sortedEvents.map((event, index) => ({
    key: index,
    dot: event.icon ? <Icon iconName={event.icon} /> : undefined,
    color: event.color || getColorFromType(event.type),
    children: (
      <div className="timeline-event">
        <div className="timeline-event-header">
          <span className="timeline-event-title">{event.title}</span>
          <span className="timeline-event-time">
            {dayjs(event.timestamp).format('MMM D, YYYY h:mm A')}
          </span>
        </div>
        {event.description && (
          <div className="timeline-event-description">{event.description}</div>
        )}
      </div>
    )
  }));

  return (
    <div className="timeline-widget-card">
      {title && <div className="timeline-widget-header">{title}</div>}
      <div className="timeline-widget-content">
        <Timeline
          mode={mode}
          items={timelineItems}
        />
      </div>
    </div>
  );
}; 