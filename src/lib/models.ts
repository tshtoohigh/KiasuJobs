import type {
  ApplicationStatus,
  EmploymentType,
  JobStatus,
  JobType,
  SwipeDirection,
  UserRole,
} from "./enums";

/**
 * Domain model. Field names deliberately match the Postgres column names so
 * rows coming back from `supabase-js` can be used without remapping.
 */

export interface AppUser {
  id: string;
  email: string;
  /**
   * `null` until the user picks a role. Google OAuth sign-ups arrive without
   * one, so the app routes them to the role-selection screen.
   */
  role: UserRole | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeekerProfile {
  user_id: string;
  headline: string | null;
  bio: string | null;
  /** Storage object path inside the private `resumes` bucket. */
  resume_path: string | null;
  resume_filename: string | null;
  years_experience: number | null;
  /** Feed filters, set during onboarding and editable later. */
  min_salary: number | null;
  preferred_job_types: JobType[];
  preferred_locations: string[];
  industries: string[];

  // --- Extracted from the resume by the parse-resume function -------------
  /** Plain text pulled out of the uploaded file, kept so we can re-parse. */
  resume_text: string | null;
  /** Lowercased terms that drive match scoring in `get_job_feed`. */
  ai_keywords: string[];
  ai_skills: string[];
  ai_titles: string[];
  ai_seniority: string | null;
  ai_summary: string | null;
  ai_parsed_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface EmployerProfile {
  user_id: string;
  company_name: string;
  /** Storage object path inside the public `company-logos` bucket. */
  company_logo_path: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  company_size: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobPosting {
  id: string;
  /** Null for ingested jobs — nobody in the app owns them. */
  employer_id: string | null;
  title: string;
  description: string;
  requirements: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  location: string;
  job_type: JobType;
  employment_type: EmploymentType;
  industry: string | null;
  status: JobStatus;
  published_at: string | null;

  /** `employer` for in-app postings, else the provider id (remotive, adzuna…). */
  source: string;
  external_id: string | null;
  /** Where to apply for an ingested job. */
  external_url: string | null;
  /** Ingested jobs carry their company details directly. */
  company_name: string | null;
  company_logo_url: string | null;

  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  seeker_id: string;
  status: ApplicationStatus;
  cover_note: string | null;
  /**
   * Copy of the seeker's resume path at apply time, so later resume changes
   * don't retroactively alter what an employer received.
   */
  resume_path_snapshot: string | null;
  viewed_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobSwipe {
  id: string;
  seeker_id: string;
  job_id: string;
  direction: SwipeDirection;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Composite shapes returned by RPCs / joined queries
// ---------------------------------------------------------------------------

/**
 * One card in the swipe deck: a published posting flattened together with its
 * company details. Returned by the `get_job_feed` RPC.
 */
export interface JobFeedItem {
  id: string;
  employer_id: string | null;
  title: string;
  description: string;
  requirements: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  location: string;
  job_type: JobType;
  employment_type: EmploymentType;
  industry: string | null;
  published_at: string | null;
  company_name: string;
  /** Storage path, for logos uploaded by an employer. */
  company_logo_path: string | null;
  /** Absolute URL, for logos supplied by a job provider. */
  company_logo_url: string | null;
  company_industry: string | null;

  source: string;
  external_url: string | null;
  /** True when the job came from a provider and has no employer account. */
  is_external: boolean;
  /** 0–99, or null when the seeker has no parsed resume to match against. */
  match_score: number | null;
  /** The resume keywords this job actually hit — shown on the card. */
  matched_keywords: string[];
}

/**
 * A row in the seeker's "My Applications" screen.
 * Backed by the `seeker_application_details` view.
 */
export interface SeekerApplicationDetail extends Application {
  job_title: string;
  job_location: string;
  job_type: JobType;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  job_status: JobStatus;
  company_name: string | null;
  company_logo_path: string | null;
  company_logo_url: string | null;
  source: string;
  external_url: string | null;
  is_external: boolean;
}

/**
 * A row in the employer's applicant list for a posting.
 * Backed by the `job_applicant_details` view.
 */
export interface JobApplicantDetail extends Application {
  seeker_name: string | null;
  seeker_avatar_url: string | null;
  seeker_headline: string | null;
  seeker_bio: string | null;
  seeker_years_experience: number | null;
  seeker_resume_path: string | null;
  seeker_resume_filename: string | null;
}

/** Employer dashboard list item: a posting plus its applicant counters. */
export interface JobPostingWithStats extends JobPosting {
  applicant_count: number;
  new_applicant_count: number;
}

// ---------------------------------------------------------------------------
// Write payloads
// ---------------------------------------------------------------------------

export interface CreateJobPostingInput {
  title: string;
  description: string;
  requirements: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency?: string;
  location: string;
  job_type: JobType;
  employment_type: EmploymentType;
  industry: string | null;
  status?: Extract<JobStatus, "draft" | "published">;
}

export interface SeekerPreferencesInput {
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  min_salary: number | null;
  preferred_job_types: JobType[];
  preferred_locations: string[];
  industries: string[];
}

export interface EmployerProfileInput {
  company_name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  company_size: string | null;
}

/** What the `parse-resume` Edge Function returns. */
export interface ResumeInsights {
  skills: string[];
  titles: string[];
  keywords: string[];
  seniority: string | null;
  summary: string | null;
  /** `ai` when a model ran, `heuristic` when dictionary matching was used. */
  mode: "ai" | "heuristic";
}

export const STORAGE_BUCKETS = {
  resumes: "resumes",
  companyLogos: "company-logos",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
