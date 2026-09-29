import { useEffect, useRef } from "react";

import { useSwipeCard } from "@/hooks/useSwipeCard";
import { cn } from "@/lib/cn";
import type { JobFeedItem, SwipeDirection } from "@/lib/types";

import { JobCard } from "./JobCard";

export interface SwipeCommand {
  direction: SwipeDirection;
  /** Changes on every press so a repeated direction still re-fires. */
  nonce: number;
}

interface SwipeCardProps {
  job: JobFeedItem;
  /** Only the top card is interactive; the rest just provide depth. */
  isTop: boolean;
  /** 0 for the top card, 1 for the one behind it, and so on. */
  depth: number;
  onSwiped: (direction: SwipeDirection) => void;
  onTap: () => void;
  command?: SwipeCommand | null;
}

export function SwipeCard({
  job,
  isTop,
  depth,
  onSwiped,
  onTap,
  command,
}: SwipeCardProps) {
  const { ref, handlers, flyOut } = useSwipeCard({
    enabled: isTop,
    onSwiped,
    onTap,
  });

  // Button-driven swipes reuse the same fly-out and callback path as a drag.
  const lastNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!isTop || !command) return;
    if (lastNonce.current === command.nonce) return;
    lastNonce.current = command.nonce;
    flyOut(command.direction);
  }, [command, isTop, flyOut]);

  return (
    <div
      className="absolute inset-0"
      style={{
        // Cards behind the top one sit slightly smaller and lower.
        transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.04})`,
        zIndex: 10 - depth,
        pointerEvents: isTop ? "auto" : "none",
      }}
    >
      <div
        ref={ref}
        {...(isTop ? handlers : {})}
        className={cn(
          "swipe-surface relative h-full overflow-hidden rounded-3xl border border-border bg-card shadow-2xl",
          isTop && "cursor-grab active:cursor-grabbing",
        )}
        style={{ "--apply-op": 0, "--skip-op": 0 } as React.CSSProperties}
      >
        <JobCard job={job} />

        {/* Decision stamps. Opacity is driven by the CSS custom properties the
            swipe hook writes during a drag, so they never re-render React. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-6 top-6 -rotate-12 rounded-lg border-[3px] border-green bg-green-dim px-3 py-1"
          style={{ opacity: "var(--apply-op)" }}
        >
          <span className="text-xl font-extrabold tracking-widest text-green">
            APPLY
          </span>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-6 top-6 rotate-12 rounded-lg border-[3px] border-red bg-red-dim px-3 py-1"
          style={{ opacity: "var(--skip-op)" }}
        >
          <span className="text-xl font-extrabold tracking-widest text-red">
            SKIP
          </span>
        </div>
      </div>
    </div>
  );
}
