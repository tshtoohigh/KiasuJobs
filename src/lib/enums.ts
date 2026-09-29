/**
 * Enum values mirrored 1:1 with the Postgres enum types defined in
 * `supabase/migrations/*_init.sql`. If you change one, change both.
 */

export const USER_ROLES = ["seeker", "employer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const JOB_TYPES = ["remote", "hybrid", "onsite"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "internship",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const JOB_STATUSES = ["draft", "published", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Application lifecycle. `applied` is set by the seeker's right-swipe; every
 * later state is set by the employer from their applicant list.
 */
export const APPLICATION_STATUSES = [
  "applied",
  "viewed",
  "shortlisted",
  "rejected",
  "hired",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const SWIPE_DIRECTIONS = ["left", "right"] as const;
export type SwipeDirection = (typeof SWIPE_DIRECTIONS)[number];

// ---------------------------------------------------------------------------
// Human-readable labels (shared by the mobile app and the landing page)
// ---------------------------------------------------------------------------

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  viewed: "Viewed by employer",
  shortlisted: "Shortlisted",
  rejected: "Not selected",
  hired: "Hired",
};

/** Ordered progression used to render the tracker timeline. */
export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "applied",
  "viewed",
  "shortlisted",
  "hired",
];

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return status === "rejected" || status === "hired";
}
