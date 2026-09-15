import { useCallback, useRef } from "react";

import type { SwipeDirection } from "@/lib/types";

/**
 * Swipe physics for a single card, built on Pointer Events.
 *
 * The React Native build of this app used Reanimated + Gesture Handler to keep
 * the card on the UI thread. The browser equivalent is to skip React state
 * entirely during a drag and write `transform` straight to the node — a
 * setState per pointermove would re-render the card ~60 times a second and
 * visibly lag the finger.
 *
 * Overlay opacities travel as CSS custom properties (`--apply-op` / `--skip-op`)
 * for the same reason: the stamps react to the drag without React involvement.
 */

/** Fraction of card width a drag must cross to count as a decision. */
const DISTANCE_RATIO = 0.28;
/** A fast flick commits even if it never crossed the distance threshold (px/ms). */
const VELOCITY_THRESHOLD = 0.55;
const MAX_ROTATION_DEG = 9;
const FLY_OUT_MS = 220;
const SPRING_BACK_MS = 260;
/** Below this much movement we treat the gesture as a tap, not a drag. */
const TAP_SLOP_PX = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface Options {
  /** Only the top card is interactive. */
  enabled: boolean;
  onSwiped: (direction: SwipeDirection) => void;
  onTap: () => void;
}

export function useSwipeCard({ enabled, onSwiped, onTap }: Options) {
  const ref = useRef<HTMLDivElement | null>(null);

  const drag = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startTime: 0,
    dx: 0,
    dy: 0,
    /** Latches on commit so one card can't report two decisions. */
    settled: false,
  });

  const paint = useCallback((dx: number, dy: number, transitionMs: number) => {
    const el = ref.current;
    if (!el) return;

    const width = el.offsetWidth || window.innerWidth;
    const rotation = clamp(dx / width, -1, 1) * MAX_ROTATION_DEG;
    const threshold = width * DISTANCE_RATIO;

    el.style.transition =
      transitionMs > 0
        ? `transform ${transitionMs}ms cubic-bezier(.22,.61,.36,1)`
        : "none";
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotation}deg)`;
    el.style.setProperty("--apply-op", String(clamp(dx / threshold, 0, 1)));
    el.style.setProperty("--skip-op", String(clamp(-dx / threshold, 0, 1)));
  }, []);

  /** Sends the card off screen, then reports the decision. */
  const flyOut = useCallback(
    (direction: SwipeDirection) => {
      const el = ref.current;
      if (!el || drag.current.settled) return;
      drag.current.settled = true;

      const width = el.offsetWidth || window.innerWidth;
      const sign = direction === "right" ? 1 : -1;

      paint(sign * (width + 160), drag.current.dy + 60, FLY_OUT_MS);

      // The card unmounts when the queue shifts, so this only has to outlast
      // the animation.
      window.setTimeout(() => onSwiped(direction), FLY_OUT_MS);
    },
    [onSwiped, paint],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || drag.current.settled) return;
      // Ignore right-click and secondary buttons.
      if (event.button !== 0) return;

      const el = ref.current;
      el?.setPointerCapture(event.pointerId);

      drag.current = {
        ...drag.current,
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: event.timeStamp,
        dx: 0,
        dy: 0,
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = drag.current;
      if (!current.active || current.settled) return;

      current.dx = event.clientX - current.startX;
      current.dy = event.clientY - current.startY;
      paint(current.dx, current.dy, 0);
    },
    [paint],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = drag.current;
      if (!current.active || current.settled) return;
      current.active = false;

      const el = ref.current;
      if (el?.hasPointerCapture(event.pointerId))
        el.releasePointerCapture(event.pointerId);

      const { dx, dy } = current;

      // A press that barely moved is a tap: open the details instead.
      if (Math.abs(dx) < TAP_SLOP_PX && Math.abs(dy) < TAP_SLOP_PX) {
        paint(0, 0, 0);
        onTap();
        return;
      }

      const width = el?.offsetWidth || window.innerWidth;
      const elapsed = Math.max(1, event.timeStamp - current.startTime);
      const velocityX = Math.abs(dx) / elapsed;

      if (
        Math.abs(dx) > width * DISTANCE_RATIO ||
        velocityX > VELOCITY_THRESHOLD
      ) {
        flyOut(dx > 0 ? "right" : "left");
      } else {
        current.dx = 0;
        current.dy = 0;
        paint(0, 0, SPRING_BACK_MS);
      }
    },
    [flyOut, onTap, paint],
  );

  return {
    ref,
    /** Spread onto the draggable element. */
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    /** For the Skip / Apply buttons — same fly-out and callback path. */
    flyOut,
  };
}
