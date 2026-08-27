import { resolveDisplayOverrideForField } from './resolveDisplayOverrideForField';
import { ADMIN_DISPLAY_OVERRIDE_CHANNEL } from './resolveWithDisplayOverrides';

describe('resolveDisplayOverrideForField', () => {
  it('passes through the formatted value when there is no override map', () => {
    const result = resolveDisplayOverrideForField({
      storedValue: 'raw',
      formattedValue: 'formatted',
      overrideMap: undefined,
      fieldPath: 'name',
      templateContext: {},
    });
    expect(result).toEqual({ value: 'formatted', active: false, overrideValue: undefined, hidden: false });
  });

  describe('kind: "value"', () => {
    it('substitutes the override value and marks it active', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 'synced',
        formattedValue: 'synced',
        overrideMap: { logo: { kind: 'value', value: 'admin-set' } },
        fieldPath: 'logo',
        templateContext: {},
      });
      expect(result).toEqual({ value: 'admin-set', active: true, overrideValue: 'admin-set', hidden: false });
    });

    it('also substitutes a legacy bare (non-entry-shaped) value', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 'synced',
        formattedValue: 'synced',
        overrideMap: { logo: 'bare-admin-value' },
        fieldPath: 'logo',
        templateContext: {},
      });
      expect(result.value).toBe('bare-admin-value');
      expect(result.active).toBe(true);
    });
  });

  describe('kind: "visibility"', () => {
    it('hides the field when visible: false, without touching the value', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 'secret value',
        formattedValue: 'secret value',
        overrideMap: { secret: { kind: 'visibility', visible: false } },
        fieldPath: 'secret',
        templateContext: {},
      });
      expect(result.hidden).toBe(true);
      expect(result.active).toBe(false);
      expect(result.value).toBe('secret value');
    });

    it('does not hide the field when visible: true', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 'v',
        formattedValue: 'v',
        overrideMap: { nickname: { kind: 'visibility', visible: true } },
        fieldPath: 'nickname',
        templateContext: {},
      });
      expect(result.hidden).toBe(false);
    });

    it('does not hide when kind: "visibility" is present but visible is omitted', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 'v',
        formattedValue: 'v',
        overrideMap: { nickname: { kind: 'visibility' } },
        fieldPath: 'nickname',
        templateContext: {},
      });
      expect(result.hidden).toBe(false);
    });
  });

  describe('kind: "format"', () => {
    it('interpolates the format template with {value} bound to the formatted value', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 42,
        formattedValue: 42,
        overrideMap: { price: { kind: 'format', value: '{value} USD' } },
        fieldPath: 'price',
        templateContext: {},
      });
      expect(result.value).toBe('42 USD');
      expect(result.active).toBe(false);
      expect(result.hidden).toBe(false);
    });

    it('can reference other record fields from templateContext, not just {value}', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 'Lakers',
        formattedValue: 'Lakers',
        overrideMap: { teamName: { kind: 'format', value: '{value} ({city})' } },
        fieldPath: 'teamName',
        templateContext: { city: 'Los Angeles' },
      });
      expect(result.value).toBe('Lakers (Los Angeles)');
    });

    it('leaves the value untouched when the format entry has a non-string value', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 1,
        formattedValue: 1,
        overrideMap: { qty: { kind: 'format', value: 42 } },
        fieldPath: 'qty',
        templateContext: {},
      });
      expect(result.value).toBe(1);
    });
  });

  describe('@channel scoping', () => {
    it('applies an entry keyed for the resolved channel (fieldPath@channel)', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 42,
        formattedValue: 42,
        overrideMap: { [`price@${ADMIN_DISPLAY_OVERRIDE_CHANNEL}`]: { kind: 'format', value: '{value} USD' } },
        fieldPath: 'price',
        templateContext: {},
        channel: ADMIN_DISPLAY_OVERRIDE_CHANNEL,
      });
      expect(result.value).toBe('42 USD');
    });

    it('ignores an entry keyed for a different channel', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 42,
        formattedValue: 42,
        overrideMap: { 'price@public': { kind: 'format', value: '{value} USD' } },
        fieldPath: 'price',
        templateContext: {},
        channel: ADMIN_DISPLAY_OVERRIDE_CHANNEL,
      });
      expect(result.value).toBe(42);
    });

    it('falls back to the plain (channel-less) key when no channel-scoped entry exists', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 42,
        formattedValue: 42,
        overrideMap: { price: { kind: 'format', value: '{value} USD' } },
        fieldPath: 'price',
        templateContext: {},
        channel: ADMIN_DISPLAY_OVERRIDE_CHANNEL,
      });
      expect(result.value).toBe('42 USD');
    });

    it('a channel-scoped entry takes priority over a plain-key entry for the same field', () => {
      const result = resolveDisplayOverrideForField({
        storedValue: 42,
        formattedValue: 42,
        overrideMap: {
          price: { kind: 'format', value: '{value} (default)' },
          [`price@${ADMIN_DISPLAY_OVERRIDE_CHANNEL}`]: { kind: 'format', value: '{value} (admin)' },
        },
        fieldPath: 'price',
        templateContext: {},
        channel: ADMIN_DISPLAY_OVERRIDE_CHANNEL,
      });
      expect(result.value).toBe('42 (admin)');
    });
  });
});
