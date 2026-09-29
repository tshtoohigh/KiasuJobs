-- ===========================================================================
-- KiasuJobs — complete database schema
--
-- Run this ONCE against a fresh Supabase project:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run
--
-- Then run `seed.sql` to get demo employers, jobs and a test seeker account.
--
-- Contents:
--   1. Enums and tables
--   2. Triggers (updated_at, auth mirroring, status timestamps)
--   3. Row Level Security  ← the important part
--   4. Storage buckets and object policies
--   5. RPCs: get_job_feed, apply_to_job
--   6. Read views for the two list screens
-- ===========================================================================


-- ===========================================================================
-- KiasuJobs — core schema
-- Enums, tables, constraints, triggers and indexes.
-- RLS lives in 20260915000002_rls.sql, storage in ..._storage.sql,
-- feed/apply functions in ..._functions.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enums (mirrored in packages/shared/src/enums.ts)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('seeker', 'employer');
create type public.job_type as enum ('remote', 'hybrid', 'onsite');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'internship');
create type public.job_status as enum ('draft', 'published', 'closed');
create type public.application_status as enum (
  'applied',
  'viewed',
  'shortlisted',
  'rejected',
  'hired'
);
create type public.swipe_direction as enum ('left', 'right');

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — one row per auth.users row, carries the role
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  -- Nullable on purpose: Google OAuth sign-ups arrive without a role, so the
  -- app sends them to the role-selection screen and patches this afterwards.
  role public.user_role,
  full_name text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Mirror new auth users into public.users. `role` is read from the sign-up
-- metadata when present (email sign-up passes it; OAuth does not).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- seeker_profiles — resume + the preferences that filter the swipe deck
-- ---------------------------------------------------------------------------
create table public.seeker_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  headline text check (headline is null or char_length(headline) <= 160),
  bio text check (bio is null or char_length(bio) <= 2000),
  -- Object path inside the private `resumes` bucket, e.g. `<uid>/resume.pdf`.
  resume_path text,
  resume_filename text,
  years_experience int check (
    years_experience is null or (years_experience >= 0 and years_experience <= 70)
  ),
  min_salary int check (min_salary is null or min_salary >= 0),
  preferred_job_types public.job_type[] not null default '{}',
  preferred_locations text[] not null default '{}',
  industries text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger seeker_profiles_set_updated_at
before update on public.seeker_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- employer_profiles — company identity shown on every job card
-- ---------------------------------------------------------------------------
create table public.employer_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  company_name text not null check (char_length(trim(company_name)) between 1 and 120),
  -- Object path inside the public `company-logos` bucket.
  company_logo_path text,
  website text,
  industry text,
  description text check (description is null or char_length(description) <= 4000),
  company_size text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employer_profiles_set_updated_at
before update on public.employer_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_postings
-- ---------------------------------------------------------------------------
create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 140),
  description text not null check (char_length(description) between 1 and 20000),
  requirements text[] not null default '{}',
  salary_min int check (salary_min is null or salary_min >= 0),
  salary_max int check (salary_max is null or salary_max >= 0),
  salary_currency text not null default 'SGD' check (char_length(salary_currency) = 3),
  location text not null default '',
  job_type public.job_type not null,
  employment_type public.employment_type not null default 'full_time',
  industry text,
  status public.job_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_postings_salary_range_check check (
    salary_min is null or salary_max is null or salary_max >= salary_min
  )
);

create trigger job_postings_set_updated_at
before update on public.job_postings
for each row execute function public.set_updated_at();

-- Stamp published_at the first time a posting goes live.
create or replace function public.sync_job_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger job_postings_sync_published_at
before insert or update on public.job_postings
for each row execute function public.sync_job_published_at();

-- ---------------------------------------------------------------------------
-- applications — created by a right-swipe, advanced by the employer
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings (id) on delete cascade,
  seeker_id uuid not null references public.users (id) on delete cascade,
  status public.application_status not null default 'applied',
  cover_note text check (cover_note is null or char_length(cover_note) <= 2000),
  -- Resume path frozen at apply time so later resume swaps don't rewrite
  -- what an employer already received.
  resume_path_snapshot text,
  viewed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One application per seeker per job; also makes the right-swipe idempotent.
  constraint applications_unique_seeker_job unique (job_id, seeker_id)
);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

-- Keep the status timestamps honest without trusting the client.
create or replace function public.sync_application_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'viewed' and new.viewed_at is null then
      new.viewed_at = now();
    end if;
    if new.status in ('shortlisted', 'rejected', 'hired') then
      new.decided_at = now();
      if new.viewed_at is null then
        new.viewed_at = now();
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger applications_sync_status_timestamps
before update on public.applications
for each row execute function public.sync_application_status_timestamps();

-- An employer may only move an application along its pipeline — never
-- re-point it at a different job or seeker.
create or replace function public.guard_application_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if new.job_id is distinct from old.job_id or new.seeker_id is distinct from old.seeker_id then
    raise exception 'job_id and seeker_id are immutable on applications';
  end if;
  return new;
end;
$$;

create trigger applications_guard_immutable_columns
before update on public.applications
for each row execute function public.guard_application_immutable_columns();

-- ---------------------------------------------------------------------------
-- job_swipes — every decision, so a skipped card never comes back
-- ---------------------------------------------------------------------------
create table public.job_swipes (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.users (id) on delete cascade,
  job_id uuid not null references public.job_postings (id) on delete cascade,
  direction public.swipe_direction not null,
  created_at timestamptz not null default now(),
  constraint job_swipes_unique_seeker_job unique (seeker_id, job_id)
);

-- ---------------------------------------------------------------------------
-- Indexes tuned for the three hot paths:
--   1. building a seeker's feed, 2. an employer's applicant list,
--   3. a seeker's application tracker.
-- ---------------------------------------------------------------------------
create index job_postings_feed_idx
  on public.job_postings (status, published_at desc nulls last);
create index job_postings_employer_idx
  on public.job_postings (employer_id, created_at desc);
create index applications_seeker_idx
  on public.applications (seeker_id, created_at desc);
create index applications_job_idx
  on public.applications (job_id, created_at desc);
create index job_swipes_seeker_idx
  on public.job_swipes (seeker_id, job_id);

-- ---------------------------------------------------------------------------
-- Realtime — employers subscribe to applications to get live applicant counts.
-- Guarded so this migration also applies to a plain Postgres instance that has
-- no Supabase realtime publication.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.applications;
  end if;
end
$$;


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


-- ===========================================================================
-- KiasuJobs — Storage buckets and object policies
--
-- Object paths are always `<user_id>/<filename>`, which is what lets these
-- policies authorise by folder.
--   resumes/<seeker_id>/resume.pdf        (private)
--   company-logos/<employer_id>/logo.png  (public read)
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880, -- 5 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- A storage path segment is user input, so a hard `::uuid` cast would throw on
-- a malformed key. Fold failures into NULL instead.
create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception
  when others then
    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- resumes — the seeker owns their folder
-- ---------------------------------------------------------------------------
create policy "resumes_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "resumes_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "resumes_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "resumes_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- DECISION: an employer can read a resume only for a seeker who has applied to
-- one of their postings. This is what makes `createSignedUrl` work from the
-- applicant list without ever exposing the wider bucket.
create policy "resumes_select_applicants_for_owning_employer"
on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and public.is_employer_of_applicant(public.safe_uuid((storage.foldername(name))[1]))
);

-- ---------------------------------------------------------------------------
-- company-logos — world-readable (public bucket), employer writes own folder
-- ---------------------------------------------------------------------------
create policy "company_logos_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "company_logos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "company_logos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);


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


-- ===========================================================================
-- KiasuJobs — read views for the two list screens
--
-- Why views instead of PostgREST embedding: `job_postings.employer_id` is a FK
-- to `users`, not to `employer_profiles`, so the company name is two hops away
-- and the nested-embed syntax gets fragile. A flat view is easier to consume
-- and easier to reason about.
--
-- `security_invoker = true` is the important part — these run with the
-- caller's privileges, so every RLS policy on the underlying tables still
-- applies. A seeker sees only their own applications; an employer sees only
-- applicants to postings they own.
-- ===========================================================================

-- Seeker's "My Applications" tracker.
create view public.seeker_application_details
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
  e.company_name,
  e.company_logo_path
from public.applications a
join public.job_postings j on j.id = a.job_id
left join public.employer_profiles e on e.user_id = j.employer_id;

-- Employer's applicant list for a posting.
create view public.job_applicant_details
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
  u.full_name as seeker_name,
  u.avatar_url as seeker_avatar_url,
  sp.headline as seeker_headline,
  sp.bio as seeker_bio,
  sp.years_experience as seeker_years_experience,
  sp.resume_path as seeker_resume_path,
  sp.resume_filename as seeker_resume_filename
from public.applications a
join public.users u on u.id = a.seeker_id
left join public.seeker_profiles sp on sp.user_id = a.seeker_id;

grant select on public.seeker_application_details to authenticated;
grant select on public.job_applicant_details to authenticated;


