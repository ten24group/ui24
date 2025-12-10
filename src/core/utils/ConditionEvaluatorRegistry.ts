/**
 * Universal registry for custom condition evaluator functions.
 * 
 * Uses module pattern with closures for clean, tree-shakeable code.
 * 
 * Usage:
 * - Register evaluators in App.tsx initialization
 * - Reference by name in backend visibility configs
 * - Frontend resolves and executes during evaluation
 * 
 * @example
 * // In App.tsx or initialization
 * registerEvaluator('canEditGame', async (ctx) => {
 *   const isAdmin = ctx.actor?.cognito?.groups?.includes('admin');
 *   const isOwner = ctx.record?.createdBy === ctx.actor?.actorId;
 *   const isDraft = ctx.record?.status === 'draft';
 *   
 *   return {
 *     visible: isAdmin || (isOwner && isDraft),
 *     enabled: true
 *   };
 * });
 * 
 * // In backend entity schema
 * visibility: {
 *   custom: 'canEditGame'
 * }
 */

import { CustomEvaluatorFunction } from '../types/evaluation';

// Private state using closure
const evaluators = new Map<string, CustomEvaluatorFunction>();

/**
 * Register a custom evaluator function
 * 
 * @param name - Unique name to reference this evaluator
 * @param evaluator - Function that evaluates visibility/enablement
 * 
 * @example
 * registerEvaluator('canEdit', async (ctx) => ({
 *   visible: ctx.actor?.cognito?.groups?.includes('admin'),
 *   enabled: true
 * }));
 */
export function registerEvaluator(name: string, evaluator: CustomEvaluatorFunction): void {
  if (evaluators.has(name)) {
    console.warn(`[EvaluatorRegistry] Overwriting evaluator: ${name}`);
  }
  evaluators.set(name, evaluator);
}

/**
 * Register multiple evaluators at once
 * 
 * @param batch - Object mapping names to evaluator functions
 * 
 * @example
 * registerEvaluators({
 *   canEdit: async (ctx) => ({ ... }),
 *   canDelete: async (ctx) => ({ ... }),
 *   canPublish: async (ctx) => ({ ... })
 * });
 */
export function registerEvaluators(batch: Record<string, CustomEvaluatorFunction>): void {
  Object.entries(batch).forEach(([name, fn]) => registerEvaluator(name, fn));
}

/**
 * Get an evaluator by name (internal use by UniversalEvaluator)
 * 
 * @param name - Name of the evaluator
 * @returns The evaluator function or undefined if not found
 */
export function getEvaluator(name: string): CustomEvaluatorFunction | undefined {
  return evaluators.get(name);
}

/**
 * Check if evaluator exists
 * 
 * @param name - Name to check
 * @returns true if evaluator is registered
 */
export function hasEvaluator(name: string): boolean {
  return evaluators.has(name);
}

/**
 * Clear all evaluators (testing only)
 * 
 * @internal
 */
export function clearEvaluators(): void {
  evaluators.clear();
}

/**
 * Get all registered evaluator names (debugging)
 * 
 * @returns Array of registered evaluator names
 */
export function getEvaluatorNames(): string[] {
  return Array.from(evaluators.keys());
}

