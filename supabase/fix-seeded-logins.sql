-- ===========================================================================
-- Repair seeded demo logins
--
-- Run this in the Supabase SQL Editor if the demo accounts can't sign in.
--
-- Why it's needed: Supabase Auth (GoTrue) reads several columns on auth.users
-- as non-nullable strings. A row inserted by hand leaves them NULL, and the
-- login request then fails with "Database error querying schema" — an error
-- that gives no hint about the real cause.
--
-- Safe to run more than once. Only touches the four demo accounts.
-- ===========================================================================

update auth.users
set confirmation_token = '',
    recovery_token = '',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email in (
  'seeker@kiasujobs.test',
  'hiring@kopitech.test',
  'hiring@merliondigital.test',
  'hiring@sembawangsys.test'
);

-- Make sure every demo user has an email identity (required for password login).
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  u.id::text,
  now(), now(), now()
from auth.users u
where u.email in (
    'seeker@kiasujobs.test',
    'hiring@kopitech.test',
    'hiring@merliondigital.test',
    'hiring@sembawangsys.test'
  )
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- Reset the passwords to `password123` so there's no doubt about them.
update auth.users
set encrypted_password = crypt('password123', gen_salt('bf'))
where email in (
  'seeker@kiasujobs.test',
  'hiring@kopitech.test',
  'hiring@merliondigital.test',
  'hiring@sembawangsys.test'
);

-- ---------------------------------------------------------------------------
-- Diagnostic — this SELECT is what tells you whether the repair worked.
-- Every row should read: confirmed = true, has_password = true, identities = 1
-- ---------------------------------------------------------------------------
select
  u.email,
  u.email_confirmed_at is not null as confirmed,
  u.encrypted_password is not null as has_password,
  (select count(*) from auth.identities i where i.user_id = u.id) as identities,
  pu.role as app_role,
  pu.onboarding_completed
from auth.users u
left join public.users pu on pu.id = u.id
order by u.email;
