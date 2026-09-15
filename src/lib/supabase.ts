import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database";

// ---------------------------------------------------------------------------
// 👇 PASTE YOUR SUPABASE CREDENTIALS HERE
//
// Where to find them:
//   supabase.com → your project → Settings → API
//     • Project URL      → SUPABASE_URL
//     • anon public key  → SUPABASE_ANON_KEY
//
// The anon key is designed to ship in client code — it's safe to commit. Every
// table is protected by Row Level Security (see supabase/schema.sql), so this
// key on its own grants no access to anyone else's data.
//
// Never put the `service_role` key here. That one bypasses RLS entirely.
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";

/** True while the placeholders above are untouched, so the UI can explain itself. */
export const isSupabaseConfigured =
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !SUPABASE_ANON_KEY.includes("YOUR-ANON-KEY");

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      // localStorage keeps you signed in across reloads and app restarts.
      persistSession: true,
      autoRefreshToken: true,
      // A browser/Capacitor app does come back with tokens in the URL after OAuth.
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

/** Turns the many error shapes supabase-js throws into something user-facing. */
export function describeSupabaseError(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (!message) return fallback;

  // Translate the failures we actually expect to hit.
  if (message.includes("applications_unique_seeker_job")) {
    return "You have already applied to this job.";
  }
  if (message.toLowerCase().includes("failed to fetch")) {
    return "No connection to the server. Check your network and your Supabase URL.";
  }
  if (message.includes("Invalid login credentials")) {
    return "That email and password combination is not right.";
  }
  if (message.includes("Email not confirmed")) {
    return "Confirm your email address first, then sign in.";
  }

  return message;
}

/** How many cards the deck buffers, and when it tops up. */
export const FEED_CONFIG = {
  pageSize: 10,
  refillThreshold: 5,
} as const;
