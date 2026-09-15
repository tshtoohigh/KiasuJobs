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
