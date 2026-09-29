# Deploying the Edge Functions

Two functions power the parts of KiasuJobs that need a server:

| Function       | Does                                                       | Needs a key?          |
| -------------- | ---------------------------------------------------------- | --------------------- |
| `ingest-jobs`  | Pulls real job openings from public job APIs on a schedule | Optional (Adzuna)     |
| `parse-resume` | Reads a resume and extracts match keywords                 | Optional (OpenRouter) |

Both degrade gracefully. Without keys you still get real jobs from three sources
and keyword matching via dictionary lookup.

## Prerequisites

```bash
npm install -g supabase
supabase login
supabase link --project-ref owgbiyehihsdvpkgsllg
```

---

## 1. Database first

In the Supabase SQL Editor, run in this order:

1. `schema.sql` — tables, RLS, storage, functions (skip if already done)
2. `upgrade-v2.sql` — external job columns, AI fields, match scoring
3. `seed.sql` — demo employers and jobs (optional)

`upgrade-v2.sql` is idempotent, so re-running it is harmless.

---

## 2. Resume parsing — `parse-resume`

```bash
supabase functions deploy parse-resume
```

That's enough to make it work. It falls back to dictionary matching against
~200 skills, which is free and instant.

For better extraction, add an [OpenRouter](https://openrouter.ai) key (same
provider RS Finance uses, free models available):

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

The function tries these free models in order until one answers:

- `meta-llama/llama-3.3-70b-instruct:free`
- `google/gemini-2.0-flash-exp:free`
- `meta-llama/llama-3.1-8b-instruct:free`

The response tells you which path ran — `mode: "ai"` or `mode: "heuristic"`.

> The key stays in Supabase secrets and is only read server-side. It never
> reaches the browser.

---

## 3. Real job ingestion — `ingest-jobs`

```bash
supabase functions deploy ingest-jobs --no-verify-jwt
supabase secrets set INGEST_SECRET=$(openssl rand -hex 24)
```

`--no-verify-jwt` is required: the caller is Postgres on a cron, not a signed-in
user. Authorisation is the `INGEST_SECRET` header instead.

### Sources

| Source    | Key  | What you get                 |
| --------- | ---- | ---------------------------- |
| Remotive  | none | Remote tech roles            |
| Arbeitnow | none | Global, incl. visa-sponsored |
| Jobicy    | none | Remote, with regions         |
| Adzuna    | free | **Real Singapore listings**  |

For Singapore jobs, get free credentials at
[developer.adzuna.com](https://developer.adzuna.com/):

```bash
supabase secrets set ADZUNA_APP_ID=your-app-id
supabase secrets set ADZUNA_APP_KEY=your-app-key
supabase secrets set ADZUNA_COUNTRY=sg
```

### Run it once by hand

```bash
curl -X POST \
  -H "x-ingest-secret: YOUR_INGEST_SECRET" \
  https://owgbiyehihsdvpkgsllg.supabase.co/functions/v1/ingest-jobs
```

You get a report back:

```json
{
  "ok": true,
  "total_written": 118,
  "sources": {
    "remotive": { "fetched": 40, "written": 40 },
    "arbeitnow": { "fetched": 40, "written": 40 },
    "jobicy": { "fetched": 38, "written": 38 },
    "adzuna": { "fetched": 0, "written": 0 }
  }
}
```

### Then automate it

Open `supabase/cron.sql`, replace `<INGEST_SECRET>` with your secret, and run it
in the SQL Editor. It schedules a run every 6 hours using `pg_cron` + `pg_net`.

Check on it:

```sql
select jobname, schedule, active from cron.job;

select source, count(*) filter (where status = 'published') as live, max(updated_at)
from public.job_postings group by source order by live desc;
```

---

## How ingested jobs differ

An ingested posting has no employer account behind it, so:

- `employer_id` is `null` and `source` is the provider id
- The card shows a **via Remotive** style label
- Swiping right saves it to the seeker's tracker and surfaces the original link —
  there's no in-app employer to receive an application
- The details modal's primary action is **Apply on site**, a real link to the
  company's own form
- Listings not seen for 45 days are auto-closed by `close_stale_external_jobs()`

Jobs posted by employers inside the app are unaffected and still work end to end.

---

## Google sign-in

The app code is already wired for it (PKCE, `signInWithOAuth`). You only need to
configure the provider:

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services
   → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Authorised redirect URI — copy this exactly:
   ```
   https://owgbiyehihsdvpkgsllg.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client secret**
5. In Supabase: **Authentication → Providers → Google** → enable, paste both, save
6. In Supabase: **Authentication → URL Configuration** → add your app origins to
   **Redirect URLs**:
   ```
   http://localhost:5173
   https://your-production-domain.com
   ```

Google accounts arrive with no role, so they land on the role-selection screen —
that's intended, not a bug.

## Costs

- Supabase Edge Functions: 500,000 invocations/month free
- OpenRouter: free tier models, rate-limited
- Remotive / Arbeitnow / Jobicy: free, no key
- Adzuna: free developer tier
- `pg_cron`: included
