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
