import { ExternalLink } from "lucide-react";

import {
  formatEmploymentType,
  formatLocation,
  formatRelativeTime,
  formatSalaryRange,
  truncate,
} from "@/lib/types";
import type { JobFeedItem } from "@/lib/types";
import { companyLogoUrl } from "@/services/storage";

import { CompanyLogo, Tag } from "../ui";
import { MatchBadge, MatchedKeywords } from "./MatchBadge";

/** Provider id → something a person would recognise. */
const SOURCE_LABELS: Record<string, string> = {
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  jobicy: "Jobicy",
  adzuna: "Adzuna",
};

/**
 * The face of a deck card. Purely presentational, so it's reused by the details
 * modal and any previews.
 */
export function JobCard({ job }: { job: JobFeedItem }) {
  const posted = formatRelativeTime(job.published_at);
  // An employer logo is a storage path; a provider logo is already a URL.
  const logo = job.company_logo_url ?? companyLogoUrl(job.company_logo_path);

  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className="flex items-start gap-3">
        <CompanyLogo name={job.company_name} url={logo} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">
            {job.company_name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {posted ? (
              <span className="text-xs text-muted-dark">{posted}</span>
            ) : null}
            {job.is_external ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-dark">
                <ExternalLink className="h-3 w-3" />
                via {SOURCE_LABELS[job.source] ?? job.source}
              </span>
            ) : null}
          </div>
        </div>
        <MatchBadge score={job.match_score} />
      </div>

      <h2 className="text-2xl font-bold leading-tight text-white">
        {job.title}
      </h2>

      <p className="text-base font-bold text-green">
        {formatSalaryRange(job.salary_min, job.salary_max, job.salary_currency)}
      </p>

      <div className="flex flex-wrap gap-2">
        <Tag label={formatLocation(job.location, job.job_type)} tone="accent" />
        <Tag label={formatEmploymentType(job.employment_type)} />
        {job.industry ? <Tag label={job.industry} /> : null}
      </div>

      <MatchedKeywords keywords={job.matched_keywords} />

      <p className="text-sm leading-relaxed text-muted">
        {truncate(job.description, 200)}
      </p>

      {job.requirements.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {job.requirements.slice(0, 3).map((requirement) => (
            <li key={requirement} className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="truncate text-sm text-white">{requirement}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-auto pt-2 text-center text-xs font-semibold text-muted-dark">
        Tap for the full description
      </p>
    </div>
  );
}
