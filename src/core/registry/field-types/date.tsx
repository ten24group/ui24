import React from 'react';
import { DatePicker, TimePicker } from 'antd';
import { DateTimeZoneChrome } from '../../components/DateTimeZoneChrome';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import type { TemporalFieldKind } from '../../components/DateTimeZoneChrome';

const DateForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => (
  <DatePicker format={formatConfig?.date} value={value} onChange={onChange} id={id} />
);

const DatetimeForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => (
  <DatePicker format={formatConfig?.datetime} showTime value={value} onChange={onChange} id={id} />
);

const TimeForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => (
  <TimePicker format={formatConfig?.time} value={value} onChange={onChange} id={id} />
);

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
