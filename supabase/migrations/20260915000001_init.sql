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
