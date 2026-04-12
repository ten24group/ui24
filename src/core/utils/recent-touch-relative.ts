import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** Interval for refreshing “… ago” copy (rows, detail alert, cards). */
export const UI24_RECENT_TOUCH_RELATIVE_REFRESH_MS = 30_000;

/** Short relative phrase for a save/mutation time (e.g. "2 minutes ago"). */
export function formatRecentTouchRelative(touchedAtMs: number): string {
  return dayjs(touchedAtMs).fromNow();
}

/**
 * Single-line English status for a recent save touch (row title, card caption).
 * Detail pages may still compose `${t('Updated')} ${formatRecentTouchRelative(ts)}` for i18n.
 */
export function englishRecentSaveUpdatedLine(touchedAtMs: number | undefined): string {
  return touchedAtMs != null
    ? `Updated ${formatRecentTouchRelative(touchedAtMs)}`
    : 'Updated just now';
}
