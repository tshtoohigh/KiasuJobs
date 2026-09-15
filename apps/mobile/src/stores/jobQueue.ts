import type { JobFeedItem, SwipeDirection } from '@kiasujobs/shared';
import { create } from 'zustand';

import { FEED_CONFIG } from '@/lib/env';
import { describeSupabaseError } from '@/lib/supabase';
import { applyToJob, fetchJobFeed, skipJob } from '@/services/jobs';

import { showToast } from './toast';

interface JobQueueState {
  queue: JobFeedItem[];
  /** True only for the very first load — swipes never wait on a spinner. */
  isLoading: boolean;
  isRefilling: boolean;
  /** The server has no more matching jobs for now. */
  exhausted: boolean;
  error: string | null;
  /** Ids applied to in this session, used by the tracker to refresh. */
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

  /**
   * First page. `force` re-fetches from scratch after preferences change or on
   * pull-to-refresh.
   */
  initialise: async (force = false) => {
    const { queue, isLoading } = get();
    if (isLoading) return;
    if (queue.length > 0 && !force) return;

    set({ isLoading: true, error: null, ...(force ? { exhausted: false } : {}) });
    try {
      const jobs = await fetchJobFeed([], FEED_CONFIG.pageSize);
      set({
        queue: jobs,
        isLoading: false,
        exhausted: jobs.length === 0,
        error: null,
      });
    } catch (error) {
      set({ isLoading: false, error: describeSupabaseError(error, 'Could not load jobs.') });
    }
  },

  /**
   * Background top-up. Called after every swipe; does nothing unless the buffer
   * has fallen to the refill threshold. Excluding the ids we already hold stops
   * the server handing back cards that are still on screen.
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
        // Guard against a card that was swiped while this request was in flight.
        const held = new Set(state.queue.map((job) => job.id));
        const additions = jobs.filter((job) => !held.has(job.id));
        return {
          queue: [...state.queue, ...additions],
          isRefilling: false,
          exhausted: jobs.length === 0,
        };
      });
    } catch {
      // A failed top-up is not worth interrupting the user over — there are
      // still cards on screen, and the next swipe retries.
      set({ isRefilling: false });
    }
  },

  /**
   * The optimistic path. The card leaves the deck and the confirmation shows
   * immediately; the write happens after. If it fails we put the card back
   * exactly where it was and say so.
   */
  commitSwipe: (direction, seekerId) => {
    const [card, ...rest] = get().queue;
    if (!card) return;

    set((state) => ({
      queue: rest,
      appliedCount: direction === 'right' ? state.appliedCount + 1 : state.appliedCount,
    }));

    if (direction === 'right') {
      showToast(`Applied to ${card.title}`, 'success');
    }

    const rollback = () => {
      set((state) => ({
        // Back to the front of the queue so the user sees what failed.
        queue: [card, ...state.queue],
        appliedCount:
          direction === 'right' ? Math.max(0, state.appliedCount - 1) : state.appliedCount,
      }));
    };

    void (async () => {
      try {
        if (direction === 'right') {
          await applyToJob(card.id);
        } else {
          await skipJob(seekerId, card.id);
        }
        // Keep the buffer full for the next swipe.
        await get().refillIfNeeded();
      } catch (error) {
        const message = describeSupabaseError(error, 'That did not go through.');

        // An already-applied job is not a real failure: the end state the user
        // wanted is the end state on the server, so keep the card gone.
        if (message.includes('already applied')) {
          void get().refillIfNeeded();
          return;
        }

        rollback();
        showToast(message, 'error');
      }
    })();
  },

  reset: () => set({ ...initialState }),
}));
