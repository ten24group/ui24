import { ConditionEvaluator, _clearWarningCache } from '../ConditionEvaluator';
import { registerCondition, clearConditions } from '../ConditionRegistry';
import { registerCustomEvaluator, clearCustomEvaluators } from '../CustomEvaluatorRegistry';
import { NeedsAsyncError } from '../NeedsAsyncError';
import type { Condition, NewEvaluationContext, InlineCondition } from '../../types/evaluation';

// Test context
const baseContext: NewEvaluationContext = {
  actor: {
    actorId: 'user-1',
    groups: ['admin', 'editor'],
    permissions: ['read', 'write'],
    username: 'testuser',
    email: 'test@example.com',
  },
  featureFlags: {
    richText: true,
    darkMode: false,
    experimentVariant: 'B',
  },
  tenant: {
    tenantId: 'tenant-1',
    name: 'Acme Corp',
  },
  device: {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    viewport: 'lg',
  },
  pageType: 'form',
  entityName: 'team',
  queryParams: { tab: 'settings', mode: 'advanced' },
  modalDepth: 0,
  record: {
    id: 'rec-1',
    status: 'draft',
    ownerId: 'user-1',
    priority: 5,
    tags: ['important', 'urgent'],
    nested: { deep: { value: 42 } },
  },
  formValues: {
    name: 'Test Team',
    status: 'active',
    budget: 1000,
  },
  selectedRecords: [
    { id: 'r1', status: 'draft', priority: 1 },
    { id: 'r2', status: 'published', priority: 3 },
    { id: 'r3', status: 'draft', priority: 5 },
  ],
  // App-defined context
  subscription: {
    tier: 'pro',
    isPro: true,
    maxUsers: 100,
  },
  preferences: {
    locale: 'en-US',
    theme: 'dark',
    experienceLevel: 'expert',
  },
};

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
    clearConditions();
    clearCustomEvaluators();
    _clearWarningCache();
  });

  // ────────────────────────────────────────────────────────────
  // BASIC / EDGE CASES
  // ────────────────────────────────────────────────────────────

  describe('basic evaluation', () => {
    it('returns true for undefined condition', () => {
      expect(evaluator.evaluateSync(undefined, baseContext)).toBe(true);
    });

    it('returns true for null condition', () => {
      expect(evaluator.evaluateSync(null as any, baseContext)).toBe(true);
    });

    it('returns true for boolean true', () => {
      expect(evaluator.evaluateSync(true, baseContext)).toBe(true);
    });

    it('returns false for boolean false', () => {
      expect(evaluator.evaluateSync(false, baseContext)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // INLINE CONDITION — BUILT-IN FIELDS
  // ────────────────────────────────────────────────────────────

  describe('inline conditions — actor', () => {
    it('matches actor field with eq', () => {
      const condition: Condition = { actor: { actorId: { eq: 'user-1' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('fails actor field with eq mismatch', () => {
      const condition: Condition = { actor: { actorId: { eq: 'user-999' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('matches actor groups with inList', () => {
      const condition: Condition = { actor: { groups: { inList: ['admin'] } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('fails actor groups with inList when no overlap', () => {
      const condition: Condition = { actor: { groups: { inList: ['superadmin'] } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });
  });

  describe('inline conditions — record', () => {
    it('matches record field with eq', () => {
      const condition: Condition = { record: { status: { eq: 'draft' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches nested record field', () => {
      const condition: Condition = { record: { 'nested.deep.value': { eq: 42 } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches record field with exists', () => {
      const condition: Condition = { record: { id: { exists: true } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('fails when record is missing but condition requires it', () => {
      const ctx = { ...baseContext, record: undefined };
      const condition: Condition = { record: { status: { eq: 'draft' } } };
      expect(evaluator.evaluateSync(condition, ctx)).toBe(false);
    });
  });

  describe('inline conditions — formValues', () => {
    it('matches form values', () => {
      const condition: Condition = { formValues: { status: { eq: 'active' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches form values with gt', () => {
      const condition: Condition = { formValues: { budget: { gt: 500 } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });
  });

  describe('inline conditions — featureFlags', () => {
    it('matches boolean feature flag', () => {
      const condition: Condition = { featureFlags: { richText: { eq: true } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches string feature flag variant', () => {
      const condition: Condition = { featureFlags: { experimentVariant: { eq: 'B' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('fails when flag is false', () => {
      const condition: Condition = { featureFlags: { darkMode: { eq: true } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });
  });

  describe('inline conditions — device', () => {
    it('matches desktop device', () => {
      const condition: Condition = { device: { isDesktop: { eq: true } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches viewport', () => {
      const condition: Condition = { device: { viewport: { inList: ['lg', 'xl'] } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });
  });

  describe('inline conditions — context', () => {
    it('matches page type', () => {
      const condition: Condition = { context: { pageType: { eq: 'form' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches entity name', () => {
      const condition: Condition = { context: { entityName: { eq: 'team' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches modal depth', () => {
      const condition: Condition = { context: { modalDepth: { eq: 0 } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });
  });

  describe('inline conditions — queryParams', () => {
    it('matches query param', () => {
      const condition: Condition = { queryParams: { tab: { eq: 'settings' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });
  });

  describe('inline conditions — selectedRecords', () => {
    it('matches selected records length', () => {
      const condition: Condition = { selectedRecords: { length: { gte: 2 } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches all selected records', () => {
      const condition: Condition = { selectedRecords: { all: { id: { exists: true } } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches some selected records', () => {
      const condition: Condition = { selectedRecords: { some: { status: { eq: 'published' } } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('fails some when no records match', () => {
      const condition: Condition = { selectedRecords: { some: { status: { eq: 'archived' } } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('matches none', () => {
      const condition: Condition = { selectedRecords: { none: { status: { eq: 'archived' } } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────
  // INLINE CONDITION — APP-DEFINED FIELDS
  // ────────────────────────────────────────────────────────────

  describe('inline conditions — app-defined fields', () => {
    it('matches app-defined subscription field', () => {
      const condition: Condition = { subscription: { tier: { eq: 'pro' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('matches app-defined preferences field', () => {
      const condition: Condition = { preferences: { theme: { eq: 'dark' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('fails app-defined field when value does not match', () => {
      const condition: Condition = { subscription: { tier: { eq: 'enterprise' } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('fails app-defined field when context is missing', () => {
      const condition: Condition = { network: { isOnline: { eq: true } } };
      // network not in context
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // IMPLICIT AND (multiple inline fields)
  // ────────────────────────────────────────────────────────────

  describe('implicit AND (multiple fields)', () => {
    it('all fields must pass', () => {
      const condition: Condition = {
        actor: { actorId: { eq: 'user-1' } },
        record: { status: { eq: 'draft' } },
        featureFlags: { richText: { eq: true } },
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('fails if any field fails', () => {
      const condition: Condition = {
        actor: { actorId: { eq: 'user-1' } },
        record: { status: { eq: 'published' } }, // FAILS
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // LOGICAL OPERATORS (and/or/not)
  // ────────────────────────────────────────────────────────────

  describe('logical operators', () => {
    it('AND: all must be true', () => {
      const condition: Condition = {
        and: [
          { actor: { actorId: { eq: 'user-1' } } },
          { record: { status: { eq: 'draft' } } },
        ],
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('AND: fails if any is false', () => {
      const condition: Condition = {
        and: [
          { actor: { actorId: { eq: 'user-1' } } },
          { record: { status: { eq: 'published' } } }, // FAILS
        ],
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('OR: any must be true', () => {
      const condition: Condition = {
        or: [
          { record: { status: { eq: 'published' } } }, // FAILS
          { actor: { actorId: { eq: 'user-1' } } },     // PASSES
        ],
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('OR: fails if all are false', () => {
      const condition: Condition = {
        or: [
          { record: { status: { eq: 'published' } } },
          { record: { status: { eq: 'archived' } } },
        ],
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('NOT: negates result', () => {
      const condition: Condition = {
        not: { record: { status: { eq: 'published' } } },
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('NOT: negates true to false', () => {
      const condition: Condition = {
        not: { record: { status: { eq: 'draft' } } },
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('nested logical operators', () => {
      const condition: Condition = {
        or: [
          {
            and: [
              { actor: { groups: { inList: ['admin'] } } },
              { record: { status: { eq: 'draft' } } },
            ],
          },
          { featureFlags: { richText: { eq: true } } },
        ],
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────
  // EVALUATION RULES
  // ────────────────────────────────────────────────────────────

  describe('evaluation rules', () => {
    it('neq', () => {
      expect(evaluator.evaluateSync({ record: { status: { neq: 'published' } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { status: { neq: 'draft' } } }, baseContext)).toBe(false);
    });

    it('gt/gte/lt/lte', () => {
      expect(evaluator.evaluateSync({ record: { priority: { gt: 4 } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { priority: { gte: 5 } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { priority: { lt: 6 } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { priority: { lte: 5 } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { priority: { gt: 5 } } }, baseContext)).toBe(false);
    });

    it('between (inclusive)', () => {
      expect(evaluator.evaluateSync({ record: { priority: { between: [1, 10] } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { priority: { between: [5, 5] } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { priority: { between: [6, 10] } } }, baseContext)).toBe(false);
    });

    it('inList with array value', () => {
      expect(evaluator.evaluateSync({ record: { tags: { inList: ['urgent', 'low'] } } }, baseContext)).toBe(true);
    });

    it('notInList', () => {
      expect(evaluator.evaluateSync({ record: { status: { notInList: ['archived', 'deleted'] } } }, baseContext)).toBe(true);
    });

    it('exists', () => {
      expect(evaluator.evaluateSync({ record: { id: { exists: true } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { nonexistent: { exists: false } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { nonexistent: { exists: true } } }, baseContext)).toBe(false);
    });

    it('empty', () => {
      const ctx = { ...baseContext, record: { ...baseContext.record, emptyField: '' } };
      expect(evaluator.evaluateSync({ record: { emptyField: { empty: true } } }, ctx)).toBe(true);
      expect(evaluator.evaluateSync({ record: { status: { empty: false } } }, baseContext)).toBe(true);
    });

    it('pattern (regex)', () => {
      expect(evaluator.evaluateSync({ record: { status: { pattern: '^dra' } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { status: { pattern: '^pub' } } }, baseContext)).toBe(false);
    });

    it('contains (case-insensitive)', () => {
      expect(evaluator.evaluateSync({ record: { status: { contains: 'RAF' } } }, baseContext)).toBe(true);
      expect(evaluator.evaluateSync({ record: { status: { contains: 'xyz' } } }, baseContext)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // $ref TEMPLATE RESOLUTION
  // ────────────────────────────────────────────────────────────

  describe('$ref template resolution', () => {
    it('resolves $ref in eq rule', () => {
      const condition: Condition = { record: { ownerId: { eq: { $ref: 'actor.actorId' } } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('resolves $ref in neq rule', () => {
      const condition: Condition = { record: { ownerId: { neq: { $ref: 'actor.actorId' } } } };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('resolves $ref to app-defined context', () => {
      const condition: Condition = {
        subscription: { tier: { eq: { $ref: 'subscription.tier' } } }, // self-referential, always true
      };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────
  // NAMED CONDITIONS (ref)
  // ────────────────────────────────────────────────────────────

  describe('named conditions', () => {
    it('resolves ref to a registered condition', () => {
      registerCondition('isAdmin', { actor: { groups: { inList: ['admin'] } } });
      const condition: Condition = { ref: 'isAdmin' };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('returns false for unregistered ref', () => {
      const condition: Condition = { ref: 'nonexistent' };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });

    it('resolves nested refs', () => {
      registerCondition('isAdmin', { actor: { groups: { inList: ['admin'] } } });
      registerCondition('isAdminOnDraft', {
        and: [
          { ref: 'isAdmin' },
          { record: { status: { eq: 'draft' } } },
        ],
      });
      const condition: Condition = { ref: 'isAdminOnDraft' };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(true);
    });

    it('detects circular refs and returns false', () => {
      registerCondition('a', { ref: 'b' });
      registerCondition('b', { ref: 'a' });

      const condition: Condition = { ref: 'a' };
      expect(evaluator.evaluateSync(condition, baseContext)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // CUSTOM EVALUATORS
  // ────────────────────────────────────────────────────────────

  describe('custom evaluators', () => {
    it('throws NeedsAsyncError for custom condition in sync mode', () => {
      registerCustomEvaluator('myCheck', () => true);
      const condition: Condition = { custom: 'myCheck' };
      expect(() => evaluator.evaluateSync(condition, baseContext)).toThrow(NeedsAsyncError);
    });

    it('evaluates custom condition in async mode', async () => {
      registerCustomEvaluator('myCheck', (ctx) => ctx.actor.actorId === 'user-1');
      const condition: Condition = { custom: 'myCheck' };
      const result = await evaluator.evaluateAsync(condition, baseContext);
      expect(result).toBe(true);
    });

    it('evaluates async custom evaluator', async () => {
      registerCustomEvaluator('asyncCheck', async () => {
        return true;
      });
      const condition: Condition = { custom: 'asyncCheck' };
      const result = await evaluator.evaluateAsync(condition, baseContext);
      expect(result).toBe(true);
    });

    it('returns false for unregistered custom evaluator in async mode', async () => {
      const condition: Condition = { custom: 'nonexistent' };
      const result = await evaluator.evaluateAsync(condition, baseContext);
      expect(result).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // resolveValue (ConditionalValue<T>)
  // ────────────────────────────────────────────────────────────

  describe('resolveValue', () => {
    it('returns first matching rule value', () => {
      const cv = {
        rules: [
          { when: { device: { isMobile: { eq: true } } }, value: 'CompactEditor' },
          { when: { device: { isDesktop: { eq: true } } }, value: 'DesktopEditor' },
        ],
        default: 'StandardEditor',
      };
      expect(evaluator.resolveValue(cv, baseContext)).toBe('DesktopEditor');
    });

    it('returns default when no rules match', () => {
      const cv = {
        rules: [
          { when: { device: { isMobile: { eq: true } } }, value: 'CompactEditor' },
        ],
        default: 'StandardEditor',
      };
      expect(evaluator.resolveValue(cv, baseContext)).toBe('StandardEditor');
    });

    it('returns default for empty rules', () => {
      const cv = {
        rules: [],
        default: 'Fallback',
      };
      expect(evaluator.resolveValue(cv, baseContext)).toBe('Fallback');
    });
  });

  // ────────────────────────────────────────────────────────────
  // resolveTemplate
  // ────────────────────────────────────────────────────────────

  describe('resolveTemplate', () => {
    it('resolves placeholders in template string', () => {
      const result = evaluator.resolveTemplate('Hello {actor.username}, tier: {subscription.tier}', baseContext);
      expect(result).toBe('Hello testuser, tier: pro');
    });

    it('leaves unresolvable placeholders as-is', () => {
      const result = evaluator.resolveTemplate('Hello {actor.nonexistent}', baseContext);
      expect(result).toBe('Hello {actor.nonexistent}');
    });

    it('resolves nested paths', () => {
      const result = evaluator.resolveTemplate('Value: {record.nested.deep.value}', baseContext);
      expect(result).toBe('Value: 42');
    });
  });

  // ────────────────────────────────────────────────────────────
  // ERROR HANDLING / FAIL-SAFE
  // ────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns false (fail-safe) for invalid conditions', () => {
      // A condition that would cause internal errors
      const badCondition = { actor: { groups: { pattern: '[invalid regex' } } } as Condition;
      expect(evaluator.evaluateSync(badCondition, baseContext)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // DEV MODE WARNINGS
  // ────────────────────────────────────────────────────────────

  describe('dev mode warnings', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    describe('unknown operator validation', () => {
      it('warns about unknown operators in EvaluationRule', () => {
        const condition: Condition = { record: { status: { typo: 'draft' } } } as any;
        // Unknown operator → vacuous truth → condition passes
        evaluator.evaluateSync(condition, baseContext);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown operator(s) in EvaluationRule')
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('"typo"')
        );
      });

      it('does not warn for recognized operators', () => {
        const condition: Condition = { record: { status: { eq: 'draft' } } };
        evaluator.evaluateSync(condition, baseContext);
        // Should not have any unknown-operator warnings
        const unknownOpWarns = warnSpy.mock.calls.filter(
          (args: any[]) => typeof args[0] === 'string' && args[0].includes('Unknown operator')
        );
        expect(unknownOpWarns).toHaveLength(0);
      });

      it('warns only once per unique set of unknown operators', () => {
        const condition: Condition = { record: { status: { typo: 'a' } } } as any;
        evaluator.evaluateSync(condition, baseContext);
        evaluator.evaluateSync(condition, baseContext);
        evaluator.evaluateSync(condition, baseContext);
        const unknownOpWarns = warnSpy.mock.calls.filter(
          (args: any[]) => typeof args[0] === 'string' && args[0].includes('Unknown operator')
        );
        expect(unknownOpWarns).toHaveLength(1); // only once
      });
    });

    describe('unconfigured provider warnings', () => {
      it('warns when featureFlags condition is used but context has empty flags', () => {
        const ctx: NewEvaluationContext = {
          ...baseContext,
          featureFlags: {}, // empty — no provider configured
        };
        const condition: Condition = { featureFlags: { richText: { eq: true } } };
        evaluator.evaluateSync(condition, ctx);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('condition references "featureFlags" but the context has no flags')
        );
      });

      it('does not warn when featureFlags are populated', () => {
        // baseContext already has featureFlags with values
        const condition: Condition = { featureFlags: { richText: { eq: true } } };
        evaluator.evaluateSync(condition, baseContext);
        const flagWarns = warnSpy.mock.calls.filter(
          (args: any[]) => typeof args[0] === 'string' && args[0].includes('featureFlags')
        );
        expect(flagWarns).toHaveLength(0);
      });

      it('warns when tenant condition is used but context has no tenant', () => {
        const ctx: NewEvaluationContext = {
          ...baseContext,
          tenant: undefined, // no provider configured
        };
        const condition: Condition = { tenant: { name: { eq: 'Acme' } } };
        evaluator.evaluateSync(condition, ctx);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('condition references "tenant" but the context has no tenant data')
        );
      });

      it('does not warn when tenant is populated', () => {
        const condition: Condition = { tenant: { name: { eq: 'Acme Corp' } } };
        evaluator.evaluateSync(condition, baseContext);
        const tenantWarns = warnSpy.mock.calls.filter(
          (args: any[]) => typeof args[0] === 'string' && args[0].includes('tenant')
        );
        expect(tenantWarns).toHaveLength(0);
      });

      it('warns only once per provider type', () => {
        const ctx: NewEvaluationContext = { ...baseContext, featureFlags: {} };
        const condition: Condition = { featureFlags: { richText: { eq: true } } };
        evaluator.evaluateSync(condition, ctx);
        evaluator.evaluateSync(condition, ctx);
        evaluator.evaluateSync(condition, ctx);
        const flagWarns = warnSpy.mock.calls.filter(
          (args: any[]) => typeof args[0] === 'string' && args[0].includes('featureFlags')
        );
        expect(flagWarns).toHaveLength(1); // only once
      });
    });
  });
});
