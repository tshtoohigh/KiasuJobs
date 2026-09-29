-- ===========================================================================
-- KiasuJobs — upgrade v2
--
-- Adds:
--   1. External job support — postings ingested from real job APIs, which have
--      no employer account behind them.
--   2. AI resume fields on seeker_profiles.
--   3. Keyword match scoring in get_job_feed, so the deck is curated by what
--      the resume actually says instead of just recency.
--
-- Run this in the Supabase SQL Editor AFTER schema.sql.
-- Safe to run more than once — every statement is idempotent.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. job_postings — support postings with no employer account
-- ---------------------------------------------------------------------------

-- An ingested job belongs to no user, so employer_id has to be nullable.
alter table public.job_postings alter column employer_id drop not null;

alter table public.job_postings
  add column if not exists source text not null default 'employer',
  -- The provider's own id, used to make re-ingestion idempotent.
  add column if not exists external_id text,
  -- Where to actually apply for an ingested job.
  add column if not exists external_url text,
  -- External jobs have no employer_profiles row, so the company details live
  -- directly on the posting.
  add column if not exists company_name text,
  add column if not exists company_logo_url text;

comment on column public.job_postings.source is
  '''employer'' for in-app postings, otherwise the provider id (remotive, arbeitnow, jobicy, adzuna).';

-- One row per provider job. Lets the ingest function upsert instead of
-- duplicating on every run.
create unique index if not exists job_postings_source_external_idx
  on public.job_postings (source, external_id)
  where external_id is not null;

create index if not exists job_postings_source_idx on public.job_postings (source);

-- Either an employer owns it, or it came from a source with a link to apply.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_postings_owner_or_source_check'
  ) then
    alter table public.job_postings
      add constraint job_postings_owner_or_source_check check (
        employer_id is not null
        or (source <> 'employer' and external_url is not null)
      );
  end if;
end
$$;

-- Ingested titles and descriptions are longer and messier than hand-typed ones.
alter table public.job_postings drop constraint if exists job_postings_title_check;
alter table public.job_postings
  add constraint job_postings_title_check check (char_length(trim(title)) between 2 and 220);

alter table public.job_postings drop constraint if exists job_postings_description_check;
alter table public.job_postings
  add constraint job_postings_description_check check (char_length(description) between 1 and 60000);

-- ---------------------------------------------------------------------------
-- 2. seeker_profiles — what the AI pulled out of the resume
-- ---------------------------------------------------------------------------
alter table public.seeker_profiles
  add column if not exists resume_text text,
  add column if not exists ai_keywords text[] not null default '{}',
  add column if not exists ai_skills text[] not null default '{}',
  add column if not exists ai_titles text[] not null default '{}',
  add column if not exists ai_seniority text,
  add column if not exists ai_summary text,
  add column if not exists ai_parsed_at timestamptz;

comment on column public.seeker_profiles.ai_keywords is
  'Lowercased keywords extracted from the resume. Drives match scoring in get_job_feed.';

-- ---------------------------------------------------------------------------
-- 3. get_job_feed — now returns external jobs and a match score
--
-- Two important changes from v1:
--   * LEFT JOIN employer_profiles. It used to be an inner join, which would
--     silently drop every ingested job (they have no employer profile).
--   * Ranking is match_score first, recency second.
-- ---------------------------------------------------------------------------
create or replace function public.get_job_feed(
  p_limit int default 10,
  p_exclude uuid[] default array[]::uuid[]
)
returns table (
  id uuid,
  employer_id uuid,
  title text,
  description text,
  requirements text[],
  salary_min int,
  salary_max int,
  salary_currency text,
  location text,
  job_type public.job_type,
  employment_type public.employment_type,
  industry text,
  published_at timestamptz,
  company_name text,
  company_logo_path text,
  company_logo_url text,
  company_industry text,
  source text,
  external_url text,
  is_external boolean,
  match_score int,
  matched_keywords text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  with prefs as (
    select *
    from public.seeker_profiles sp
    where sp.user_id = (select auth.uid())
  ),
  candidates as (
    select
      j.*,
      e.company_name as employer_company_name,
      e.company_logo_path as employer_logo_path,
      e.industry as employer_industry,
      p.ai_keywords,
      -- Everything worth searching, folded into one lowercased haystack.
      lower(
        coalesce(j.title, '') || ' ' ||
        coalesce(j.description, '') || ' ' ||
        coalesce(array_to_string(j.requirements, ' '), '') || ' ' ||
        coalesce(j.industry, '')
      ) as haystack
    from public.job_postings j
    left join public.employer_profiles e on e.user_id = j.employer_id
    left join prefs p on true
    where j.status = 'published'
      and (j.employer_id is null or j.employer_id <> (select auth.uid()))
      and not (j.id = any(coalesce(p_exclude, array[]::uuid[])))
      and not exists (
        select 1 from public.job_swipes s
        where s.job_id = j.id and s.seeker_id = (select auth.uid())
      )
      and not exists (
        select 1 from public.applications a
        where a.job_id = j.id and a.seeker_id = (select auth.uid())
      )
      -- Preference filters. Each is skipped when the seeker left it blank.
      and (
        p.preferred_job_types is null
        or array_length(p.preferred_job_types, 1) is null
        or j.job_type = any(p.preferred_job_types)
      )
      and (
        p.industries is null
        or array_length(p.industries, 1) is null
        or j.industry = any(p.industries)
      )
      and (
        p.min_salary is null
        or j.salary_max is null
        or j.salary_max >= p.min_salary
      )
      and (
        p.preferred_locations is null
        or array_length(p.preferred_locations, 1) is null
        or j.job_type = 'remote'
        or j.location = any(p.preferred_locations)
      )
  ),
  matched as (
    select
      c.*,
      coalesce(
        (
          select array_agg(distinct k order by k)
          from unnest(c.ai_keywords) as k
          where length(k) > 1 and c.haystack like '%' || lower(k) || '%'
        ),
        array[]::text[]
      ) as hits
    from candidates c
  )
  select
    m.id,
    m.employer_id,
    m.title,
    m.description,
    m.requirements,
    m.salary_min,
    m.salary_max,
    m.salary_currency,
    m.location,
    m.job_type,
    m.employment_type,
    m.industry,
    m.published_at,
    -- An in-app posting gets its name from the employer profile; an ingested
    -- one carries its own.
    coalesce(m.employer_company_name, m.company_name, 'Unknown company') as company_name,
    m.employer_logo_path as company_logo_path,
    m.company_logo_url,
    coalesce(m.employer_industry, m.industry) as company_industry,
    m.source,
    m.external_url,
    (m.employer_id is null) as is_external,
    -- NULL when there's nothing to match against, so the UI can hide the badge
    -- rather than show a meaningless 0%.
    case
      when m.ai_keywords is null or array_length(m.ai_keywords, 1) is null then null
      else least(99, 35 + coalesce(array_length(m.hits, 1), 0) * 11)
    end as match_score,
    m.hits as matched_keywords
  from matched m
  order by
    coalesce(array_length(m.hits, 1), 0) desc,
    m.published_at desc nulls last,
    m.id
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

comment on function public.get_job_feed(int, uuid[]) is
  'Next page of swipeable cards for the current seeker: excludes already-decided '
  'jobs, applies saved preferences, and ranks by resume keyword overlap.';

-- ---------------------------------------------------------------------------
-- 4. seeker_application_details — company name for ingested jobs too
-- ---------------------------------------------------------------------------
create or replace view public.seeker_application_details
with (security_invoker = true) as
select
  a.id,
  a.job_id,
  a.seeker_id,
  a.status,
  a.cover_note,
  a.resume_path_snapshot,
  a.viewed_at,
  a.decided_at,
  a.created_at,
  a.updated_at,
  j.title as job_title,
  j.location as job_location,
  j.job_type,
  j.employment_type,
  j.salary_min,
  j.salary_max,
  j.salary_currency,
  j.status as job_status,
  j.source,
  j.external_url,
  (j.employer_id is null) as is_external,
  coalesce(e.company_name, j.company_name) as company_name,
  e.company_logo_path,
  j.company_logo_url
from public.applications a
join public.job_postings j on j.id = a.job_id
left join public.employer_profiles e on e.user_id = j.employer_id;

grant select on public.seeker_application_details to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Let the ingest Edge Function write postings
--
-- The function authenticates with the service_role key, which bypasses RLS.
-- No policy is added for `authenticated`, so a normal user still cannot create
-- a posting that claims to be from an external source.
-- ---------------------------------------------------------------------------

-- Housekeeping: ingested jobs go stale. This closes anything not seen in 45
-- days so the deck doesn't fill up with dead links.
create or replace function public.close_stale_external_jobs()
returns integer
language sql
security definer
set search_path = public
as $$
  with closed as (
    update public.job_postings
    set status = 'closed'
    where source <> 'employer'
      and status = 'published'
      and updated_at < now() - interval '45 days'
    returning 1
  )
  select count(*)::int from closed;
$$;

revoke all on function public.close_stale_external_jobs() from public, anon, authenticated;
