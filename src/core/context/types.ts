/**
 * Type definitions for the pluggable provider and configuration system.
 * 
 * Reference: CONDITION_SYSTEM_DESIGN.md Section 4.3
 */

/**
 * Generic context provider interface.
 * Apps register any number of these to extend the evaluation context.
 * Each provider contributes a named chunk of data.
 */
export interface IContextProvider<T = Record<string, any>> {
  /** Return current data. Called once on mount (or on every subscription update). */
  getContext(): T;
  /** Optional: subscribe for dynamic updates. Return unsubscribe function. */
  subscribe?(callback: (data: T) => void): () => void;
}

/**
 * Built-in feature flag provider interface.
 * Boolean for toggles, string for variant names.
 */
export interface IFeatureFlagProvider {
  getFlags(): Record<string, boolean | string>;
  subscribe?(callback: (flags: Record<string, boolean | string>) => void): () => void;
}

/**
 * Built-in tenant provider interface.
 */
export interface ITenantProvider {
  getTenant(): { tenantId: string; name: string; [key: string]: any } | null;
  subscribe?(callback: (tenant: any) => void): () => void;
}

/**
 * i18n provider interface (#22).
 * Apps bring their own i18n library (react-intl, i18next, custom).
 * ui24 only needs translate + getLocale.
 */
export interface II18nProvider {
  /** Translate a key into the current locale. Falls back to the key itself if no translation found. */
  translate(key: string, params?: Record<string, string | number>): string;
  /** Return the current locale string (e.g. 'en-US', 'de-DE') */
  getLocale(): string;
  /** Optional: subscribe to locale changes */
  subscribe?(callback: (locale: string) => void): () => void;
}

/**
 * Configuration passed to UI24.configure().
 * Apps call this before the React tree mounts.
 */
export interface IConditionSystemConfig {
  /** Built-in: feature flag provider */
  featureFlagProvider?: IFeatureFlagProvider;
  /** Built-in: tenant provider */
  tenantProvider?: ITenantProvider;
  /** Opt-in: update device info on window resize (debounced 250ms) */
  responsiveDevice?: boolean;
  /** App-defined context providers (any number, any data) */
  contextProviders?: Record<string, IContextProvider>;
  /** i18n provider for translating labels, placeholders, etc. (#22) */
  i18nProvider?: II18nProvider;
}
