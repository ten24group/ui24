import { ADMIN_DISPLAY_OVERRIDE_CHANNEL, resolveWithDisplayOverrides } from './resolveWithDisplayOverrides';
import { evaluateTemplate } from '../utils/template';
import type { DisplayOverrideStorage } from '../types/display-override';

export interface DisplayOverrideFieldResolutionParams {
  /** Raw (pre-formatting) value read from the record at `fieldPath`. */
  storedValue: unknown;
  /** Value already run through the surface's normal formatting (dates, booleans, etc). */
  formattedValue: unknown;
  overrideMap: DisplayOverrideStorage | undefined;
  fieldPath: string;
  /** Context for `kind: 'format'` template interpolation — typically the whole record. `value` is injected/overwritten automatically. */
  templateContext: Record<string, unknown>;
  /** Defaults to `ADMIN_DISPLAY_OVERRIDE_CHANNEL` — ui24's admin surfaces resolve with this channel. */
  channel?: string;
}

export interface DisplayOverrideFieldResolution {
  /** Final value to render for this field. */
  value: unknown;
  /** True when a `kind: 'value'` (or legacy raw-value) override replaced the stored value. */
  active: boolean;
  /** The override's raw `value` payload, when `active` (used for chrome / edit-modal prefill). */
  overrideValue: unknown;
  /** True when a `kind: 'visibility'` entry resolved `visible: false` — caller should hide the field. */
  hidden: boolean;
}

/**
 * Resolves a single field's display-override entry (if any) against the surface's already-formatted
 * value, applying every `kind` the fw24 resolver can hand back:
 *
 * - `kind: 'value'` (or a legacy bare value, normalized the same way): substitutes `entry.value`.
 * - `kind: 'visibility'`: does not touch the value; sets `hidden` when `entry.visible === false`.
 * - `kind: 'format'`: interpolates `entry.value` as a `{placeholder}` template (see
 *   `core/utils/template.ts`, the same mechanism used by `linkConfig.displayText` elsewhere) against
 *   `templateContext` plus a `value` key holding the surface-formatted value.
 *
 * Channel scoping is handled by `resolveWithDisplayOverrides` itself: passing `channel` makes it try
 * `fieldPath@channel` before the bare `fieldPath` key, so an entry stored under a different channel
 * (e.g. `fieldPath@public`) is simply not found and this returns the untouched formatted value.
 */
export function resolveDisplayOverrideForField(
  params: DisplayOverrideFieldResolutionParams
): DisplayOverrideFieldResolution {
  const {
    storedValue,
    formattedValue,
    overrideMap,
    fieldPath,
    templateContext,
    channel = ADMIN_DISPLAY_OVERRIDE_CHANNEL,
  } = params;

  const { valueFromOverride, entry } = resolveWithDisplayOverrides({
    storedValue,
    overrideMap,
    fieldPath,
    channel,
  });

  if (valueFromOverride) {
    return { value: entry?.value, active: true, overrideValue: entry?.value, hidden: false };
  }

  if (entry?.kind === 'visibility') {
    return { value: formattedValue, active: false, overrideValue: undefined, hidden: entry.visible === false };
  }

  if (entry?.kind === 'format' && typeof entry.value === 'string') {
    const value = evaluateTemplate(entry.value, { ...templateContext, value: formattedValue });
    return { value, active: false, overrideValue: undefined, hidden: false };
  }

  return { value: formattedValue, active: false, overrideValue: undefined, hidden: false };
}
