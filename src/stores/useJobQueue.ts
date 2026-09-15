import { create } from "zustand";

import { FEED_CONFIG, describeSupabaseError } from "@/lib/supabase";
import { applyToJob, fetchJobFeed, skipJob } from "@/services/jobs";
import type { JobFeedItem, SwipeDirection } from "@/lib/types";

import { showToast } from "./useToast";

interface JobQueueState {
  queue: JobFeedItem[];
  /** True only for the very first load — swipes never wait on a spinner. */
  isLoading: boolean;
  isRefilling: boolean;
  /** The server has no more matching jobs for now. */
  exhausted: boolean;
  error: string | null;
  appliedCount: number;

  initialise: (force?: boolean) => Promise<void>;
  refillIfNeeded: () => Promise<void>;
  commitSwipe: (direction: SwipeDirection, seekerId: string) => void;
  reset: () => void;
}

const initialState = {
  queue: [] as JobFeedItem[],
  isLoading: false,
  isRefilling: false,
  exhausted: false,
  error: null as string | null,
  appliedCount: 0,
};

export const useJobQueue = create<JobQueueState>((set, get) => ({
  ...initialState,

  /** First page. `force` re-fetches from scratch after preferences change. */
  initialise: async (force = false) => {
    const { queue, isLoading } = get();
    if (isLoading) return;
    if (queue.length > 0 && !force) return;

    set({
      isLoading: true,
      error: null,
      ...(force ? { exhausted: false } : {}),
    });
    try {
      const jobs = await fetchJobFeed([], FEED_CONFIG.pageSize);
      set({
        queue: jobs,
        isLoading: false,
        exhausted: jobs.length === 0,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: describeSupabaseError(error, "Could not load jobs."),
      });
    }
  },

  /**
   * Background top-up. Called after every swipe; does nothing until the buffer
   * falls to the threshold. Excluding held ids stops the server handing back
   * cards that are still on screen.
   */
  refillIfNeeded: async () => {
    const { queue, isRefilling, exhausted } = get();
    if (isRefilling || exhausted) return;
    if (queue.length > FEED_CONFIG.refillThreshold) return;

    set({ isRefilling: true });
    try {
      const jobs = await fetchJobFeed(
        queue.map((job) => job.id),
        FEED_CONFIG.pageSize,
      );

      set((state) => {
        // Guard against a card swiped while this request was in flight.
        const held = new Set(state.queue.map((job) => job.id));
        const additions = jobs.filter((job) => !held.has(job.id));
        return {
          queue: [...state.queue, ...additions],
          isRefilling: false,
          exhausted: jobs.length === 0,
        };
      });
    } catch {
      // A failed top-up isn't worth interrupting the user: there are still
      // cards on screen, and the next swipe retries.
      set({ isRefilling: false });
    }
  },

  /**
   * The optimistic path. The card leaves the deck and the confirmation shows
   * immediately; the write happens after. On failure the card goes back to the
   * FRONT of the queue so the user sees what didn't send.
   */
  commitSwipe: (direction, seekerId) => {
    const [card, ...rest] = get().queue;
    if (!card) return;

    set((state) => ({
      queue: rest,
      appliedCount:
        direction === "right" ? state.appliedCount + 1 : state.appliedCount,
    }));

    if (direction === "right") showToast(`Applied to ${card.title}`, "success");

    const rollback = () =>
      set((state) => ({
        queue: [card, ...state.queue],
        appliedCount:
          direction === "right"
            ? Math.max(0, state.appliedCount - 1)
            : state.appliedCount,
      }));

    void (async () => {
      try {
        if (direction === "right") {
          await applyToJob(card.id);
        } else {
          await skipJob(seekerId, card.id);
        }
        await get().refillIfNeeded();
      } catch (error) {
        const message = describeSupabaseError(
          error,
          "That did not go through.",
        );

        // Already applied is not a real failure — the end state the user
        // wanted is the end state on the server, so keep the card gone.
        if (message.includes("already applied")) {
          void get().refillIfNeeded();
          return;
        }

        rollback();
        showToast(message, "error");
      }
    })();
  },

  reset: () => set({ ...initialState }),
}));
