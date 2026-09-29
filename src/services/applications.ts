import { supabase } from "@/lib/supabase";
import type {
  ApplicationStatus,
  JobApplicantDetail,
  SeekerApplicationDetail,
} from "@/lib/types";

/**
 * "My Applications" for a seeker.
 *
 * Reads the `seeker_application_details` view, which is `security_invoker` —
 * so RLS still scopes the rows. The `.eq()` is belt-and-braces, not the
 * security boundary.
 */
export async function fetchMyApplications(
  seekerId: string,
): Promise<SeekerApplicationDetail[]> {
  const { data, error } = await supabase
    .from("seeker_application_details")
    .select("*")
    .eq("seeker_id", seekerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Applicant list for one posting. An employer who doesn't own the posting gets
 * zero rows — enforced by RLS on `applications`, not by this query.
 */
export async function fetchApplicantsForJob(
  jobId: string,
): Promise<JobApplicantDetail[]> {
  const { data, error } = await supabase
    .from("job_applicant_details")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Employer moves an application along the pipeline. `viewed_at` / `decided_at`
 * are stamped by a database trigger so the client can't fake them.
 */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId);
  if (error) throw error;
}

/** Marks brand-new applications as seen when the employer opens the list. */
export async function markApplicationsViewed(
  applicationIds: string[],
): Promise<void> {
  if (applicationIds.length === 0) return;

  const { error } = await supabase
    .from("applications")
    .update({ status: "viewed" })
    .in("id", applicationIds)
    .eq("status", "applied");

  if (error) throw error;
}
