import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kiasujobs/shared';

import { env } from './env';

/**
 * Single Supabase client for the app.
 *
 * React Native specifics worth keeping:
 *  - `storage: AsyncStorage` persists the session across app restarts.
 *  - `detectSessionInUrl: false` — there is no URL bar to parse; the OAuth
 *    callback is handled explicitly in AuthProvider.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE is the right flow for a native app: the code verifier stays on the
    // device, so the authorization code alone is useless if intercepted.
    // It also means the OAuth callback carries a `code` we exchange manually.
    flowType: 'pkce',
  },
});

/**
 * Normalises the many error shapes supabase-js can throw into something we can
 * put in front of a user.
 */
export function describeSupabaseError(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) {
    // Postgres constraint noise isn't useful to a user; translate the ones we
    // expect to hit.
    if (error.message.includes('applications_unique_seeker_job')) {
      return 'You have already applied to this job.';
    }
    if (error.message.toLowerCase().includes('network request failed')) {
      return 'No connection. Check your network and try again.';
    }
    return error.message;
  }
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}
