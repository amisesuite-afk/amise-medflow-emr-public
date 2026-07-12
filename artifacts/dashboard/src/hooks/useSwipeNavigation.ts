import { useRef, useEffect, type RefObject } from 'react';

interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enabled?: boolean;
}

const MIN_SWIPE_DISTANCE = 50;

/**
 * Detects horizontal swipe gestures on a ref element.
 * A swipe is recognised when horizontal delta >= 50 px and exceeds vertical delta.
 */
export function useSwipeNavigation<T extends HTMLElement = HTMLElement>(
  { onSwipeLeft, onSwipeRight, enabled = true }: SwipeCallbacks,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      touchStart.current = null;

      if (Math.abs(dx) < MIN_SWIPE_DISTANCE) return;
      if (Math.abs(dx) <= Math.abs(dy)) return;

      if (dx < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onSwipeLeft, onSwipeRight]);

  return ref;
}
