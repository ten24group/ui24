import type { II18nProvider } from './types';

/**
 * Creates an i18n provider backed by a flat translations map.
 *
 * Pass the result to `configure({ i18nProvider })` before your app mounts.
 * Translations can be sourced from anywhere the app wants (static import, S3 JSON,
 * backend API call); the framework only needs the resolved map.
 *
 * Supports simple `{param}` interpolation in translation values.
 *
 * @example
 * import { configure, createStaticI18nProvider } from '@ten24group/ui24';
 *
 * // Loaded from anywhere — static import, fetch from S3, API call, etc.
 * const translations = {
 *   'user.firstName': 'First Name',
 *   'user.lastName':  'Last Name',
 *   'common.save':    'Save',
 *   'greeting':       'Hello, {name}!',
 * };
 *
 * configure({
 *   i18nProvider: createStaticI18nProvider(translations, 'en'),
 * });
 *
 * // In entity / page config, prefix any label, placeholder, or helpText with 'i18n:':
 * { name: 'firstName', label: 'i18n:user.firstName' }
 * // → renders as "First Name" when the provider is registered.
 * // → renders as "user.firstName" when no provider is registered (key stripped).
 *
 * // This is a static provider — the locale is fixed at creation time.
 * // For runtime locale switching, implement II18nProvider.subscribe in a
 * // custom provider (e.g. wrapping i18next or react-intl) and call configure() again.
 *
 * @param translations  Flat map of translation key → translated string.
 * @param locale        BCP-47 locale tag (default: 'en'). Returned by getLocale().
 */
export function createStaticI18nProvider(
  translations: Record<string, string>,
  locale = 'en'
): II18nProvider {
  return {
    translate(key, params) {
      let text = translations[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          // Use split/join to replace all occurrences without regex
          text = text.split(`{${k}}`).join(String(v));
        }
      }
      return text;
    },
    getLocale() {
      return locale;
    },
  };
}
