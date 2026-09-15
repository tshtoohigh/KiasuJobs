import type {
  AppUser,
  EmployerProfile,
  EmployerProfileInput,
  SeekerPreferencesInput,
  SeekerProfile,
  UserRole,
} from '@kiasujobs/shared';

import { supabase } from '@/lib/supabase';

/**
 * Loads the app-level user row. A database trigger creates it when the auth
 * user appears, but that can race with an OAuth redirect, so callers treat
 * `null` as "not ready yet" rather than an error.
 */
export async function fetchAppUser(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Safety net for the OAuth path: Google sign-ups have no `role` metadata, and
 * if the trigger row is missing for any reason we create it here.
 */
export async function ensureAppUser(
  userId: string,
  email: string,
  fullName: string | null,
): Promise<AppUser> {
  const existing = await fetchAppUser(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('users')
    .insert({ id: userId, email, full_name: fullName, role: null, avatar_url: null })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function setUserRole(userId: string, role: UserRole): Promise<AppUser> {
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function completeOnboarding(userId: string): Promise<AppUser> {
  const { data, error } = await supabase
    .from('users')
    .update({ onboarding_completed: true })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateFullName(userId: string, fullName: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ full_name: fullName.trim() })
    .eq('id', userId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Seeker
// ---------------------------------------------------------------------------

export async function fetchSeekerProfile(userId: string): Promise<SeekerProfile | null> {
  const { data, error } = await supabase
    .from('seeker_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function upsertSeekerProfile(
  userId: string,
  input: SeekerPreferencesInput,
): Promise<SeekerProfile> {
  const { data, error } = await supabase
    .from('seeker_profiles')
    .upsert(
      {
        user_id: userId,
        headline: input.headline,
        bio: input.bio,
        years_experience: input.years_experience,
        min_salary: input.min_salary,
        preferred_job_types: input.preferred_job_types,
        preferred_locations: input.preferred_locations,
        industries: input.industries,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function setSeekerResume(
  userId: string,
  resumePath: string,
  resumeFilename: string,
): Promise<void> {
  const { error } = await supabase
    .from('seeker_profiles')
    .upsert(
      { user_id: userId, resume_path: resumePath, resume_filename: resumeFilename },
      { onConflict: 'user_id' },
    );

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Employer
// ---------------------------------------------------------------------------

export async function fetchEmployerProfile(userId: string): Promise<EmployerProfile | null> {
  const { data, error } = await supabase
    .from('employer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function upsertEmployerProfile(
  userId: string,
  input: EmployerProfileInput,
): Promise<EmployerProfile> {
  const { data, error } = await supabase
    .from('employer_profiles')
    .upsert(
      {
        user_id: userId,
        company_name: input.company_name.trim(),
        website: input.website,
        industry: input.industry,
        description: input.description,
        company_size: input.company_size,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function setCompanyLogo(userId: string, logoPath: string): Promise<void> {
  const { error } = await supabase
    .from('employer_profiles')
    .update({ company_logo_path: logoPath })
    .eq('user_id', userId);

  if (error) throw error;
}
