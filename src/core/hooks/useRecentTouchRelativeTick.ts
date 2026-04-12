import { useEffect, useState } from 'react';
import { UI24_RECENT_TOUCH_RELATIVE_REFRESH_MS } from '../utils/recent-touch-relative';

/**
 * Bumps a counter on an interval while `active` is true so “… ago” strings recompute (dayjs `fromNow`).
 */
export function useRecentTouchRelativeTick(active: boolean): number {
  const [ tick, setTick ] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick(n => n + 1), UI24_RECENT_TOUCH_RELATIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [ active ]);
  return tick;
}
