import type {
  ApplicationStatus,
  EmploymentType,
  JobStatus,
  JobType,
  SwipeDirection,
  UserRole,
} from './enums';
import type {
  AppUser,
  Application,
  EmployerProfile,
  JobApplicantDetail,
  JobFeedItem,
  JobPosting,
  JobSwipe,
  SeekerApplicationDetail,
  SeekerProfile,
} from './models';

/**
 * Typed schema for `supabase-js`. Hand-authored to match
 * `supabase/migrations/*` so the client is typed without requiring a running
 * database. Once your project is live you can regenerate the canonical version
 * with `npm run db:types` and swap this import for the generated file.
 */

type Timestamps = 'created_at' | 'updated_at';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: AppUser;
        Insert: Omit<AppUser, Timestamps | 'onboarding_completed'> &
          Partial<Pick<AppUser, Timestamps | 'onboarding_completed'>>;
        Update: Partial<AppUser>;
        Relationships: [];
      };
      seeker_profiles: {
        Row: SeekerProfile;
        Insert: Pick<SeekerProfile, 'user_id'> & Partial<Omit<SeekerProfile, 'user_id'>>;
        Update: Partial<SeekerProfile>;
        Relationships: [];
      };
      employer_profiles: {
        Row: EmployerProfile;
        Insert: Pick<EmployerProfile, 'user_id' | 'company_name'> &
          Partial<Omit<EmployerProfile, 'user_id' | 'company_name'>>;
        Update: Partial<EmployerProfile>;
        Relationships: [];
      };
      job_postings: {
        Row: JobPosting;
        Insert: Omit<JobPosting, 'id' | Timestamps | 'published_at' | 'salary_currency'> &
          Partial<Pick<JobPosting, 'id' | Timestamps | 'published_at' | 'salary_currency'>>;
        Update: Partial<JobPosting>;
        Relationships: [];
      };
      applications: {
        Row: Application;
        Insert: Pick<Application, 'job_id' | 'seeker_id'> &
          Partial<Omit<Application, 'job_id' | 'seeker_id'>>;
        Update: Partial<Application>;
        Relationships: [];
      };
      job_swipes: {
        Row: JobSwipe;
        Insert: Pick<JobSwipe, 'seeker_id' | 'job_id' | 'direction'> &
          Partial<Pick<JobSwipe, 'id' | 'created_at'>>;
        Update: Partial<JobSwipe>;
        Relationships: [];
      };
    };
    Views: {
      seeker_application_details: {
        Row: SeekerApplicationDetail;
        Relationships: [];
      };
      job_applicant_details: {
        Row: JobApplicantDetail;
        Relationships: [];
      };
    };
    Functions: {
      get_job_feed: {
        Args: { p_limit?: number; p_exclude?: string[] };
        Returns: JobFeedItem[];
      };
      apply_to_job: {
        Args: { p_job_id: string; p_cover_note?: string | null };
        Returns: Application;
      };
    };
    Enums: {
      user_role: UserRole;
      job_type: JobType;
      employment_type: EmploymentType;
      job_status: JobStatus;
      application_status: ApplicationStatus;
      swipe_direction: SwipeDirection;
    };
    CompositeTypes: Record<never, never>;
  };
}

/** Convenience aliases so app code doesn't repeat the deep generic paths. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
