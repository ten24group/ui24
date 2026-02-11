/**
 * Tests for ConditionRegistry.
 */
import { ConditionRegistry } from '../ConditionRegistry';

describe('ConditionRegistry', () => {
  beforeEach(() => {
    ConditionRegistry.clear();
  });

  describe('register / get', () => {
    it('registers and retrieves a condition', () => {
      ConditionRegistry.register('isAdmin', { actor: { groups: { inList: ['admin'] } } });
      const condition = ConditionRegistry.get('isAdmin');
      expect(condition).toEqual({ actor: { groups: { inList: ['admin'] } } });
    });

    it('returns undefined for unregistered condition', () => {
      expect(ConditionRegistry.get('nonexistent')).toBeUndefined();
    });

    it('overwrites existing condition with warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      ConditionRegistry.register('isAdmin', { actor: { groups: { inList: ['admin'] } } });
      ConditionRegistry.register('isAdmin', { actor: { groups: { inList: ['superadmin'] } } });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Overwriting'));
      expect(ConditionRegistry.get('isAdmin')).toEqual({
        actor: { groups: { inList: ['superadmin'] } },
      });
      warnSpy.mockRestore();
    });
  });

  describe('registerBatch', () => {
    it('registers multiple conditions at once', () => {
      ConditionRegistry.registerBatch({
        isAdmin: { actor: { groups: { inList: ['admin'] } } },
        isEditor: { actor: { groups: { inList: ['editor'] } } },
      });
      expect(ConditionRegistry.has('isAdmin')).toBe(true);
      expect(ConditionRegistry.has('isEditor')).toBe(true);
    });
  });

  describe('has', () => {
    it('returns true for registered condition', () => {
      ConditionRegistry.register('test', true);
      expect(ConditionRegistry.has('test')).toBe(true);
    });

    it('returns false for unregistered condition', () => {
      expect(ConditionRegistry.has('missing')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all conditions', () => {
      ConditionRegistry.register('a', true);
      ConditionRegistry.register('b', false);
      expect(ConditionRegistry.getNames()).toHaveLength(2);

      ConditionRegistry.clear();
      expect(ConditionRegistry.getNames()).toHaveLength(0);
      expect(ConditionRegistry.has('a')).toBe(false);
    });
  });

  describe('getNames', () => {
    it('returns all registered condition names', () => {
      ConditionRegistry.register('isAdmin', true);
      ConditionRegistry.register('isOwner', true);
      ConditionRegistry.register('canEdit', true);

      const names = ConditionRegistry.getNames();
      expect(names).toContain('isAdmin');
      expect(names).toContain('isOwner');
      expect(names).toContain('canEdit');
      expect(names).toHaveLength(3);
    });
  });

  describe('boolean literal conditions', () => {
    it('supports true as a condition', () => {
      ConditionRegistry.register('alwaysTrue', true);
      expect(ConditionRegistry.get('alwaysTrue')).toBe(true);
    });

    it('supports false as a condition', () => {
      ConditionRegistry.register('alwaysFalse', false);
      expect(ConditionRegistry.get('alwaysFalse')).toBe(false);
    });
  });

  describe('complex conditions', () => {
    it('supports logical operators', () => {
      ConditionRegistry.register('canEdit', {
        or: [
          { ref: 'isAdmin' },
          { record: { createdBy: { eq: { $ref: 'actor.actorId' } } } },
        ],
      });
      const condition = ConditionRegistry.get('canEdit');
      expect(condition).toHaveProperty('or');
    });

    it('supports nested and/or/not', () => {
      ConditionRegistry.register('complexCondition', {
        and: [
          { actor: { groups: { inList: ['admin'] } } },
          { not: { featureFlags: { maintenanceMode: { eq: true } } } },
          { or: [
            { record: { status: { eq: 'active' } } },
            { record: { status: { eq: 'draft' } } },
          ]},
        ],
      });
      expect(ConditionRegistry.has('complexCondition')).toBe(true);
    });
  });
});
