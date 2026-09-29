import { Check, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { JobFeedItem, SwipeDirection } from "@/lib/types";
import { useJobQueue } from "@/stores/useJobQueue";

import { EmptyState, ErrorNotice, Spinner } from "../ui";
import { JobDetailsModal } from "./JobDetailsModal";
import { SwipeCard, type SwipeCommand } from "./SwipeCard";

/** How many cards are mounted at once. Two are visible; the third pre-renders. */
const VISIBLE_CARDS = 3;

export function SwipeDeck({ seekerId }: { seekerId: string }) {
  const queue = useJobQueue((state) => state.queue);
  const isLoading = useJobQueue((state) => state.isLoading);
  const error = useJobQueue((state) => state.error);
  const exhausted = useJobQueue((state) => state.exhausted);
  const initialise = useJobQueue((state) => state.initialise);
  const commitSwipe = useJobQueue((state) => state.commitSwipe);

  const [command, setCommand] = useState<SwipeCommand | null>(null);
  const [detailsJob, setDetailsJob] = useState<JobFeedItem | null>(null);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  /**
   * Runs when a card finishes flying off screen. Clearing the command in the
   * same update as the queue shift matters: the card promoted to the top would
   * otherwise inherit the old command and fly straight off too.
   */
  const handleSwiped = useCallback(
    (direction: SwipeDirection) => {
      setCommand(null);
      commitSwipe(direction, seekerId);
    },
    [commitSwipe, seekerId],
  );

  const triggerSwipe = useCallback((direction: SwipeDirection) => {
    setCommand({ direction, nonce: Date.now() });
  }, []);

  // Keyboard support: genuinely useful on desktop, and free accessibility.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (detailsJob) return; // the modal owns the keyboard while it's open
      if (event.key === "ArrowLeft") triggerSwipe("left");
      if (event.key === "ArrowRight") triggerSwipe("right");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detailsJob, triggerSwipe]);

  if (isLoading && queue.length === 0)
    return <Spinner label="Finding jobs for you…" />;

  if (error && queue.length === 0) {
    return (
      <div className="p-5">
        <ErrorNotice message={error} onRetry={() => void initialise(true)} />
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <EmptyState
        title={exhausted ? "That's every job for now" : "No jobs yet"}
        message={
          exhausted
            ? "You have been through every posting that matches your preferences. Widen them in your profile, or check back later."
            : "Nothing matches your preferences right now. Try widening them in your profile."
        }
        actionLabel="Refresh"
        onAction={() => void initialise(true)}
      />
    );
  }

  const visible = queue.slice(0, VISIBLE_CARDS);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mx-auto w-full max-w-md flex-1 px-4">
        {visible.map((job, index) => (
          <SwipeCard
            key={job.id}
            job={job}
            isTop={index === 0}
            depth={index}
            command={index === 0 ? command : null}
            onSwiped={handleSwiped}
            onTap={() => setDetailsJob(job)}
          />
        ))}
      </div>

      <div className="flex items-start justify-center gap-8 py-5">
        <ControlButton
          label="Skip"
          tone="skip"
          onClick={() => triggerSwipe("left")}
          ariaLabel="Skip this job"
        >
          <X className="h-6 w-6" />
        </ControlButton>

        <ControlButton
          label="Details"
          tone="neutral"
          onClick={() => setDetailsJob(queue[0] ?? null)}
          ariaLabel="Show the full job description"
        >
          <ChevronUp className="h-5 w-5" />
        </ControlButton>

        <ControlButton
          label="Apply"
          tone="apply"
          onClick={() => triggerSwipe("right")}
          ariaLabel="Apply to this job"
        >
          <Check className="h-6 w-6" />
        </ControlButton>
      </div>

      <JobDetailsModal
        job={detailsJob}
        onClose={() => setDetailsJob(null)}
        onApply={() => {
          setDetailsJob(null);
          triggerSwipe("right");
        }}
        onSkip={() => {
          setDetailsJob(null);
          triggerSwipe("left");
        }}
      />
    </div>
  );
}

function ControlButton({
  label,
  tone,
  onClick,
  ariaLabel,
  children,
}: {
  label: string;
  tone: "skip" | "apply" | "neutral";
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          "flex items-center justify-center rounded-full bg-card transition active:scale-95",
          tone === "neutral"
            ? "h-12 w-12 border border-border text-muted hover:text-white"
            : "h-16 w-16 border-2",
          tone === "skip" && "border-red text-red hover:bg-red-dim",
          tone === "apply" && "border-green text-green hover:bg-green-dim",
        )}
      >
        {children}
      </button>
      <span className="text-[11px] font-semibold text-muted-dark">{label}</span>
    </div>
  );
}
