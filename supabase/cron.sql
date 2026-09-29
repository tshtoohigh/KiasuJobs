-- ===========================================================================
-- KiasuJobs — automatic job ingestion schedule
--
-- Makes the database call the ingest-jobs Edge Function every 6 hours, so new
-- listings appear without anyone touching anything.
--
-- BEFORE RUNNING:
--   1. Deploy the function:  supabase functions deploy ingest-jobs --no-verify-jwt
--   2. Set the secret:       supabase secrets set INGEST_SECRET=<long-random-string>
--   3. Replace <INGEST_SECRET> below with that same string.
--
-- Then paste this whole file into the Supabase SQL Editor and run it.
-- Safe to re-run: the old schedule is removed first.
-- ===========================================================================

-- pg_cron runs the schedule; pg_net lets Postgres make the HTTP call.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Drop any previous version of this job so re-running doesn't stack them up.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'kiasujobs-ingest') then
    perform cron.unschedule('kiasujobs-ingest');
  end if;
end
$$;

select cron.schedule(
  'kiasujobs-ingest',
  -- Minute 7 past every 6th hour. Off-the-hour on purpose: every scheduled job
  -- in the world fires at :00, and these APIs are rate-limited.
  '7 */6 * * *',
  $ingest$
  select net.http_post(
    url := 'https://owgbiyehihsdvpkgsllg.supabase.co/functions/v1/ingest-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-secret', '<INGEST_SECRET>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $ingest$
);

-- ---------------------------------------------------------------------------
-- Checking on it
-- ---------------------------------------------------------------------------

-- Is it scheduled?
--   select jobid, jobname, schedule, active from cron.job;
--
-- Did the last few runs succeed?
--   select runid, status, return_message, start_time
--   from cron.job_run_details
--   where jobname = 'kiasujobs-ingest'
--   order by start_time desc
--   limit 10;
--
-- What did the HTTP call actually return? (pg_net logs responses separately)
--   select id, status_code, content
--   from net._http_response
--   order by created desc
--   limit 5;
--
-- How many ingested jobs are live, by source?
--   select source, count(*) filter (where status = 'published') as live, max(updated_at) as last_seen
--   from public.job_postings
--   group by source
--   order by live desc;
--
-- Run it once right now without waiting for the schedule:
--   select net.http_post(
--     url := 'https://owgbiyehihsdvpkgsllg.supabase.co/functions/v1/ingest-jobs',
--     headers := jsonb_build_object('Content-Type','application/json','x-ingest-secret','<INGEST_SECRET>'),
--     body := '{}'::jsonb
--   );
--
-- Stop it:
--   select cron.unschedule('kiasujobs-ingest');
