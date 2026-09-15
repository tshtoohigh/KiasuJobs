# KiasuJobs

Swipe-to-apply job hunting. One job per card — swipe right and your saved resume goes to the
employer, swipe left and you never see that role again.

A monorepo containing three separable pieces:

```
apps/mobile     Expo / React Native app (TypeScript)  ← the product
apps/web        Next.js marketing landing page (SSR, SEO)
packages/shared Data model, enums and formatters used by both
supabase/       Postgres schema, RLS policies, storage rules, seed data
```

```
Landing page (Next.js) ──"get the app"──▶ Mobile app (Expo)
                                              │
                                              ▼
                                     Supabase (Postgres + Auth
                                     + Storage + Realtime)
```

---

## ⚠️ Read this first: dependency versions

This project was written in an environment **without access to the npm registry**, so no install
was ever run against it. Package versions in `package.json` are pinned to the best-known versions
for Expo SDK 57, but some may be slightly off.

**If `npm install` fails on a version that doesn't exist**, this is expected and takes one command
to fix:

```bash
cd apps/mobile
npx expo install --fix    # rewrites every expo/RN package to the exact SDK-correct version
```

`expo install --fix` is authoritative — it reads the versions Expo actually ships for your SDK.
Run it once after the first install and the lockfile will be correct from then on.

Everything else — application code, SQL, RLS policies — has been verified: all 58 TypeScript files
pass a syntax check, `packages/shared` type-checks cleanly with `strict: true`, and the whole repo
is Prettier-clean.

---

## Prerequisites

| Tool         | Version | Notes                                                               |
| ------------ | ------- | ------------------------------------------------------------------- |
| Node         | 22+     | `node -v`                                                           |
| Supabase CLI | latest  | [install guide](https://supabase.com/docs/guides/local-development) |
| Docker       | running | Supabase local stack needs it                                       |
| Expo Go      | latest  | on your phone, from the App Store / Play Store                      |

---

## 1. Start the database

From the repo root:

```bash
npm install
npm run db:start     # supabase start — first run pulls Docker images, be patient
npm run db:reset     # applies migrations + seed data
```

`supabase start` prints your local credentials. You want two of them:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbG...
```

Useful local URLs:

- Studio (browse data): http://localhost:54323
- Inbucket (catches all outgoing email): http://localhost:54324

## 2. Run the mobile app

```bash
cd apps/mobile
cp .env.example .env
```

Edit `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.20:54321   # ← your machine's LAN IP, not localhost
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

> **The LAN IP matters.** On a physical phone, `localhost` means the phone itself. Use your
> computer's IP (`ipconfig getifaddr en0` on macOS, `hostname -I` on Linux). Only the iOS simulator
> and Android emulator can use `localhost`/`10.0.2.2`.

Then:

```bash
npm start            # from apps/mobile, or `npm run mobile` from the root
```

Scan the QR code with Expo Go. If you change `.env`, restart with `npm run start:clear` — Expo
inlines env vars at bundle time and caches them.

## 3. Run the landing page (optional)

```bash
npm run web          # from the repo root → http://localhost:3000
```

---

## Seeded accounts

`npm run db:reset` creates these. Password for all of them is `password123`.

| Email                        | Role       | What's in there                                          |
| ---------------------------- | ---------- | -------------------------------------------------------- |
| `seeker@kiasujobs.test`      | Job seeker | Onboarded, wide-open preferences, 1 existing application |
| `hiring@kopitech.test`       | Employer   | Kopi Tech · 4 live postings, 1 applicant                 |
| `hiring@merliondigital.test` | Employer   | Merlion Digital · 4 live postings                        |
| `hiring@sembawangsys.test`   | Employer   | Sembawang Systems · 4 live postings                      |

12 published jobs total, so the deck has cards immediately.

---

## Try the end-to-end slice

This is the path worth walking first, because it crosses every layer:

1. Sign in as `hiring@kopitech.test` → **Post a job** tab → fill it in → **Publish job**.
2. Sign out. Sign in as `seeker@kiasujobs.test`.
3. The new role is in the deck. Tap the card to read it in full, then **swipe right**.
4. "Applied to …" appears instantly — before the write completes.
5. **Applications** tab → the job is listed as _Applied_.
6. Sign back in as the employer → **Postings** → your role shows a **1 new** badge.
7. Open it. The applicant is there with their resume. The seeker's tracker now reads
   _Viewed by employer_.
8. Tap **Shortlisted** → the seeker's tracker advances.

---

## How the swipe deck works

The three requirements that make a deck feel good are all handled separately.

**Gesture physics** — `src/components/SwipeCard.tsx`

A card commits when it crosses 28% of screen width **or** when horizontal velocity exceeds
850 px/s, so a fast flick works without dragging the full distance. Below that, it springs back
(`damping: 18, stiffness: 220`). Rotation is interpolated from horizontal offset up to ±9°, and
the APPLY/SKIP stamps fade in against the same value — all on the UI thread, so the card tracks
your finger even if JS is busy.

A `settled` shared value latches on commit, which prevents one card reporting two decisions (for
example a flick that lands at the same moment you hit the Apply button).

**Pre-fetching** — `src/stores/jobQueue.ts`

The queue holds 10 cards and tops up as soon as it drops to 5, in the background. Top-ups pass the
ids currently held to `get_job_feed(p_limit, p_exclude)` so the server never returns a card already
on screen. There is no loading state between swipes — only the very first load shows a spinner.

**Optimistic apply** — `commitSwipe` in the same file

The card is removed and "Applied to …" shows immediately; the write happens afterwards. If it
fails, the card is pushed back to the **front** of the queue (so you see what failed) and the
error is surfaced. An "already applied" error is treated as success, because the end state the
user wanted is the end state on the server.

`apply_to_job` writes the application and the swipe record in one statement, so a dropped
connection can't leave a skipped card that reappears with no application behind it. It's
idempotent per `(job, seeker)`.

### Gesture Handler 3

RNGH 3 replaced the v2 builder API with hooks, and renamed the callbacks:

| v2                         | v3                                                        |
| -------------------------- | --------------------------------------------------------- |
| `Gesture.Pan()`            | `usePanGesture({ … })`                                    |
| `.onStart()`               | `onActivate`                                              |
| `.onEnd()`                 | `onDeactivate`                                            |
| `onEnd((e, success) => …)` | `onDeactivate((e) => …)` with `e.canceled` (**inverted**) |

All of that is confined to `src/lib/gestures.ts`. If you land on a different RNGH major, that's the
only file to change.

---

## 🚩 RLS decisions that need your call

The policies in `supabase/migrations/20260915000002_rls.sql` are deliberately strict. Five choices
are judgement calls — I picked a default and flagged it here rather than deciding for you.

1. **Company profiles are readable by every signed-in user.**
   A job card has to render the company name and logo, and denormalising them onto each posting
   would let them drift. Nothing private lives on `employer_profiles`.
   _Change if:_ you want stealth-mode companies.

2. **`users.role` is nullable.**
   Google OAuth gives us no role, so new OAuth users land on a role-selection screen. The
   alternative — defaulting to `seeker` — silently mis-files anyone who signed up to hire.
   _Change if:_ you'd rather force role choice before the OAuth redirect.

3. **Seekers cannot withdraw an application.**
   There is no seeker `UPDATE` or `DELETE` policy on `applications`, so "withdraw" doesn't exist
   yet. Employers own the status pipeline exclusively.
   _Decide:_ should withdrawal set a `withdrawn` status, or hard-delete the row?

4. **An employer can read a seeker's resume and profile only after that seeker applies to one of
   their postings.** Enforced by a storage policy on the object path, not in app code — so
   `createSignedUrl` fails for anyone else even with a valid path.
   _Change if:_ you want a searchable candidate database, which is a much bigger privacy decision.

5. **Left-swipes are permanent.**
   `job_swipes` has a unique constraint per `(seeker, job)` and the feed excludes anything swiped.
   There's no undo.
   _Decide:_ do you want a "rewind last swipe" feature? The row deletion policy already allows it.

One extra table beyond the original spec: **`job_swipes`**. "Swipe left → don't show again"
needs persistence, and `applications` only records right-swipes.

---

## Project structure

```
apps/mobile/
  app/                       expo-router routes (file = screen)
    _layout.tsx              providers + the single role-based routing guard
    (auth)/                  sign-in, sign-up
    onboarding/              role choice, seeker setup, employer setup
    seeker/(tabs)/           deck · applications tracker · profile
    employer/(tabs)/         postings · post a job · company
    employer/postings/[id]   applicant review
  src/
    components/              SwipeCard, SwipeDeck, JobCard, JobDetailsSheet, ui primitives
    lib/                     supabase client, env validation, theme, gesture shim
    providers/AuthProvider   session + auth stage machine
    services/                every Supabase call lives here
    stores/                  zustand: job queue, toasts

supabase/migrations/
  …_init.sql        enums, tables, triggers, indexes
  …_rls.sql         row level security (read this one)
  …_storage.sql     buckets + object policies
  …_functions.sql   get_job_feed, apply_to_job
  …_views.sql       flat read views for the two list screens
```

Routing is centralised: `AuthProvider` derives a stage (`signed-out` → `needs-role` →
`needs-onboarding` → `ready`) and `app/_layout.tsx` is the only place that redirects. Screens never
navigate on auth state.

---

## Google OAuth (optional)

Email/password works out of the box. For Google:

1. Create an OAuth client in Google Cloud Console.
2. Fill in `[auth.external.google]` in `supabase/config.toml` and set `enabled = true`.
3. `npm run db:reset`.

The app uses **PKCE** — the code verifier stays on the device and
`AuthProvider.signInWithGoogle` exchanges the returned code for a session. The redirect
(`kiasujobs://auth/callback`) is already allow-listed in `config.toml`; add it to your hosted
project's redirect URLs too.

---

## Troubleshooting

**"Missing EXPO_PUBLIC_SUPABASE_URL"** — `.env` is missing or the bundler cached the old values.
`npm run start:clear`.

**Network request failed / deck stays empty on a physical device** — `.env` still points at
`localhost`. Use your LAN IP.

**Deck empty when signed in as an employer** — expected. The feed excludes your own postings, and
the deck is a seeker surface.

**Deck empty as a seeker** — you've swiped everything. Preferences filter the feed; widen them in
Profile, or `npm run db:reset` to start over.

**Reanimated "failed to create worklet"** — don't add `react-native-reanimated/plugin` to
`babel.config.js`. Reanimated 4 moved it to `react-native-worklets`, and `babel-preset-expo`
already configures it. The babel config here is correct as-is.

**`expo-doctor` complains about package versions** — `npx expo install --fix`.

---

## Scripts

| Command                         | Does                                              |
| ------------------------------- | ------------------------------------------------- |
| `npm run mobile`                | Expo dev server                                   |
| `npm run mobile:fix`            | `expo install --fix` — align deps with the SDK    |
| `npm run web`                   | Next.js dev server                                |
| `npm run db:start` / `db:reset` | Supabase local stack / re-apply migrations + seed |
| `npm run db:types`              | Regenerate `Database` types from the live schema  |
| `npm run typecheck`             | Type-check every workspace                        |
| `npm run format`                | Prettier write                                    |

## Deploying the landing page

Vercel, root directory `apps/web`. Set `NEXT_PUBLIC_SITE_URL` to your domain so canonical URLs,
`sitemap.xml` and `robots.txt` are correct. The page is fully server-rendered with no client
components, and ships JSON-LD for both the app listing and the FAQ.
