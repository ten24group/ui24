/**
 * Tests for resolveDisabledMessage utility.
 */
import { resolveDisabledMessage } from '../resolveDisabledMessage';
import type { NewEvaluationContext } from '../../types/evaluation';

// Build a minimal evaluation context for testing
function makeCtx(overrides: Partial<NewEvaluationContext> = {}): NewEvaluationContext {
  return {
    actor: { actorId: 'user-1', groups: ['admin'], permissions: ['edit'], username: 'john', email: 'john@acme.com' },
    featureFlags: { beta: true },
    device: { isMobile: false, isTablet: false, isDesktop: true, viewport: 'xl' as const },
    pageType: 'list',
    entityName: 'team',
    record: { id: '123', status: 'active', owner: 'alice@acme.com' },
    ...overrides,
  } as NewEvaluationContext;
}

describe('resolveDisabledMessage', () => {
  it('returns undefined for falsy message', () => {
    const ctx = makeCtx();
    expect(resolveDisabledMessage(undefined, ctx)).toBeUndefined();
    expect(resolveDisabledMessage('', ctx)).toBeUndefined();
  });

  it('returns plain string as-is (no placeholders)', () => {
    const ctx = makeCtx();
    expect(resolveDisabledMessage('Field is locked', ctx)).toBe('Field is locked');
  });

  it('resolves {placeholder} from context', () => {
    const ctx = makeCtx();
    expect(resolveDisabledMessage('Contact {record.owner} to edit', ctx)).toBe('Contact alice@acme.com to edit');
  });

  it('resolves actor path', () => {
    const ctx = makeCtx();
    expect(resolveDisabledMessage('Logged in as {actor.username}', ctx)).toBe('Logged in as john');
  });

  it('resolves multiple placeholders', () => {
    const ctx = makeCtx();
    expect(resolveDisabledMessage('{actor.username} cannot edit {record.status} records', ctx))
      .toBe('john cannot edit active records');
  });

  it('leaves unresolvable placeholders as-is', () => {
    const ctx = makeCtx();
    expect(resolveDisabledMessage('Missing {nonexistent.field}', ctx))
      .toBe('Missing {nonexistent.field}');
  });

  it('merges overrides into context', () => {
    const ctx = makeCtx();
    const result = resolveDisabledMessage(
      'Selected {selectedCount} items',
      ctx,
      { selectedCount: 5 }
    );
    expect(result).toBe('Selected 5 items');
  });

  it('overrides take precedence over base context', () => {
    const ctx = makeCtx({ record: { status: 'draft' } });
    const result = resolveDisabledMessage(
      'Record is {record.status}',
      ctx,
      { record: { status: 'archived' } }
    );
    expect(result).toBe('Record is archived');
  });
});
