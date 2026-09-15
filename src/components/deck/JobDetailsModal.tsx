import { X } from "lucide-react";
import { useEffect } from "react";

import {
  formatEmploymentType,
  formatLocation,
  formatRelativeTime,
  formatSalaryRange,
} from "@/lib/types";
import type { JobFeedItem } from "@/lib/types";
import { companyLogoUrl } from "@/services/storage";

import { Button, CompanyLogo, SectionTitle, Tag } from "../ui";

/**
 * Full posting, opened by tapping a card. Decisions made here route back
 * through the deck's swipe path, so the card still animates out and the
 * optimistic write behaves identically.
 */
export function JobDetailsModal({
  job,
  onClose,
  onApply,
  onSkip,
}: {
  job: JobFeedItem | null;
  onClose: () => void;
  onApply: () => void;
  onSkip: () => void;
}) {
  // Escape to close, and don't let the page behind scroll.
  useEffect(() => {
    if (!job) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [job, onClose]);

  if (!job) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${job.title} at ${job.company_name}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-bg sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end p-4 pb-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job details"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex items-center gap-3">
            <CompanyLogo
              name={job.company_name}
              url={companyLogoUrl(job.company_logo_path)}
              size={60}
            />
            <div className="min-w-0">
              <p className="text-xl font-bold text-white">{job.company_name}</p>
              {job.company_industry ? (
                <p className="text-xs text-muted-dark">
                  {job.company_industry}
                </p>
              ) : null}
            </div>
          </div>

          <h2 className="mt-4 text-3xl font-bold leading-tight text-white">
            {job.title}
          </h2>

          <p className="mt-2 text-lg font-bold text-green">
            {formatSalaryRange(
              job.salary_min,
              job.salary_max,
              job.salary_currency,
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Tag
              label={formatLocation(job.location, job.job_type)}
              tone="accent"
            />
            <Tag label={formatEmploymentType(job.employment_type)} />
            {job.published_at ? (
              <Tag label={`Posted ${formatRelativeTime(job.published_at)}`} />
            ) : null}
          </div>

          <div className="mt-6">
            <SectionTitle>About the role</SectionTitle>
            <p className="whitespace-pre-line leading-relaxed text-muted">
              {job.description}
            </p>
          </div>

          {job.requirements.length > 0 ? (
            <div className="mt-6">
              <SectionTitle>What they're looking for</SectionTitle>
              <ul className="flex flex-col gap-2">
                {job.requirements.map((requirement) => (
                  <li key={requirement} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="leading-relaxed text-white">
                      {requirement}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-6 text-xs leading-relaxed text-muted-dark">
            Applying sends your saved resume and profile to {job.company_name}.
          </p>
        </div>

        <div className="flex gap-3 border-t border-border p-4">
          <Button variant="secondary" onClick={onSkip} full>
            Skip
          </Button>
          <Button onClick={onApply} full>
            Apply now
          </Button>
        </div>
      </div>
    </div>
  );
}
