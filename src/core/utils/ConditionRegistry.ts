/**
 * Registry for named (reusable) conditions.
 * 
 * Named conditions are defined by apps and referenced in entity schemas
 * via { ref: 'conditionName' }. The ConditionEvaluator resolves refs
 * through this registry.
 * 
 * @example
 * // Register at app startup
 * ConditionRegistry.register('isAdmin', {
 *   actor: { groups: { inList: ['admin'] } }
 * });
 * 
 * ConditionRegistry.register('isPremiumAdmin', {
 *   and: [
 *     { ref: 'isAdmin' },
 *     { subscription: { isPro: { eq: true } } },
 *   ]
 * });
 * 
 * // In entity schema
 * visibility: { ref: 'isPremiumAdmin' }
 */

import { Condition } from '../types/evaluation';

const conditions = new Map<string, Condition>();

/**
 * Register a named condition.
 */
export function registerCondition(name: string, condition: Condition): void {
  if (conditions.has(name)) {
    console.warn(`[ConditionRegistry] Overwriting condition: "${name}"`);
  }
  conditions.set(name, condition);
}

/**
 * Register multiple named conditions at once.
 */
export function registerConditions(batch: Record<string, Condition>): void {
  Object.entries(batch).forEach(([name, condition]) => registerCondition(name, condition));
}

/**
 * Get a named condition by name.
 */
export function getCondition(name: string): Condition | undefined {
  return conditions.get(name);
}

/**
 * Check if a named condition exists.
 */
export function hasCondition(name: string): boolean {
  return conditions.has(name);
}

/**
 * Clear all named conditions (for testing).
 * @internal
 */
export function clearConditions(): void {
  conditions.clear();
}

/**
 * Get all registered condition names (for debugging).
 */
export function getConditionNames(): string[] {
  return Array.from(conditions.keys());
}

export const ConditionRegistry = {
  register: registerCondition,
  registerBatch: registerConditions,
  get: getCondition,
  has: hasCondition,
  clear: clearConditions,
  getNames: getConditionNames,
};
