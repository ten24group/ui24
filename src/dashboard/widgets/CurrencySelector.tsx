import React, { useEffect, useState } from 'react';
import { Select, Space } from 'antd';
import { useApi } from '../../core/context';
import { substituteUrlParams } from '../../core/utils';

export interface CurrencySelectorProps {
  apiUrl: string;
  routeParams?: Record<string, string | number | undefined>;
  value?: string;
  onChange: (currency: string) => void;
  style?: React.CSSProperties;
  /**
   * When true, the selector is locked to the loaded default currency and cannot
   * be toggled (used at team-level analytics, where the team's defaultCurrency
   * is fixed). Currencies are still fetched so the default is applied to widgets.
   */
  disabled?: boolean;
}

interface CurrenciesApiResponse {
  defaultCurrency: string;
  currencies: string[];
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  apiUrl,
  routeParams = {},
  value,
  onChange,
  style,
  disabled = false,
}) => {
  const { callApiMethod } = useApi();
  const [ currencies, setCurrencies ] = useState<string[]>([]);
  const [ loading, setLoading ] = useState(true);
  const [ error, setError ] = useState<string | null>(null);

  const routeParamsKey = JSON.stringify(routeParams);

  useEffect(() => {
    let isMounted = true;

    const fetchCurrencies = async () => {
      setLoading(true);
      setError(null);

      try {
        const resolvedUrl = substituteUrlParams(apiUrl, routeParams);
        const response = await callApiMethod({
          apiUrl: resolvedUrl,
          apiMethod: 'GET',
          responseKey: 'data',
        });

        const data = (response?.data?.data ?? response?.data) as CurrenciesApiResponse;
        const list = Array.isArray(data?.currencies) && data.currencies.length > 0
          ? data.currencies
          : [ data?.defaultCurrency || 'USD' ];
        const defaultCurrency = data?.defaultCurrency || list[0] || 'USD';

        if (!isMounted) {
          return;
        }

        setCurrencies(list);
        onChange(value && list.includes(value) ? value : defaultCurrency);
      } catch (err: any) {
        if (!isMounted) {
          return;
        }
        setError(err?.message || 'Failed to load currencies');
        setCurrencies([ 'USD' ]);
        onChange('USD');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCurrencies();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ apiUrl, callApiMethod, routeParamsKey ]);

  return (
    <Space style={style}>
      <Select
        value={value}
        loading={loading}
        disabled={disabled || loading || !!error}
        style={{ minWidth: 120 }}
        options={currencies.map(code => ({ label: code, value: code }))}
        onChange={onChange}
        aria-label="Currency filter"
      />
    </Space>
  );
};
