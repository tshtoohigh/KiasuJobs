import { ArrowLeft, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Page } from "@/components/layout/AppShell";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Spinner,
  StatusBadge,
  Tag,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { describeSupabaseError } from "@/lib/supabase";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  formatLocation,
  formatRelativeTime,
  formatSalaryRange,
  initialsFromName,
} from "@/lib/types";
import type {
  ApplicationStatus,
  JobApplicantDetail,
  JobPosting,
} from "@/lib/types";
import {
  fetchApplicantsForJob,
  markApplicationsViewed,
  updateApplicationStatus,
} from "@/services/applications";
import { fetchJobPosting } from "@/services/jobs";
import { createResumeSignedUrl } from "@/services/storage";
import { showToast } from "@/stores/useToast";

/** Statuses an employer can set from this screen. */
const DECISIONS: ApplicationStatus[] = APPLICATION_STATUSES.filter(
  (status) => status !== "applied" && status !== "viewed",
);

export function Applicants() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [applicants, setApplicants] = useState<JobApplicantDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [job, rows] = await Promise.all([
        fetchJobPosting(id),
        fetchApplicantsForJob(id),
      ]);
      setPosting(job);
      setApplicants(rows);
      setError(null);

      // Opening the list counts as reading it, so brand-new applications flip
      // to `viewed` — which is what the seeker's tracker shows.
      const unread = rows
        .filter((row) => row.status === "applied")
        .map((row) => row.id);
      if (unread.length > 0) {
        try {
          await markApplicationsViewed(unread);
          setApplicants((current) =>
            current.map((row) =>
              unread.includes(row.id)
                ? { ...row, status: "viewed" as ApplicationStatus }
                : row,
            ),
          );
        } catch {
          // Not worth surfacing — the employer still sees the applicants.
        }
      }
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not load applicants."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Optimistic: the row updates at once, and reverts if the write fails. */
  const decide = async (applicationId: string, status: ApplicationStatus) => {
    const previous = applicants;
    setApplicants((current) =>
      current.map((row) =>
        row.id === applicationId ? { ...row, status } : row,
      ),
    );

    try {
      await updateApplicationStatus(applicationId, status);
      showToast(
        `Marked as ${APPLICATION_STATUS_LABELS[status].toLowerCase()}.`,
        "success",
      );
    } catch (caught) {
      setApplicants(previous);
      showToast(
        describeSupabaseError(caught, "Could not update that applicant."),
        "error",
      );
    }
  };

  const openResume = async (path: string | null) => {
    if (!path) {
      showToast("This candidate has not uploaded a resume.", "info");
      return;
    }
    try {
      const url = await createResumeSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      showToast(
        describeSupabaseError(caught, "Could not open that resume."),
        "error",
      );
    }
  };

  if (loading) return <Spinner label="Loading applicants…" />;

  return (
    <Page>
      <header className="mb-4 flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back to postings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold leading-snug text-white">
            {posting?.title ?? "Posting"}
          </h1>
          {posting ? (
            <p className="mt-0.5 text-xs text-muted-dark">
              {formatSalaryRange(
                posting.salary_min,
                posting.salary_max,
                posting.salary_currency,
              )}{" "}
              · {applicants.length}{" "}
              {applicants.length === 1 ? "applicant" : "applicants"}
            </p>
          ) : null}
        </div>
      </header>

      {posting ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Tag
            label={formatLocation(posting.location, posting.job_type)}
            tone="accent"
          />
          <Tag
            label={posting.status === "published" ? "Live" : posting.status}
          />
        </div>
      ) : null}

      {error ? (
        <ErrorNotice message={error} onRetry={() => void load()} />
      ) : null}

      {applicants.length === 0 ? (
        <EmptyState
          title="No applicants yet"
          message="As soon as a candidate swipes right on this role, they appear here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {applicants.map((applicant) => (
            <li key={applicant.id}>
              <ApplicantCard
                applicant={applicant}
                onDecide={(status) => void decide(applicant.id, status)}
                onOpenResume={() =>
                  void openResume(applicant.seeker_resume_path)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function ApplicantCard({
  applicant,
  onDecide,
  onOpenResume,
}: {
  applicant: JobApplicantDetail;
  onDecide: (status: ApplicationStatus) => void;
  onOpenResume: () => void;
}) {
  const name = applicant.seeker_name ?? "Candidate";

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-dim font-bold text-accent">
          {initialsFromName(name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white">{name}</h3>
          {applicant.seeker_headline ? (
            <p className="text-sm leading-snug text-muted">
              {applicant.seeker_headline}
            </p>
          ) : null}
        </div>
        <StatusBadge status={applicant.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {applicant.seeker_years_experience != null ? (
          <Tag label={`${applicant.seeker_years_experience} yrs experience`} />
        ) : null}
        <Tag label={`Applied ${formatRelativeTime(applicant.created_at)}`} />
      </div>

      {applicant.seeker_bio ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {applicant.seeker_bio}
        </p>
      ) : null}

      {applicant.cover_note ? (
        <div className="mt-3 rounded-xl bg-surface p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-dark">
            Note from candidate
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white">
            {applicant.cover_note}
          </p>
        </div>
      ) : null}

      <Button
        variant="secondary"
        onClick={onOpenResume}
        disabled={!applicant.seeker_resume_path}
        className="mt-3"
        full
      >
        <FileText className="h-4 w-4" />
        {applicant.seeker_resume_path ? "Open resume" : "No resume attached"}
      </Button>

      <div className="mt-3 flex flex-wrap gap-2">
        {DECISIONS.map((status) => {
          const active = applicant.status === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onDecide(status)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-4 py-2 text-[11px] font-bold transition",
                active
                  ? "border-accent bg-accent text-bg"
                  : status === "rejected"
                    ? "border-red/40 text-red hover:bg-red-dim"
                    : "border-border text-muted hover:text-white",
              )}
            >
              {APPLICATION_STATUS_LABELS[status]}
            </button>
          );
        })}
      </div>
    </article>
  );
}
