/**
 * ConditionEvaluator — the core evaluation engine for the Unified Condition System.
 * 
 * Replaces UniversalEvaluator. Key differences:
 * - Returns boolean (not { visible, enabled })
 * - Handles and/or/not recursion with cycle detection
 * - Handles ref (named condition lookup via ConditionRegistry)
 * - Handles app-defined InlineCondition fields (any unknown key → context lookup)
 * - Handles featureFlags, device, tenant inline fields
 * - Removes shortcut handling (requiredRoles, excludedRoles, showWhen, hideWhen)
 * - Adds debug mode
 * 
 * Reference: CONDITION_SYSTEM_DESIGN.md Section 5
 */

import {
  Condition,
  InlineCondition,
  EvaluationRule,
  TemplateRef,
  NewEvaluationContext,
  ConditionalValue,
  isAndCondition,
  isOrCondition,
  isNotCondition,
  isRefCondition,
  isCustomCondition,
} from '../types/evaluation';
import { getCondition } from './ConditionRegistry';
import { getCustomEvaluator } from './CustomEvaluatorRegistry';
import { NeedsAsyncError } from './NeedsAsyncError';

// Known InlineCondition field names (framework built-in)
const KNOWN_INLINE_FIELDS = new Set([
  'actor', 'record', 'formValues', 'selectedRecords',
  'queryParams', 'context', 'featureFlags', 'device', 'tenant',
]);

// All recognized operators in an EvaluationRule
const KNOWN_OPERATORS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between',
  'inList', 'notInList', 'exists', 'empty', 'pattern', 'contains',
  'custom',
]);

const MAX_REF_DEPTH = 20;

// Track warnings we've already emitted to avoid flooding the console
const _warnedOnce = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (_warnedOnce.has(key)) return;
  _warnedOnce.add(key);
  console.warn(message);
}

export class ConditionEvaluator {
  private debug = false;

  /**
   * Enable/disable debug logging.
   */
  enableDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  // ────────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────────

  /**
   * Synchronous evaluation. Preferred for React hooks.
   * Throws NeedsAsyncError if the condition contains a custom evaluator.
   */
  evaluateSync(
    condition: Condition | undefined,
    context: NewEvaluationContext,
    visited?: Set<string>
  ): boolean {
    if (condition === undefined || condition === null) return true;
    if (typeof condition === 'boolean') return condition;

    const v = visited ?? new Set<string>();

    try {
      const result = this._evaluateSync(condition, context, v);
      if (this.debug) this._logEvaluation(condition, context, result);
      return result;
    } catch (error) {
      if (error instanceof NeedsAsyncError) throw error;
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Condition] Error evaluating:', error, { condition });
      }
      return false; // fail-safe
    }
  }

  /**
   * Asynchronous evaluation. Handles custom evaluators.
   * Falls back to sync where possible.
   */
  async evaluateAsync(
    condition: Condition | undefined,
    context: NewEvaluationContext,
    visited?: Set<string>
  ): Promise<boolean> {
    if (condition === undefined || condition === null) return true;
    if (typeof condition === 'boolean') return condition;

    const v = visited ?? new Set<string>();

    try {
      const result = await this._evaluateAsync(condition, context, v);
      if (this.debug) this._logEvaluation(condition, context, result);
      return result;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Condition] Async error evaluating:', error, { condition });
      }
      return false; // fail-safe
    }
  }

  /**
   * Resolve a ConditionalValue<T> to its value. Sync-only.
   * Returns the value from the first rule whose condition matches,
   * or the default value.
   */
  resolveValue<T>(
    conditionalValue: ConditionalValue<T>,
    context: NewEvaluationContext
  ): T {
    for (const rule of conditionalValue.rules) {
      try {
        if (this.evaluateSync(rule.when, context)) {
          return rule.value;
        }
      } catch (error) {
        // Skip rules that need async evaluation
        if (error instanceof NeedsAsyncError) continue;
        // Other errors → skip rule
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Condition] Error resolving ConditionalValue rule, skipping:', error);
        }
      }
    }
    return conditionalValue.default;
  }

  /**
   * Resolve a template string with {placeholder} syntax against context.
   * Used for disabledMessage and other dynamic strings.
   * 
   * @example
   * resolveTemplate('Upgrade from {subscription.tier} to unlock', context)
   * // → 'Upgrade from free to unlock'
   */
  resolveTemplate(template: string, context: NewEvaluationContext): string {
    return template.replace(/\{([^}]+)\}/g, (match, path) => {
      const value = this._getNestedValue(context, path.trim());
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  // ────────────────────────────────────────────────────────────
  // SYNC EVALUATION (INTERNAL)
  // ────────────────────────────────────────────────────────────

  private _evaluateSync(
    condition: Condition,
    ctx: NewEvaluationContext,
    visited: Set<string>
  ): boolean {
    // Boolean literal
    if (typeof condition === 'boolean') return condition;

    // Logical: and
    if (isAndCondition(condition)) {
      const arr = condition.and;
      if (!Array.isArray(arr)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Condition] "and" must be an array, got:', typeof arr);
        }
        return false;
      }
      return arr.every((c: Condition) => this._evaluateSync(c, ctx, visited));
    }

    // Logical: or
    if (isOrCondition(condition)) {
      const arr = condition.or;
      if (!Array.isArray(arr)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Condition] "or" must be an array, got:', typeof arr);
        }
        return false;
      }
      return arr.some((c: Condition) => this._evaluateSync(c, ctx, visited));
    }

    // Logical: not
    if (isNotCondition(condition)) {
      return !this._evaluateSync(condition.not, ctx, visited);
    }

    // Named ref
    if (isRefCondition(condition)) {
      return this._evaluateRef(condition.ref, ctx, visited);
    }

    // Custom evaluator — always needs async, regardless of other keys present
    if (isCustomCondition(condition)) {
      throw new NeedsAsyncError(condition.custom);
    }

    // InlineCondition
    return this._evaluateInline(condition as InlineCondition, ctx);
  }

  // ────────────────────────────────────────────────────────────
  // ASYNC EVALUATION (INTERNAL)
  // ────────────────────────────────────────────────────────────

  private async _evaluateAsync(
    condition: Condition,
    ctx: NewEvaluationContext,
    visited: Set<string>
  ): Promise<boolean> {
    // Boolean literal
    if (typeof condition === 'boolean') return condition;

    // Logical: and
    if (isAndCondition(condition)) {
      const arr = condition.and;
      if (!Array.isArray(arr)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Condition] "and" must be an array, got:', typeof arr);
        }
        return false;
      }
      const results = await Promise.all(
        arr.map((c: Condition) => this._evaluateAsync(c, ctx, visited))
      );
      return results.every(Boolean);
    }

    // Logical: or — use allSettled so one failing sub-condition doesn't kill the batch
    if (isOrCondition(condition)) {
      const arr = condition.or;
      if (!Array.isArray(arr)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Condition] "or" must be an array, got:', typeof arr);
        }
        return false;
      }
      const settled = await Promise.allSettled(
        arr.map((c: Condition) => this._evaluateAsync(c, ctx, visited))
      );
      return settled.some(r => r.status === 'fulfilled' && r.value === true);
    }

    // Logical: not
    if (isNotCondition(condition)) {
      const result = await this._evaluateAsync(condition.not, ctx, visited);
      return !result;
    }

    // Named ref
    if (isRefCondition(condition)) {
      return this._evaluateRefAsync(condition.ref, ctx, visited);
    }

    // Custom evaluator — evaluate async, AND with inline keys if present
    if (isCustomCondition(condition)) {
      const customResult = await this._evaluateCustom(condition.custom, ctx);
      // If there are other keys beyond 'custom', also evaluate the inline part and AND the results
      const otherKeys = Object.keys(condition).filter(k => k !== 'custom');
      if (otherKeys.length > 0) {
        const inlineResult = this._evaluateInline(condition as InlineCondition, ctx);
        return customResult && inlineResult;
      }
      return customResult;
    }

    // InlineCondition (sync, but wrapped in async context)
    return this._evaluateInline(condition as InlineCondition, ctx);
  }

  // ────────────────────────────────────────────────────────────
  // REF RESOLUTION
  // ────────────────────────────────────────────────────────────

  private _evaluateRef(
    name: string,
    ctx: NewEvaluationContext,
    visited: Set<string>
  ): boolean {
    // Cycle detection
    if (visited.has(name)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] Circular ref detected: ${Array.from(visited).join(' → ')} → ${name}`);
      }
      return false;
    }

    if (visited.size >= MAX_REF_DEPTH) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] Max ref depth (${MAX_REF_DEPTH}) exceeded for: ${name}`);
      }
      return false;
    }

    const resolved = getCondition(name);
    if (resolved === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] ref "${name}" not registered in ConditionRegistry`);
      }
      return false;
    }

    const newVisited = new Set(visited);
    newVisited.add(name);
    return this._evaluateSync(resolved, ctx, newVisited);
  }

  private async _evaluateRefAsync(
    name: string,
    ctx: NewEvaluationContext,
    visited: Set<string>
  ): Promise<boolean> {
    // Cycle detection
    if (visited.has(name)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] Circular ref detected: ${Array.from(visited).join(' → ')} → ${name}`);
      }
      return false;
    }

    if (visited.size >= MAX_REF_DEPTH) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] Max ref depth (${MAX_REF_DEPTH}) exceeded for: ${name}`);
      }
      return false;
    }

    const resolved = getCondition(name);
    if (resolved === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] ref "${name}" not registered in ConditionRegistry`);
      }
      return false;
    }

    const newVisited = new Set(visited);
    newVisited.add(name);
    return this._evaluateAsync(resolved, ctx, newVisited);
  }

  // ────────────────────────────────────────────────────────────
  // CUSTOM EVALUATOR
  // ────────────────────────────────────────────────────────────

  private async _evaluateCustom(
    name: string,
    ctx: NewEvaluationContext
  ): Promise<boolean> {
    const fn = getCustomEvaluator(name);
    if (!fn) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] custom "${name}" not registered in CustomEvaluatorRegistry`);
      }
      return false;
    }

    try {
      const result = await fn(ctx);
      return Boolean(result);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[Condition] Custom evaluator "${name}" threw:`, error);
      }
      return false; // fail-safe
    }
  }

  // ────────────────────────────────────────────────────────────
  // INLINE CONDITION EVALUATION
  // ────────────────────────────────────────────────────────────

  private _evaluateInline(condition: InlineCondition, ctx: NewEvaluationContext): boolean {
    // Check all present fields (implicit AND).
    // Known fields first, then app-defined fields.

    // actor
    if (condition.actor) {
      if (!this._matchRules(condition.actor, ctx.actor, ctx)) return false;
    }

    // record
    if (condition.record) {
      if (!this._matchRules(condition.record, ctx.record, ctx)) return false;
    }

    // formValues
    if (condition.formValues) {
      if (!this._matchRules(condition.formValues, ctx.formValues, ctx)) return false;
    }

    // featureFlags
    if (condition.featureFlags) {
      if (process.env.NODE_ENV !== 'production' && ctx.featureFlags && Object.keys(ctx.featureFlags).length === 0) {
        warnOnce(
          'unconfigured:featureFlags',
          '[Condition] A condition references "featureFlags" but the context has no flags. ' +
          'Did you call configure({ featureFlagProvider: ... }) before rendering <UI24 />? ' +
          'Without a provider, all feature flag conditions will fail.'
        );
      }
      if (!this._matchRules(condition.featureFlags as Record<string, EvaluationRule>, ctx.featureFlags, ctx)) return false;
    }

    // device
    if (condition.device) {
      if (!this._matchRules(condition.device as Record<string, EvaluationRule>, ctx.device, ctx)) return false;
    }

    // tenant
    if (condition.tenant) {
      if (process.env.NODE_ENV !== 'production' && !ctx.tenant) {
        warnOnce(
          'unconfigured:tenant',
          '[Condition] A condition references "tenant" but the context has no tenant data. ' +
          'Did you call configure({ tenantProvider: ... }) before rendering <UI24 />? ' +
          'Without a provider, all tenant conditions will fail.'
        );
      }
      if (!this._matchRules(condition.tenant, ctx.tenant, ctx)) return false;
    }

    // context (pageType, modalDepth, entityName, route, modal, etc.)
    if (condition.context) {
      const contextData: Record<string, unknown> = {
        pageType: ctx.pageType,
        modalDepth: ctx.modalDepth,
        entityName: ctx.entityName,
        route: ctx.route,
        modal: ctx.modal,
      };
      if (!this._matchRules(condition.context as Record<string, EvaluationRule>, contextData, ctx)) return false;
    }

    // queryParams
    if (condition.queryParams) {
      if (!this._matchRules(condition.queryParams, ctx.queryParams, ctx)) return false;
    }

    // selectedRecords (special handling)
    if (condition.selectedRecords) {
      if (!this._matchSelectedRecords(condition.selectedRecords, ctx.selectedRecords, ctx)) return false;
    }

    // App-defined fields: iterate remaining keys
    for (const key of Object.keys(condition)) {
      if (KNOWN_INLINE_FIELDS.has(key)) continue;
      // Skip logical operator keys that might be present on a mixed object
      if (key === 'and' || key === 'or' || key === 'not' || key === 'ref' || key === 'custom') continue;

      const fieldRules = condition[ key ];
      if (fieldRules === undefined) continue;

      const contextData = ctx[ key ];
      if (!this._matchRules(fieldRules as Record<string, EvaluationRule>, contextData, ctx)) return false;
    }

    return true;
  }

  // ────────────────────────────────────────────────────────────
  // RULE MATCHING
  // ────────────────────────────────────────────────────────────

  /**
   * Match all rules against a data object. All must pass (AND).
   */
  private _matchRules(
    rules: Record<string, EvaluationRule> | undefined,
    data: any,
    ctx: NewEvaluationContext
  ): boolean {
    if (!rules) return true;

    for (const [ path, rule ] of Object.entries(rules)) {
      if (rule === undefined) continue;
      const actualValue = this._getNestedValue(data, path);
      if (!this._matchRule(rule, actualValue, ctx)) return false;
    }
    return true;
  }

  /**
   * Match selected records conditions (special structure).
   */
  private _matchSelectedRecords(
    config: NonNullable<InlineCondition[ 'selectedRecords' ]>,
    selectedRecords: Array<Record<string, any>> | undefined,
    ctx: NewEvaluationContext
  ): boolean {
    const records = selectedRecords ?? [];

    // Length check
    if (config.length) {
      if (!this._matchRule(config.length, records.length, ctx)) return false;
    }

    // All records must match
    if (config.all) {
      if (!records.every(rec => this._matchRules(config.all!, rec, ctx))) return false;
    }

    // At least one record must match
    if (config.some) {
      if (records.length === 0) return false;
      if (!records.some(rec => this._matchRules(config.some!, rec, ctx))) return false;
    }

    // No records should match
    if (config.none) {
      if (records.some(rec => this._matchRules(config.none!, rec, ctx))) return false;
    }

    return true;
  }

  /**
   * Evaluate a single rule against a value.
   * Operators are checked in definition order; first present operator wins.
   */
  private _matchRule(
    rule: EvaluationRule,
    value: any,
    ctx: NewEvaluationContext
  ): boolean {
    // eq
    if ('eq' in rule && rule.eq !== undefined) {
      return value === this._resolveRef(rule.eq, ctx);
    }

    // neq
    if ('neq' in rule && rule.neq !== undefined) {
      return value !== this._resolveRef(rule.neq, ctx);
    }

    // gt
    if ('gt' in rule && rule.gt !== undefined) {
      return value > this._resolveRef(rule.gt, ctx);
    }

    // gte
    if ('gte' in rule && rule.gte !== undefined) {
      return value >= this._resolveRef(rule.gte, ctx);
    }

    // lt
    if ('lt' in rule && rule.lt !== undefined) {
      return value < this._resolveRef(rule.lt, ctx);
    }

    // lte
    if ('lte' in rule && rule.lte !== undefined) {
      return value <= this._resolveRef(rule.lte, ctx);
    }

    // between (inclusive) — resolve $ref for min/max values
    if ('between' in rule && rule.between !== undefined) {
      if (!Array.isArray(rule.between) || rule.between.length < 2) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Condition] "between" requires an array of [min, max], got:', rule.between);
        }
        return false;
      }
      const [ rawMin, rawMax ] = rule.between;
      const min = this._resolveRef(rawMin, ctx);
      const max = this._resolveRef(rawMax, ctx);
      if (value == null || min == null || max == null) return false;
      return value >= min && value <= max;
    }

    // inList
    if ('inList' in rule && rule.inList !== undefined) {
      if (Array.isArray(value)) {
        return value.some(v => rule.inList!.includes(v));
      }
      return rule.inList.includes(value);
    }

    // notInList
    if ('notInList' in rule && rule.notInList !== undefined) {
      if (Array.isArray(value)) {
        return !value.some(v => rule.notInList!.includes(v));
      }
      return !rule.notInList.includes(value);
    }

    // exists
    if ('exists' in rule && rule.exists !== undefined) {
      const doesExist = value !== undefined && value !== null;
      return rule.exists ? doesExist : !doesExist;
    }

    // empty
    if ('empty' in rule && rule.empty !== undefined) {
      const isEmpty = value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && value !== null && Object.keys(value).length === 0);
      return rule.empty ? isEmpty : !isEmpty;
    }

    // pattern (regex)
    if ('pattern' in rule && rule.pattern !== undefined) {
      if (typeof value !== 'string') return false;
      try {
        return new RegExp(rule.pattern).test(value);
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[Condition] Invalid regex pattern: "${rule.pattern}"`);
        }
        return false;
      }
    }

    // contains (case-insensitive substring)
    if ('contains' in rule && rule.contains !== undefined) {
      if (typeof value !== 'string') return false;
      return value.toLowerCase().includes(rule.contains.toLowerCase());
    }

    // No recognized operator → warn in dev mode, then pass (vacuous truth)
    if (process.env.NODE_ENV !== 'production') {
      const ruleKeys = Object.keys(rule);
      const unknownOps = ruleKeys.filter(k => !KNOWN_OPERATORS.has(k));
      if (unknownOps.length > 0) {
        warnOnce(
          `unknown-op:${unknownOps.join(',')}`,
          `[Condition] Unknown operator(s) in EvaluationRule: ${unknownOps.map(o => `"${o}"`).join(', ')}. ` +
          `Known operators: ${Array.from(KNOWN_OPERATORS).join(', ')}. ` +
          `Rule was treated as passing (vacuous truth). Check for typos.`
        );
      }
    }
    return true;
  }

  // ────────────────────────────────────────────────────────────
  // UTILITIES
  // ────────────────────────────────────────────────────────────

  /**
   * Resolve a $ref template or return the value as-is.
   */
  private _resolveRef(value: any, ctx: NewEvaluationContext): any {
    if (value && typeof value === 'object' && '$ref' in value) {
      const path = (value as TemplateRef).$ref;
      const resolved = this._getNestedValue(ctx, path);
      if (resolved === undefined && process.env.NODE_ENV !== 'production') {
        console.warn(`[Condition] $ref path not found: "${path}"`);
      }
      return resolved;
    }
    return value;
  }

  /**
   * Get nested value from object using dot notation.
   */
  private _getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((current, key) => current?.[ key ], obj);
  }

  /**
   * Debug logging for evaluations.
   */
  private _logEvaluation(condition: Condition, ctx: NewEvaluationContext, result: boolean): void {
    if (!this.debug) return;

    let conditionType: string;
    if (typeof condition === 'boolean') conditionType = 'boolean';
    else if (isAndCondition(condition)) conditionType = 'AND';
    else if (isOrCondition(condition)) conditionType = 'OR';
    else if (isNotCondition(condition)) conditionType = 'NOT';
    else if (isRefCondition(condition)) conditionType = `ref(${condition.ref})`;
    else if (isCustomCondition(condition)) conditionType = `custom(${condition.custom})`;
    else conditionType = 'inline';

    if (typeof console.groupCollapsed === 'function') {
      console.groupCollapsed(
        `%c[Condition] ${conditionType} → ${result}`,
        result ? 'color: green' : 'color: red'
      );
      console.log('Condition:', condition);
      console.log('Result:', result);
      console.groupEnd();
    }
  }
}

// Export singleton
export const conditionEvaluator = new ConditionEvaluator();

/**
 * Clear the one-time warning cache. Used in tests to reset state.
 * @internal
 */
export function _clearWarningCache(): void {
  _warnedOnce.clear();
}
