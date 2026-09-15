-- ===========================================================================
-- KiasuJobs — feed and apply RPCs
--
-- Both run as `security invoker`, so every RLS policy from
-- 20260915000002_rls.sql still applies. These exist to collapse what would
-- otherwise be several round trips into one — which is what keeps the swipe
-- deck from ever showing a spinner.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- get_job_feed — the pre-fetch query behind the swipe deck.
--
-- Filters out: the seeker's own postings, anything already swiped or applied
-- to, anything in `p_exclude` (cards already sitting in the client queue), and
-- anything outside the seeker's saved preferences. An empty preference array
-- means "no preference", not "match nothing".
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
  company_industry text
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
  )
  select
    j.id,
    j.employer_id,
    j.title,
    j.description,
    j.requirements,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.location,
    j.job_type,
    j.employment_type,
    j.industry,
    j.published_at,
    e.company_name,
    e.company_logo_path,
    e.industry as company_industry
  from public.job_postings j
  join public.employer_profiles e on e.user_id = j.employer_id
  left join prefs p on true
  where j.status = 'published'
    and j.employer_id <> (select auth.uid())
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
    -- Remote roles always qualify on location.
    and (
      p.preferred_locations is null
      or array_length(p.preferred_locations, 1) is null
      or j.job_type = 'remote'
      or j.location = any(p.preferred_locations)
    )
  order by j.published_at desc nulls last, j.id
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

comment on function public.get_job_feed(int, uuid[]) is
  'Returns the next page of swipeable job cards for the current seeker, '
  'excluding already-decided jobs and applying saved preferences.';

-- ---------------------------------------------------------------------------
-- apply_to_job — the right-swipe. Records the application and the swipe in one
-- statement so a dropped connection can never leave a card that re-appears
-- with no application behind it.
--
-- Idempotent: swiping the same job twice (double tap, retry after a flaky
-- network) returns the original application instead of erroring.
-- ---------------------------------------------------------------------------
create or replace function public.apply_to_job(
  p_job_id uuid,
  p_cover_note text default null
)
returns public.applications
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_seeker uuid := (select auth.uid());
  v_resume_path text;
  v_application public.applications;
begin
  if v_seeker is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select sp.resume_path
  into v_resume_path
  from public.seeker_profiles sp
  where sp.user_id = v_seeker;

  insert into public.applications (job_id, seeker_id, cover_note, resume_path_snapshot)
  values (
    p_job_id,
    v_seeker,
    nullif(trim(coalesce(p_cover_note, '')), ''),
    v_resume_path
  )
  on conflict (job_id, seeker_id) do update
    set updated_at = now()
  returning * into v_application;

  insert into public.job_swipes (seeker_id, job_id, direction)
  values (v_seeker, p_job_id, 'right')
  on conflict (seeker_id, job_id) do update
    set direction = 'right';

  return v_application;
end;
$$;

comment on function public.apply_to_job(uuid, text) is
  'Applies the current seeker to a published job and records the right-swipe. '
  'Idempotent per (job, seeker).';

grant execute on function public.get_job_feed(int, uuid[]) to authenticated;
grant execute on function public.apply_to_job(uuid, text) to authenticated;
