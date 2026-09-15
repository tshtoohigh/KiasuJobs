/**
 * Expo inlines `EXPO_PUBLIC_*` variables at bundle time. We validate them once,
 * here, so a missing key surfaces as a readable error instead of a confusing
 * "Invalid URL" from deep inside supabase-js.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function assertPresent(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      [
        `Missing ${name}.`,
        '',
        'Create apps/mobile/.env from .env.example and restart the dev server',
        'with a cleared cache:  npm run start:clear',
        '',
        'Run `supabase status` (or `supabase start`) to see the local values.',
      ].join('\n'),
    );
  }
  return value.trim();
}

export const env = {
  supabaseUrl: assertPresent(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: assertPresent(supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
} as const;

/** How many cards the deck keeps buffered, and when it tops up. */
export const FEED_CONFIG = {
  /** Cards fetched per page. */
  pageSize: 10,
  /** Refill once the queue drops to this many cards. */
  refillThreshold: 5,
} as const;
