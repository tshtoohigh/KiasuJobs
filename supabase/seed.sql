-- ===========================================================================
-- KiasuJobs — local seed data
--
-- Runs automatically on `supabase db reset`. Creates three employers with live
-- postings plus one seeker, so the swipe deck has cards on first launch.
--
-- Every seeded account uses the password:  password123
--   seeker@kiasujobs.test      (job seeker, onboarded)
--   hiring@kopitech.test       (employer)
--   hiring@merliondigital.test (employer)
--   hiring@sembawangsys.test   (employer)
--
-- DO NOT run this against a production project.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Auth users. The on_auth_user_created trigger mirrors these into
-- public.users, picking up full_name and role from raw_user_meta_data.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'seeker@kiasujobs.test',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Aisha Tan","role":"seeker"}',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'hiring@kopitech.test',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Marcus Lim","role":"employer"}',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'hiring@merliondigital.test',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Priya Nair","role":"employer"}',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'hiring@sembawangsys.test',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Daniel Wong","role":"employer"}',
    false
  )
on conflict (id) do nothing;

-- GoTrue (Supabase Auth) reads several token columns as non-nullable strings.
-- A hand-inserted auth.users row leaves them NULL, and sign-in then fails with
-- "Database error querying schema" — which looks nothing like the real cause.
-- Normalising them to '' is what makes password login work on a seeded user.
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

-- Email/password sign-in needs a matching identity row.
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  u.id::text,
  now(),
  now(),
  now()
from auth.users u
where u.email in (
  'seeker@kiasujobs.test',
  'hiring@kopitech.test',
  'hiring@merliondigital.test',
  'hiring@sembawangsys.test'
)
on conflict do nothing;

-- Seeded accounts skip onboarding.
update public.users
set onboarding_completed = true
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

-- Preferences left deliberately wide so the seeded deck shows every posting.
-- Narrow these to watch get_job_feed's filtering kick in.
insert into public.seeker_profiles (
  user_id,
  headline,
  bio,
  years_experience,
  min_salary,
  preferred_job_types,
  preferred_locations,
  industries
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Frontend engineer · React & React Native',
  'Five years building consumer mobile apps. Looking for a product team that ships weekly.',
  5,
  6000,
  '{}',
  '{}',
  '{}'
)
on conflict (user_id) do nothing;

insert into public.employer_profiles (
  user_id,
  company_name,
  website,
  industry,
  description,
  company_size
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Kopi Tech',
    'https://kopitech.test',
    'Software',
    'Payments infrastructure for Southeast Asian F&B. Series A, 40 people, Tanjong Pagar.',
    '11-50'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Merlion Digital',
    'https://merliondigital.test',
    'Design',
    'Product studio partnering with banks and insurers across APAC.',
    '51-200'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Sembawang Systems',
    'https://sembawangsys.test',
    'Logistics',
    'Port automation and fleet telemetry. Hardware-adjacent software team.',
    '201-500'
  )
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Job postings — all published so they land in the feed immediately.
-- ---------------------------------------------------------------------------
insert into public.job_postings (
  employer_id,
  title,
  description,
  requirements,
  salary_min,
  salary_max,
  salary_currency,
  location,
  job_type,
  employment_type,
  industry,
  status,
  published_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Senior React Native Engineer',
    'You will own the KopiPay merchant app end to end — the app 12,000 hawker stalls use to take payments. We care about startup time, offline behaviour and gesture feel. You will work directly with the founders and ship to production most weeks.',
    array['4+ years React Native', 'TypeScript', 'Reanimated / gesture work', 'Comfortable owning releases'],
    8000, 11000, 'SGD', 'Tanjong Pagar, Singapore', 'hybrid', 'full_time', 'Software', 'published', now() - interval '2 hours'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Backend Engineer (Payments)',
    'Design and run the ledger behind every KopiPay transaction. Postgres, Go, and a strong preference for boring, correct systems over clever ones. You will be on call for the service you build, with a real rotation.',
    array['Go or Rust', 'Strong Postgres', 'Payments or ledger experience', 'On-call ownership'],
    9000, 13000, 'SGD', 'Tanjong Pagar, Singapore', 'hybrid', 'full_time', 'Software', 'published', now() - interval '1 day'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Product Designer',
    'Own the design of merchant-facing surfaces. You will spend real time in hawker centres watching people use what we build, then come back and fix it. Figma, prototypes, and a willingness to defend your decisions.',
    array['3+ years product design', 'Mobile-first portfolio', 'Comfortable with user research'],
    6500, 9000, 'SGD', 'Tanjong Pagar, Singapore', 'onsite', 'full_time', 'Design', 'published', now() - interval '3 days'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Engineering Intern (Mobile)',
    'A 6-month internship on the mobile team. You will ship real features to real users, with a mentor and weekly reviews. We hire strong interns back.',
    array['Currently studying CS or equivalent', 'Some React or React Native', 'Available 6 months'],
    1600, 2200, 'SGD', 'Tanjong Pagar, Singapore', 'onsite', 'internship', 'Software', 'published', now() - interval '5 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Senior Frontend Engineer',
    'Build banking interfaces that millions of people actually rely on. Heavy Next.js and TypeScript, with a real design system and accessibility budget. Fully remote within APAC time zones.',
    array['5+ years frontend', 'Next.js + TypeScript', 'Accessibility fluency', 'Design system experience'],
    8500, 12000, 'SGD', 'Remote (APAC)', 'remote', 'full_time', 'Software', 'published', now() - interval '6 hours'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'UX Researcher',
    'Run the research practice across our bank and insurer engagements. Mixed methods, from diary studies to usability testing. You will present to client stakeholders regularly.',
    array['4+ years UX research', 'Mixed methods', 'Client-facing confidence'],
    7000, 9500, 'SGD', 'Remote (APAC)', 'remote', 'full_time', 'Design', 'published', now() - interval '2 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Engineering Manager',
    'Lead two squads (9 engineers) building client platforms. This is a hands-off-keyboard role focused on people, delivery and technical direction. We expect you to have been an engineer.',
    array['2+ years managing engineers', 'Former IC background', 'Delivery track record'],
    13000, 17000, 'SGD', 'Singapore', 'hybrid', 'full_time', 'Software', 'published', now() - interval '4 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Freelance Motion Designer',
    'Project-based motion work for client launches — product explainers, app store assets, conference loops. Roughly 3 months, extendable, invoice monthly.',
    array['Strong motion reel', 'After Effects', 'Available 20h/week'],
    null, 8000, 'SGD', 'Remote (Worldwide)', 'remote', 'contract', 'Design', 'published', now() - interval '8 days'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Embedded Software Engineer',
    'Write the firmware that keeps automated cranes talking to our fleet platform. C++ on Linux, hard real-time constraints, and site visits to the port when something misbehaves at 3am.',
    array['C++', 'Embedded Linux', 'Real-time systems', 'Willing to visit site'],
    7500, 10500, 'SGD', 'Sembawang, Singapore', 'onsite', 'full_time', 'Logistics', 'published', now() - interval '12 hours'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Data Engineer',
    'Own the telemetry pipeline ingesting 4 billion events a month off port equipment. dbt, Airflow, Postgres and a lot of pragmatism about data quality.',
    array['3+ years data engineering', 'SQL fluency', 'Airflow or Dagster', 'dbt'],
    8000, 11000, 'SGD', 'Sembawang, Singapore', 'hybrid', 'full_time', 'Logistics', 'published', now() - interval '1 day 6 hours'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Site Reliability Engineer',
    'Keep a system running that the port genuinely cannot operate without. Kubernetes, Terraform, meaningful SLOs and a blameless postmortem culture we actually practise.',
    array['Kubernetes in production', 'Terraform', 'Incident response experience'],
    9500, 13500, 'SGD', 'Singapore', 'hybrid', 'full_time', 'Logistics', 'published', now() - interval '3 days 4 hours'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Technical Writer (Part-time)',
    'Document our fleet APIs and internal runbooks. Part-time, 3 days a week, with a lot of autonomy over how the docs are structured.',
    array['Technical writing portfolio', 'Can read code', 'Available 3 days/week'],
    4000, 5500, 'SGD', 'Remote (Singapore)', 'remote', 'part_time', 'Logistics', 'published', now() - interval '10 days'
  );

-- ---------------------------------------------------------------------------
-- One pre-existing application, so the employer applicant list and the
-- seeker's tracker both have something in them on first run.
-- ---------------------------------------------------------------------------
insert into public.applications (job_id, seeker_id, status, cover_note, created_at)
select
  j.id,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'viewed',
  'Long-time KopiPay user — I have opinions about the checkout flow.',
  now() - interval '1 day'
from public.job_postings j
where j.title = 'Senior React Native Engineer'
limit 1
on conflict do nothing;

insert into public.job_swipes (seeker_id, job_id, direction)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', a.job_id, 'right'
from public.applications a
where a.seeker_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
on conflict do nothing;
