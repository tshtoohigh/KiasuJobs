-- ===========================================================================
-- KiasuJobs — Row Level Security
--
-- Ground rules enforced here:
--   * A seeker only ever sees `published` postings.
--   * Only the employer who owns a posting can see its applicants.
--   * Only the employer can move an application along the pipeline; only the
--     seeker can create one.
--   * A seeker's resume + profile is visible to an employer ONLY after that
--     seeker applies to one of that employer's jobs.
--
-- Subqueries in policies are wrapped in `security definer` helpers. That is
-- deliberate: it stops RLS from recursing into the tables being checked and
-- lets Postgres cache the result per statement instead of per row.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Does the current user own this posting?
create or replace function public.owns_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_postings j
    where j.id = p_job_id
      and j.employer_id = (select auth.uid())
  );
$$;

-- Is this posting live? Used to stop applications to drafts/closed jobs.
create or replace function public.job_is_published(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_postings j
    where j.id = p_job_id
      and j.status = 'published'
  );
$$;

-- Has the given seeker applied to any of the current user's postings?
-- This is the gate for an employer reading a seeker's profile and resume.
create or replace function public.is_employer_of_applicant(p_seeker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    join public.job_postings j on j.id = a.job_id
    where a.seeker_id = p_seeker_id
      and j.employer_id = (select auth.uid())
  );
$$;

-- Has the current user completed employer onboarding? Stops a seeker account
-- from publishing postings by hand-crafting a request.
create or replace function public.is_employer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employer_profiles e
    where e.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. No policy exists for `anon`, so unauthenticated
-- requests read nothing regardless of table grants.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.seeker_profiles enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.job_postings enable row level security;
alter table public.applications enable row level security;
alter table public.job_swipes enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy "users_select_self_or_applicant"
on public.users for select to authenticated
using (
  id = (select auth.uid())
  -- An employer can resolve the name/avatar of someone who applied to them.
  or public.is_employer_of_applicant(id)
);

-- The row itself is created by the on_auth_user_created trigger; this covers
-- the client-side upsert fallback used right after OAuth sign-in.
create policy "users_insert_self"
on public.users for insert to authenticated
with check (id = (select auth.uid()));

create policy "users_update_self"
on public.users for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- seeker_profiles
-- ---------------------------------------------------------------------------
create policy "seeker_profiles_select_self_or_applied_employer"
on public.seeker_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_employer_of_applicant(user_id)
);

create policy "seeker_profiles_insert_self"
on public.seeker_profiles for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "seeker_profiles_update_self"
on public.seeker_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- employer_profiles
--
-- DECISION: company profiles are readable by every signed-in user. A job card
-- has to show the company name and logo, and denormalising those onto every
-- posting would let them drift. Nothing private lives on this table.
-- ---------------------------------------------------------------------------
create policy "employer_profiles_select_all_authenticated"
on public.employer_profiles for select to authenticated
using (true);

create policy "employer_profiles_insert_self"
on public.employer_profiles for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "employer_profiles_update_self"
on public.employer_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- job_postings
-- ---------------------------------------------------------------------------
create policy "job_postings_select_published_or_own"
on public.job_postings for select to authenticated
using (
  status = 'published'
  or employer_id = (select auth.uid())
);

create policy "job_postings_insert_own"
on public.job_postings for insert to authenticated
with check (
  employer_id = (select auth.uid())
  and public.is_employer()
);

create policy "job_postings_update_own"
on public.job_postings for update to authenticated
using (employer_id = (select auth.uid()))
with check (employer_id = (select auth.uid()));

create policy "job_postings_delete_own"
on public.job_postings for delete to authenticated
using (employer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
create policy "applications_select_own_or_employer"
on public.applications for select to authenticated
using (
  seeker_id = (select auth.uid())
  or public.owns_job(job_id)
);

-- Only the seeker creates an application, only against a live posting, and
-- never against their own posting.
create policy "applications_insert_own"
on public.applications for insert to authenticated
with check (
  seeker_id = (select auth.uid())
  and public.job_is_published(job_id)
  and not public.owns_job(job_id)
);

-- DECISION: only the employer can update an application (status pipeline).
-- Seekers get no UPDATE policy, so "withdraw" is intentionally unsupported
-- for now — see the open questions in the README.
create policy "applications_update_by_owning_employer"
on public.applications for update to authenticated
using (public.owns_job(job_id))
with check (public.owns_job(job_id));

-- ---------------------------------------------------------------------------
-- job_swipes — private to the seeker who made them
-- ---------------------------------------------------------------------------
create policy "job_swipes_select_own"
on public.job_swipes for select to authenticated
using (seeker_id = (select auth.uid()));

create policy "job_swipes_insert_own"
on public.job_swipes for insert to authenticated
with check (seeker_id = (select auth.uid()));

create policy "job_swipes_delete_own"
on public.job_swipes for delete to authenticated
using (seeker_id = (select auth.uid()));
