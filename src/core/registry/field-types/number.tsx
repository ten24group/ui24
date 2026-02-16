import React from 'react';
import { Input, InputNumber, Slider, Rate } from 'antd';
import { formatDuration, formatTTL } from '../../utils/duration';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import { MaskedInput } from '../../common/MaskedInput';

const NumberForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, prefixIcon, value, onChange, id }) => (
  <Input type="number" prefix={prefixIcon} placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const CurrencyForm: React.FC<BuiltInFormFieldProps> = (props) => {
  const { placeholder, currencySymbol, precision, value, onChange, id, mask, maskOptions } = props;
  if (mask) {
    return <MaskedInput mask={mask} format="currency" maskOptions={maskOptions} value={value} onChange={onChange} placeholder={placeholder} id={id} />;
  }
  return (
    <InputNumber
      prefix={currencySymbol || '$'}
      placeholder={placeholder}
      style={{ width: '100%' }}
      precision={precision || 2}
      value={value}
      onChange={onChange}
      id={id}
    />
  );
};

const PercentageForm: React.FC<BuiltInFormFieldProps> = (props) => {
  const { placeholder, min, max, value, onChange, id, mask, maskOptions } = props;
  if (mask) {
    return <MaskedInput mask={mask} format="percentage" maskOptions={maskOptions} value={value} onChange={onChange} placeholder={placeholder} id={id} />;
  }
  return (
    <InputNumber
      min={min ?? 0}
      max={max ?? 100}
      formatter={(v) => `${v}%`}
      parser={(v) => {
        const parsed = v?.replace('%', '');
        return parsed ? Number(parsed) : 0;
      }}
      placeholder={placeholder}
      style={{ width: '100%' }}
      value={value}
      onChange={onChange}
      id={id}
    />
  );
};

const SliderForm: React.FC<BuiltInFormFieldProps> = ({ min, max, step, marks, vertical, value, onChange, id }) => (
  <Slider
    min={min ?? 0}
    max={max ?? 100}
    step={step ?? 1}
    marks={marks}
    vertical={vertical}
    value={value}
    onChange={onChange}
    id={id}
  />
);

const RangeForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, value, onChange, id }) => (
  <Input type="range" placeholder={placeholder} value={value} onChange={onChange} id={id} />
);

const RatingForm: React.FC<BuiltInFormFieldProps> = ({ value, onChange, id, count }) => (
  <Rate allowHalf count={count} value={value} onChange={onChange} id={id} />
);

const DurationForm: React.FC<BuiltInFormFieldProps> = ({ value, onChange, id }) => (
  <InputNumber placeholder="Duration in seconds" style={{ width: '100%' }} min={0} value={value} onChange={onChange} id={id} />
);

const ProgressForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, min, max, value, onChange, id }) => (
  <InputNumber
    min={min ?? 0}
    max={max ?? 100}
    formatter={(v) => `${v}%`}
    parser={(v) => {
      const parsed = v?.replace('%', '');
      return parsed ? Number(parsed) : 0;
    }}
    placeholder={placeholder}
    style={{ width: '100%' }}
    value={value}
    onChange={onChange}
    id={id}
  />
);

// Detail renderers
const NumberDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => <div>{Number(value)}</div>;

const CurrencyDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: config.currencySymbol || 'USD',
  }).format(Number(value) || 0);
  return <div>{formatted}</div>;
};

const PercentageDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => <div>{Number(value)}%</div>;
const RangeDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => <div>{`${value}%`}</div>;
const RatingDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => <div>{`${value}/5`}</div>;

const SliderDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <Slider
      value={Number(value)}
      disabled
      style={{ flex: 1 }}
      min={config.min}
      max={config.max}
    />
    <span>{String(value)}</span>
  </div>
);

const DurationDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const durationValue = formatDuration(
    value,
    config.durationUnit || 'seconds',
    config.durationFormat || 'auto'
  );
  return <div>{durationValue}</div>;
};

const TTLDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const [ttlValue, setTtlValue] = React.useState(() =>
    formatTTL(value, config.ttlUnit || 'seconds', config.ttlFormat || 'auto')
  );
  const isExpired = ttlValue === 'expired';
  const refreshInterval = config.ttlAutoRefresh;

  React.useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0 || isExpired) return;

    const interval = setInterval(() => {
      const newValue = formatTTL(value, config.ttlUnit || 'seconds', config.ttlFormat || 'auto');
      setTtlValue(newValue);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval, isExpired, value, config.ttlUnit, config.ttlFormat]);

  return (
    <div style={{
      color: isExpired ? '#ff4d4f' : undefined,
      fontWeight: isExpired ? 500 : undefined
    }}>
      {ttlValue}
    </div>
  );
};

// Table renderers
import type { BuiltInTableFieldProps } from './types';

const NumberTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? <span>—</span> : <span>{num.toLocaleString()}</span>;
};

const RangeTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  return <span>{String(value)}%</span>;
};

const RatingTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const rating = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(rating)) return <span>—</span>;
  return <Rate disabled value={rating} style={{ fontSize: 14 }} />;
};

const CurrencyTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return <span>—</span>;
  return <span>${num.toFixed(2)}</span>;
};

const PercentageTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  return <span>{Number(value)}%</span>;
};

const SliderTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  return <span>{String(value)}</span>;
};

const DurationTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  return <span>{formatDuration(value, column.durationUnit || 'seconds', column.durationFormat || 'auto')}</span>;
};

const TTLTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  const [ttlValue, setTtlValue] = React.useState(() =>
    formatTTL(value, column.ttlUnit || 'seconds', column.ttlFormat || 'auto')
  );
  const isExpired = ttlValue === 'expired';
  const autoRefresh = column.ttlAutoRefresh;

  React.useEffect(() => {
    if (!autoRefresh || autoRefresh <= 0 || isExpired) return;
    const interval = setInterval(() => {
      const newValue = formatTTL(value, column.ttlUnit || 'seconds', column.ttlFormat || 'auto');
      setTtlValue(newValue);
    }, autoRefresh * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, isExpired, value, column.ttlUnit, column.ttlFormat]);

  return (
    <span style={{
      color: isExpired ? '#ff4d4f' : undefined,
      fontWeight: isExpired ? 500 : undefined
    }}>
      {ttlValue}
    </span>
  );
};

export const numberRegistrations: Record<string, FieldTypeRegistration> = {
  number: { form: NumberForm, detail: NumberDetail, table: NumberTable },
  currency: {
    form: CurrencyForm, detail: CurrencyDetail, table: CurrencyTable,
    defaults: {
      form: { currencySymbol: '$', precision: 2 },
    },
  },
  percentage: {
    form: PercentageForm, detail: PercentageDetail, table: PercentageTable,
    defaults: {
      form: { min: 0, max: 100 },
    },
  },
  slider: { form: SliderForm, detail: SliderDetail, table: SliderTable },
  range: { form: RangeForm, detail: RangeDetail, table: RangeTable },
  rating: {
    form: RatingForm, detail: RatingDetail, table: RatingTable,
    defaults: {
      form: { count: 5 },
    },
  },
  duration: { form: DurationForm, detail: DurationDetail, table: DurationTable },
  ttl: { detail: TTLDetail, table: TTLTable },
  progress: { form: ProgressForm },
};
