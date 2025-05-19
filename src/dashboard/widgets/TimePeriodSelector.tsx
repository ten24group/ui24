import React from 'react';
import { Button, DatePicker, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezonePlugin from 'dayjs/plugin/timezone';
import { useUi24Config } from '../../core/context';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

const { RangePicker } = DatePicker;

export type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface TimePeriodSelectorProps {
  value: { period: TimePeriod; range: [Dayjs, Dayjs] };
  onChange: (value: { period: TimePeriod; range: [Dayjs, Dayjs] }) => void;
  style?: React.CSSProperties;
  timezone?: string;
}

const periodOptions = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
];

export const TimePeriodSelector: React.FC<TimePeriodSelectorProps> = ({ value, onChange, style, timezone }) => {
  const { selectConfig } = useUi24Config();
  const formatConfigTz = selectConfig(config => config.formatConfig?.timezone);
  const resolvedTz = timezone || formatConfigTz;

  const handlePeriodClick = (period: TimePeriod) => {
    let range: [Dayjs, Dayjs];
    const now = dayjs().tz(resolvedTz);
    switch (period) {
      case 'today':
        range = [now.startOf('day'), now.endOf('day')];
        break;
      case 'week':
        range = [now.startOf('week'), now.endOf('week')];
        break;
      case 'month':
        range = [now.startOf('month'), now.endOf('month')];
        break;
      case 'year':
        range = [now.startOf('year'), now.endOf('year')];
        break;
      default:
        range = value.range;
    }
    onChange({ period, range });
  };

  const handleRangeChange = (dates: null | [Dayjs, Dayjs]) => {
    if (dates) {
      // Ensure picked dates are in the correct timezone
      const [start, end] = dates;
      onChange({ period: 'custom', range: [start.tz(resolvedTz), end.tz(resolvedTz)] });
    }
  };

  return (
    <Space style={style}>
      {periodOptions.map(opt => (
        <Button
          key={opt.value}
          type={value.period === opt.value ? 'primary' : 'default'}
          onClick={() => handlePeriodClick(opt.value as TimePeriod)}
        >
          {opt.label}
        </Button>
      ))}
      <RangePicker
        value={value.range}
        onChange={handleRangeChange}
        allowClear={false}
        style={{ minWidth: 220 }}
        showTime={false}
      />
    </Space>
  );
}; 