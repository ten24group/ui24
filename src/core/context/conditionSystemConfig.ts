/**
 * Module-level configuration store for the condition system.
 * 
 * UI24.configure() stores config here before React mounts.
 * AppStaticProvider reads from here to wire up providers.
 */

import { IConditionSystemConfig } from './types';

let _config: IConditionSystemConfig = {};

/**
 * Set the condition system configuration.
 * Must be called before the React tree mounts.
 */
export function setConditionSystemConfig(config: IConditionSystemConfig): void {
  _config = { ..._config, ...config };
}

/**
 * Get the current condition system configuration.
 */
export function getConditionSystemConfig(): IConditionSystemConfig {
  return _config;
}
