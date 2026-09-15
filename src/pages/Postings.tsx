import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Page } from "@/components/layout/AppShell";
import {
  EmptyState,
  ErrorNotice,
  PageHeader,
  Spinner,
  Tag,
} from "@/components/ui";
import { describeSupabaseError, supabase } from "@/lib/supabase";
import {
  formatLocation,
  formatRelativeTime,
  formatSalaryRange,
} from "@/lib/types";
import type { JobPostingWithStats } from "@/lib/types";
import { fetchMyPostings } from "@/services/jobs";
import { useAuth } from "@/stores/useAuth";

export function Postings() {
  const userId = useAuth((state) => state.session?.user?.id);
  const navigate = useNavigate();

  const [postings, setPostings] = useState<JobPostingWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Held in a ref so the realtime handler never needs to re-subscribe. */
  const jobIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await fetchMyPostings(userId);
      setPostings(rows);
      jobIds.current = new Set(rows.map((row) => row.id));
      setError(null);
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not load your postings."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Live applicant counts. RLS applies to realtime too, so this only ever
   * delivers applications for postings this employer owns.
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("employer-applications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        (payload) => {
          const jobId = (payload.new as { job_id?: string } | null)?.job_id;
          if (jobId && jobIds.current.has(jobId)) void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  if (loading) return <Spinner label="Loading your postings…" />;

  const totalApplicants = postings.reduce(
    (sum, posting) => sum + posting.applicant_count,
    0,
  );

  return (
    <Page>
      <PageHeader
        title="Your postings"
        subtitle={`${postings.length} ${postings.length === 1 ? "posting" : "postings"} · ${totalApplicants} ${
          totalApplicants === 1 ? "applicant" : "applicants"
        }`}
      />

      {error ? (
        <ErrorNotice message={error} onRetry={() => void load()} />
      ) : null}

      {postings.length === 0 ? (
        <EmptyState
          title="No postings yet"
          message="Post your first role and it appears in candidates' decks straight away."
          actionLabel="Post a job"
          onAction={() => navigate("/new-job")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {postings.map((posting) => (
            <li key={posting.id}>
              <button
                type="button"
                onClick={() => navigate(`/postings/${posting.id}`)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:bg-card-hover"
              >
                <div className="flex items-start gap-3">
                  <h3 className="flex-1 font-bold leading-snug text-white">
                    {posting.title}
                  </h3>
                  {posting.new_applicant_count > 0 ? (
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-bg">
                      {posting.new_applicant_count} new
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-sm font-bold text-green">
                  {formatSalaryRange(
                    posting.salary_min,
                    posting.salary_max,
                    posting.salary_currency,
                  )}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag
                    label={formatLocation(posting.location, posting.job_type)}
                    tone="accent"
                  />
                  <Tag
                    label={
                      posting.status === "published"
                        ? "Live"
                        : posting.status === "draft"
                          ? "Draft"
                          : "Closed"
                    }
                  />
                </div>

                <div className="mt-3 flex justify-between border-t border-border pt-2.5 text-xs text-muted-dark">
                  <span>
                    {posting.applicant_count}{" "}
                    {posting.applicant_count === 1 ? "applicant" : "applicants"}
                  </span>
                  <span>
                    {posting.published_at
                      ? `Posted ${formatRelativeTime(posting.published_at)}`
                      : `Created ${formatRelativeTime(posting.created_at)}`}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
