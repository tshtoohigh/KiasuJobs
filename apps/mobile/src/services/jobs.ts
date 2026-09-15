import type {
  Application,
  CreateJobPostingInput,
  JobFeedItem,
  JobPosting,
  JobPostingWithStats,
  JobStatus,
} from '@kiasujobs/shared';

import { supabase } from '@/lib/supabase';

/**
 * Fetches the next page of swipeable cards.
 *
 * `exclude` carries the ids already buffered on the client so a top-up never
 * returns a card the deck is already holding.
 */
export async function fetchJobFeed(exclude: string[], limit: number): Promise<JobFeedItem[]> {
  const { data, error } = await supabase.rpc('get_job_feed', {
    p_limit: limit,
    p_exclude: exclude,
  });

  if (error) throw error;
  return data ?? [];
}

/**
 * Right-swipe. One RPC writes the application and the swipe together, so a
 * half-applied state isn't reachable.
 */
export async function applyToJob(jobId: string, coverNote?: string | null): Promise<Application> {
  const { data, error } = await supabase.rpc('apply_to_job', {
    p_job_id: jobId,
    p_cover_note: coverNote ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('Application did not come back from the server.');
  return data;
}

/** Left-swipe. Recorded so the card never resurfaces in the feed. */
export async function skipJob(seekerId: string, jobId: string): Promise<void> {
  const { error } = await supabase
    .from('job_swipes')
    .upsert(
      { seeker_id: seekerId, job_id: jobId, direction: 'left' },
      { onConflict: 'seeker_id,job_id' },
    );

  if (error) throw error;
}

export async function createJobPosting(
  employerId: string,
  input: CreateJobPostingInput,
): Promise<JobPosting> {
  const { data, error } = await supabase
    .from('job_postings')
    .insert({
      employer_id: employerId,
      title: input.title.trim(),
      description: input.description.trim(),
      requirements: input.requirements,
      salary_min: input.salary_min,
      salary_max: input.salary_max,
      salary_currency: input.salary_currency ?? 'SGD',
      location: input.location.trim(),
      job_type: input.job_type,
      employment_type: input.employment_type,
      industry: input.industry,
      status: input.status ?? 'published',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Employer dashboard list. Applicant counts come back as an aggregate so the
 * screen doesn't need a query per posting.
 */
export async function fetchMyPostings(employerId: string): Promise<JobPostingWithStats[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*, applications(id, status)')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  type Row = JobPosting & { applications: { id: string; status: string }[] | null };

  return ((data ?? []) as Row[]).map((row) => {
    const { applications, ...posting } = row;
    const list = applications ?? [];
    return {
      ...posting,
      applicant_count: list.length,
      new_applicant_count: list.filter((a) => a.status === 'applied').length,
    };
  });
}

export async function fetchJobPosting(jobId: string): Promise<JobPosting | null> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
  const { error } = await supabase.from('job_postings').update({ status }).eq('id', jobId);
  if (error) throw error;
}
