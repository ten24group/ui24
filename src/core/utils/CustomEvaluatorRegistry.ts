/**
 * Registry for custom evaluator functions (NEW condition system).
 * 
 * Custom evaluators return boolean | Promise<boolean> (not EvaluationResult).
 * They are referenced in entity schemas via { custom: 'evaluatorName' }.
 * 
 * The ConditionEvaluator calls these when it encounters a { custom: ... } condition.
 * In sync mode, custom evaluators trigger a NeedsAsyncError. In async mode,
 * they are awaited.
 * 
 * @example
 * // Register at app startup
 * CustomEvaluatorRegistry.register('hasTeamAccess', async (ctx) => {
 *   const perms = await teamService.getPermissions(ctx.actor.actorId, ctx.record?.teamId);
 *   return perms.includes('write');
 * });
 * 
 * // In entity schema
 * visibility: { custom: 'hasTeamAccess' }
 */

import { CustomConditionFn, NewEvaluationContext } from '../types/evaluation';

const evaluators = new Map<string, CustomConditionFn>();

/**
 * Register a custom evaluator function.
 */
export function registerCustomEvaluator(name: string, evaluator: CustomConditionFn): void {
  if (evaluators.has(name)) {
    console.warn(`[CustomEvaluatorRegistry] Overwriting evaluator: "${name}"`);
  }
  evaluators.set(name, evaluator);
}

/**
 * Register multiple custom evaluators at once.
 */
export function registerCustomEvaluators(batch: Record<string, CustomConditionFn>): void {
  Object.entries(batch).forEach(([name, fn]) => registerCustomEvaluator(name, fn));
}

/**
 * Get a custom evaluator by name.
 */
export function getCustomEvaluator(name: string): CustomConditionFn | undefined {
  return evaluators.get(name);
}

/**
 * Check if a custom evaluator exists.
 */
export function hasCustomEvaluator(name: string): boolean {
  return evaluators.has(name);
}

/**
 * Clear all custom evaluators (for testing).
 * @internal
 */
export function clearCustomEvaluators(): void {
  evaluators.clear();
}

/**
 * Get all registered evaluator names (for debugging).
 */
export function getCustomEvaluatorNames(): string[] {
  return Array.from(evaluators.keys());
}

export const CustomEvaluatorRegistry = {
  register: registerCustomEvaluator,
  registerBatch: registerCustomEvaluators,
  get: getCustomEvaluator,
  has: hasCustomEvaluator,
  clear: clearCustomEvaluators,
  getNames: getCustomEvaluatorNames,
};
