# KiasuJobs — Technical Overview

Every tool and architectural decision, written so a developer can understand and rebuild the project
without AI assistance.

---

## 1. Languages

| Language             | Where                              | Why                                            |
| -------------------- | ---------------------------------- | ---------------------------------------------- |
| **TypeScript**       | All app code (`.ts`, `.tsx`)       | Type safety catches bugs before runtime        |
| **TSX**              | React components                   | HTML-like syntax inside TypeScript             |
| **CSS**              | `src/index.css` + Tailwind classes | Styling                                        |
| **SQL (PostgreSQL)** | `supabase/schema.sql`              | Tables, security policies, triggers, functions |
| **HTML**             | `index.html`                       | Single entry point the app mounts into         |

---

## 2. Core Framework & Build

| Tool        | Version | Role                                      |
| ----------- | ------- | ----------------------------------------- |
| **React**   | 18.3    | UI library                                |
| **Vite**    | 5.2     | Build tool + dev server (fast hot reload) |
| **Node.js** | 18+     | Runs the tooling                          |

**Why Vite?** Native ES modules make it dramatically faster than webpack, and Create-React-App is
deprecated. It's the modern default.

**Why not React Native?** An earlier version of this app was Expo/React Native. It worked, but you
could only run it by installing Expo Go on a phone and pointing it at a Metro bundler. A Vite web app
opens in a browser with one command, and Capacitor still gets you a real Android app. Faster loop,
same result.

---

## 3. Styling

| Tool                       | Role                                                                        |
| -------------------------- | --------------------------------------------------------------------------- |
| **Tailwind CSS 3.4**       | Utility-first CSS — style with classes, not separate files                  |
| **PostCSS + Autoprefixer** | Processes Tailwind, adds browser prefixes                                   |
| **clsx + tailwind-merge**  | Conditionally combine classes without conflicts (`cn()` in `src/lib/cn.ts`) |
| **lucide-react**           | Icon set                                                                    |

The design system lives once in `tailwind.config.ts` — `bg-accent` → `#22F0FF`, `text-muted` →
`#AEBAD0`. Change a colour there and it changes everywhere.

---

## 4. Routing & State

| Tool               | Role                                                      |
| ------------------ | --------------------------------------------------------- |
| **React Router 6** | Navigation between pages                                  |
| **Zustand**        | Global state — one store per concern, minimal boilerplate |

**Routing is centralised.** `src/stores/useAuth.ts` derives an `AuthStage` from the session and
profile row:

```
loading → signed-out → needs-role → needs-onboarding → ready
```

`src/App.tsx` is the only file that maps a stage to routes. Pages never redirect on auth state
themselves, which is what keeps navigation predictable.

**Zustand pattern.** Store actions update local state _and_ write to the database in the same
function. `useJobQueue.commitSwipe` is the clearest example — it removes the card, shows the
confirmation, then does the write, and rolls the card back if the write fails.

---

## 5. Backend — Supabase

Postgres with an API, auth and file storage attached. Replaces writing a server.

| Feature                | Used for                                        |
| ---------------------- | ----------------------------------------------- |
| **Postgres**           | 6 tables, 2 views, 2 functions                  |
| **Auth**               | Email/password + Google OAuth (PKCE)            |
| **Row Level Security** | All access control — 27 policies                |
| **Storage**            | Resumes (private) and company logos (public)    |
| **Realtime**           | Live applicant counts on the employer dashboard |
| **RPC**                | `get_job_feed`, `apply_to_job`                  |

### Why the security lives in the database

Every rule is a Postgres policy, not an `if` statement in React. A malicious client holding the anon
key still cannot read another user's applications, because the database itself refuses.

The clearest example: an employer can only read a candidate's resume **after** that candidate applies
to one of their postings. That's a storage policy matching the object path against the applications
table — not app code that could be bypassed.

### Tables

| Table               | Holds                                              |
| ------------------- | -------------------------------------------------- |
| `users`             | One row per auth user, carries the role            |
| `seeker_profiles`   | Resume path + the preferences that filter the deck |
| `employer_profiles` | Company identity shown on every card               |
| `job_postings`      | The jobs                                           |
| `applications`      | Created by a right-swipe, advanced by the employer |
| `job_swipes`        | Every decision, so a skipped card never returns    |

Two views (`seeker_application_details`, `job_applicant_details`) flatten the joins the list screens
need. Both are `security_invoker`, so RLS still applies through them.

---

## 6. The swipe deck

The only genuinely hard part of the UI. Three concerns, deliberately separated:

**`src/hooks/useSwipeCard.ts` — physics.** Pointer Events (one code path for mouse, touch and pen).
Commits at 28% of card width or 0.55 px/ms flick velocity; springs back otherwise. Rotation is
interpolated from horizontal offset up to ±9°.

The important detail: during a drag, `transform` is written directly to the DOM node. Routing that
through `setState` would re-render the card on every `pointermove` — roughly 60 times a second — and
you would feel the lag. The APPLY/SKIP stamp opacities travel as CSS custom properties for the same
reason.

**`src/stores/useJobQueue.ts` — pre-fetching.** Holds 10 cards, refills at 5 in the background,
and tells the server which ids it already has so a refill can't return a visible card.

**Same file — optimistic apply.** The card leaves and the toast fires before the write. Failure puts
it back at the front of the queue.

---

## 7. Native wrapper — Capacitor 6

Wraps the built `dist/` folder in a native Android shell (a WebView plus native APIs). One codebase
serves browser, installable PWA and Android app. See `BUILD_APK.md`.

---

## 8. Project layout

```
index.html                 mount point
vite.config.ts             build config, @ alias, LAN host
tailwind.config.ts         design tokens
capacitor.config.ts        native app id/name
public/                    manifest, service worker, icons

src/
  main.tsx                 mounts React + Router
  App.tsx                  ALL routing decisions
  index.css                Tailwind entry
  lib/
    supabase.ts            client + credentials + error messages
    types.ts               one import point for the data model
    enums.ts               mirrors the Postgres enums
    models.ts              row shapes
    database.ts            typed schema for supabase-js
    format.ts              salary/location/relative-time formatting
    cn.ts                  className helper
  hooks/useSwipeCard.ts    gesture physics
  stores/
    useAuth.ts             session + auth stage
    useJobQueue.ts         prefetch queue + optimistic apply
    useToast.ts            one-at-a-time toasts
  services/                every Supabase call, grouped by resource
  components/
    ui.tsx                 buttons, fields, chips, badges
    deck/                  SwipeCard, SwipeDeck, JobCard, JobDetailsModal
    layout/AppShell.tsx    phone frame + bottom tabs
    ToastHost.tsx
  pages/                   one file per screen

supabase/
  schema.sql               everything: tables, RLS, storage, functions, views
  seed.sql                 demo employers, 12 jobs, a test seeker

landing/                   optional Next.js marketing page, self-contained
```

---

## 9. Things deliberately left out

| Not used             | Why                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Redux                | Zustand does the same job in a fraction of the code                                                                      |
| A custom server      | Supabase covers auth, data and files                                                                                     |
| An animation library | Pointer Events + CSS transforms are enough and ship no extra bytes                                                       |
| Env files            | Credentials sit in `src/lib/supabase.ts`; the anon key is public by design and RLS is the real boundary                  |
| A test suite         | Not written yet. The riskiest logic (`useSwipeCard`, `commitSwipe`, the RLS policies) is where tests would pay off first |
