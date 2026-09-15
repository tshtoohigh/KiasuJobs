# KiasuJobs

Swipe-to-apply job hunting. One job per card — swipe right and your saved resume goes to the
employer, swipe left and you never see that role again.

Built the same way as RS Finance: a **Vite + React web app** that runs in your browser, wrapped with
**Capacitor** when you want an Android APK.

```
src/          the app
supabase/     database schema + demo data
landing/      optional Next.js marketing page (separate, self-contained)
```

---

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

You'll see a setup screen until you connect a database. That's the next step.

## Connect Supabase (one time, ~2 minutes)

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, click **Run**.
3. Same again with `supabase/seed.sql` — this creates 3 demo employers, 12 live jobs and a test
   seeker, so the deck isn't empty.
4. Go to **Settings → API** and copy:
   - **Project URL**
   - **anon public** key
5. Paste both into the top of `src/lib/supabase.ts`, replacing the placeholders.

Save the file. Vite hot-reloads and the setup screen disappears.

> The anon key belongs in client code — every table is protected by Row Level Security, so it grants
> no access to anyone else's data on its own. Never paste the `service_role` key.

> If `seed.sql` errors on `crypt`, run this first, then re-run the seed:
> `create extension if not exists pgcrypto with schema extensions;`

## Sign in

Demo accounts from `seed.sql` — password `password123` for all of them:

| Email                        | Role       | What's there                                        |
| ---------------------------- | ---------- | --------------------------------------------------- |
| `seeker@kiasujobs.test`      | Job seeker | Onboarded, wide preferences, 1 existing application |
| `hiring@kopitech.test`       | Employer   | Kopi Tech · 4 live postings, 1 applicant            |
| `hiring@merliondigital.test` | Employer   | Merlion Digital · 4 live postings                   |
| `hiring@sembawangsys.test`   | Employer   | Sembawang Systems · 4 live postings                 |

Or create your own account — the sign-up form asks which role you want.

> Supabase turns email confirmation **on** by default. For a smoother dev loop, switch it off under
> **Authentication → Providers → Email**, or click the link in the email it sends.

---

## Try the end-to-end slice

Worth walking this first — it crosses every layer of the app:

1. Sign in as `hiring@kopitech.test` → **Post a job** → fill it in → **Publish job**
2. Sign out, sign in as `seeker@kiasujobs.test`
3. The new role is in the deck. Click the card to read it in full, then **drag it right**
4. "Applied to …" appears instantly — before the database write finishes
5. **Applications** tab → the job is listed as _Applied_
6. Sign back in as the employer → the posting shows a **1 new** badge
7. Open it. The applicant is there with their resume. The seeker's tracker now reads
   _Viewed by employer_
8. Click **Shortlisted** → the seeker's tracker advances

---

## How the swipe deck works

Three separate concerns:

**Gesture physics** — `src/hooks/useSwipeCard.ts`

Built on Pointer Events, so mouse, touch and pen all work from the same code. A card commits when
it crosses 28% of its width **or** when horizontal velocity exceeds 0.55 px/ms, so a fast flick
works without dragging the full distance. Below that it springs back.

During a drag, `transform` is written **straight to the DOM node** rather than through React state —
a `setState` per `pointermove` would re-render the card ~60 times a second and visibly lag your
finger. The APPLY/SKIP stamps fade in via CSS custom properties (`--apply-op`, `--skip-op`) written
by the same code, for the same reason.

Keyboard works too: **←** skips, **→** applies.

**Pre-fetching** — `src/stores/useJobQueue.ts`

The queue holds 10 cards and tops up in the background once it drops to 5. Top-ups send the ids
currently held to `get_job_feed(p_limit, p_exclude)`, so the server never returns a card already on
screen. Only the very first load shows a spinner.

**Optimistic apply** — `commitSwipe` in the same file

The card is removed and "Applied to …" shows immediately; the write happens afterwards. If it fails,
the card returns to the **front** of the queue so you see what didn't send. An "already applied"
error is treated as success, since the end state the user wanted is the end state on the server.

`apply_to_job` writes the application and the swipe record in one statement, so a dropped connection
can't leave a skipped card with no application behind it. It's idempotent per `(job, seeker)`.

---

## 🚩 RLS decisions that need your call

`supabase/schema.sql` has 27 policies. Five are judgement calls — I picked a default and flagged it
rather than deciding silently.

1. **Company profiles are readable by every signed-in user.** A card has to render the company name
   and logo, and denormalising them onto each posting would let them drift. Nothing private lives on
   that table.
2. **`users.role` is nullable.** Google sign-ups arrive without a role, so they land on a
   role-selection screen. Defaulting to `seeker` would silently mis-file anyone signing up to hire.
3. **Seekers cannot withdraw an application.** There's no seeker `UPDATE`/`DELETE` policy on
   `applications`. _Decide:_ should withdrawal set a `withdrawn` status, or delete the row?
4. **An employer can read a seeker's resume only after that seeker applies to one of their
   postings.** Enforced by a storage policy on the object path, so `createSignedUrl` fails for
   anyone else even with a valid path. Opening this up to a searchable candidate database is a much
   bigger privacy decision.
5. **Left-swipes are permanent.** No undo. _Decide:_ do you want a "rewind last swipe"?

One table beyond the original spec: **`job_swipes`**. "Swipe left → don't show again" needs
persistence, and `applications` only records right-swipes.

---

## Android APK

See **[BUILD_APK.md](./BUILD_APK.md)**. Short version:

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android
```

Then **Build → Build Bundle(s) / APK(s) → Build APK(s)** in Android Studio.

## Tech stack

See **[TECH_STACK.md](./TECH_STACK.md)** for the full breakdown and the reasoning behind each choice.

| Layer          | Choice                                          |
| -------------- | ----------------------------------------------- |
| UI             | React 18 + TypeScript                           |
| Build          | Vite 5                                          |
| Styling        | Tailwind CSS 3.4                                |
| Routing        | React Router 6                                  |
| State          | Zustand                                         |
| Backend        | Supabase (Postgres + Auth + Storage + Realtime) |
| Native wrapper | Capacitor 6                                     |
| Icons          | lucide-react                                    |

## Scripts

| Command             | Does                                          |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server with hot reload                    |
| `npm run build`     | Type-check then production build into `dist/` |
| `npm run preview`   | Serve the production build locally            |
| `npm run typecheck` | Types only, no build                          |

## Landing page (optional)

A separate Next.js marketing page lives in `landing/`. It's fully self-contained:

```bash
cd landing
npm install
npm run dev      # → http://localhost:3000
```

Deploy to Vercel with root directory `landing`, and set `NEXT_PUBLIC_SITE_URL` to your domain.

## Testing on your phone over Wi-Fi

`vite.config.ts` sets `server.host = true`, so the dev server is reachable on your network. Run
`npm run dev` and use the **Network** URL it prints (e.g. `http://192.168.1.20:5173`) on your phone.
Both devices need to be on the same Wi-Fi.
