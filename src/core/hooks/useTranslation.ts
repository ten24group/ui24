import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getConditionSystemConfig } from '../context/conditionSystemConfig';
import type { II18nProvider } from '../context/types';

const I18N_PREFIX = 'i18n:';

/**
 * Resolve a string that may be an i18n key (prefixed with 'i18n:').
 * If an i18nProvider is registered, translates the key.
 * Otherwise returns the key as-is (backwards compatible).
 */
function resolveI18nString(
  value: string,
  provider: II18nProvider | undefined,
  params?: Record<string, string | number>
): string {
  if (!value.startsWith(I18N_PREFIX)) return value;
  const key = value.slice(I18N_PREFIX.length);
  if (!provider) return key;
  return provider.translate(key, params);
}

/**
 * Hook providing translation utilities (#22).
 *
 * Usage:
 *   const { t } = useTranslation();
 *   const label = t('i18n:user.firstName');
 *   // If i18nProvider is registered → translated string
 *   // If not → 'user.firstName' (stripped prefix)
 *   // If plain string (no prefix) → returned as-is
 */
export function useTranslation() {
  const config = getConditionSystemConfig();
  const provider = config.i18nProvider;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (provider?.subscribe) {
        return provider.subscribe(() => onStoreChange());
      }
      return () => {};
    },
    [provider]
  );

  const getSnapshot = useCallback(() => {
    return provider?.getLocale() ?? 'en';
  }, [provider]);

  const locale = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const t = useCallback(
    (value: string, params?: Record<string, string | number>): string => {
      return resolveI18nString(value, provider, params);
    },
    // locale is included to bust the memoization when locale changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, locale]
  );

  return useMemo(() => ({ t, locale }), [t, locale]);
}
