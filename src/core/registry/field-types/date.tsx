import React, { useCallback } from 'react';
import { DatePicker, TimePicker } from 'antd';
import { DateTimeZoneChrome } from '../../components/DateTimeZoneChrome';
import { dayjsCustom } from '../../dayjs';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import type { TemporalFieldKind } from '../../components/DateTimeZoneChrome';

/** Wall-clock layout the pickers round-trip through; carries no offset of its own. */
const WALL_CLOCK = 'YYYY-MM-DDTHH:mm:ss';

/**
 * Re-reads a picked value as UTC while keeping the digits the user actually saw.
 *
 * antd builds its values with the browser's zone, so a fresh pick of 09:00 in a
 * UTC-4 browser serialises through `toISOString()` as 13:00Z -- the form would
 * store an instant nobody typed, shifted by whatever zone the editor happens to
 * sit in. Reading the formatted wall clock back as UTC keeps 09:00 as 09:00Z.
 *
 * Values arriving from the API are already UTC-mode (see Form.tsx), and
 * formatting then re-parsing those is a no-op, so this is safe to apply to every
 * change regardless of where the value came from.
 */
const toUtcWallClock = (value: any) => {
  if (!value || typeof value.format !== 'function') {
    return value;
  }

  return dayjsCustom.utc(value.format(WALL_CLOCK), WALL_CLOCK);
};

/** Shares the normalising onChange across the three temporal pickers. */
const useUtcWallClockChange = (onChange?: (...args: any[]) => void) =>
  useCallback((value: any, ...rest: any[]) => {
    onChange?.(toUtcWallClock(value), ...rest);
  }, [ onChange ]);

const DateForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => {
  const handleChange = useUtcWallClockChange(onChange);

  return <DatePicker format={formatConfig?.date} value={value} onChange={handleChange} id={id} />;
};

const DatetimeForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => {
  const handleChange = useUtcWallClockChange(onChange);

  return <DatePicker format={formatConfig?.datetime} showTime value={value} onChange={handleChange} id={id} />;
};

const TimeForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => {
  const handleChange = useUtcWallClockChange(onChange);

  return <TimePicker format={formatConfig?.time} value={value} onChange={handleChange} id={id} />;
};

const TemporalDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const kind = (config.fieldType || 'datetime').toLowerCase() as TemporalFieldKind;
  return (
    <DateTimeZoneChrome
      value={value}
      kind={kind}
      sourceTimezone={config.timezone}
    />
  );
};

const TemporalTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  const kind = (column.fieldType || 'datetime').toLowerCase() as TemporalFieldKind;
  return (
    <DateTimeZoneChrome
      value={value}
      kind={kind}
      sourceTimezone={column.timezone}
      compact
    />
  );
};

export const dateRegistrations: Record<string, FieldTypeRegistration> = {
  date: {
    form: DateForm,
    detail: TemporalDetail,
    table: TemporalTable,
    defaults: { table: { ellipsis: false, width: 160 } },
  },
  datetime: {
    form: DatetimeForm,
    detail: TemporalDetail,
    table: TemporalTable,
    defaults: { table: { ellipsis: false, width: 200 } },
  },
  time: {
    form: TimeForm,
    detail: TemporalDetail,
    table: TemporalTable,
    defaults: { table: { ellipsis: false, width: 140 } },
  },
};
