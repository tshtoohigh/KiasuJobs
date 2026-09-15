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

/**
 * The face of a deck card. Purely presentational, so it can be reused by the
 * details modal and any future previews.
 */
export function JobCard({ job }: { job: JobFeedItem }) {
  const posted = formatRelativeTime(job.published_at);

  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className="flex items-center gap-3">
        <CompanyLogo
          name={job.company_name}
          url={companyLogoUrl(job.company_logo_path)}
          size={52}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">
            {job.company_name}
          </p>
          {posted ? <p className="text-xs text-muted-dark">{posted}</p> : null}
        </div>
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

      <p className="text-sm leading-relaxed text-muted">
        {truncate(job.description, 220)}
      </p>

      {job.requirements.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {job.requirements.slice(0, 3).map((requirement) => (
            <li key={requirement} className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="truncate text-sm text-white">{requirement}</span>
            </li>
          ))}
          {job.requirements.length > 3 ? (
            <li className="pl-4 text-xs text-muted-dark">
              +{job.requirements.length - 3} more requirement
              {job.requirements.length - 3 === 1 ? "" : "s"}
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className="mt-auto pt-2 text-center text-xs font-semibold text-muted-dark">
        Tap for the full description
      </p>
    </div>
  );
}
