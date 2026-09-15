import { useCallback, useEffect, useState } from "react";

import { Page } from "@/components/layout/AppShell";
import {
  CompanyLogo,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { describeSupabaseError } from "@/lib/supabase";
import {
  APPLICATION_STATUS_ORDER,
  formatRelativeTime,
  formatSalaryRange,
} from "@/lib/types";
import type { SeekerApplicationDetail } from "@/lib/types";
import { fetchMyApplications } from "@/services/applications";
import { companyLogoUrl } from "@/services/storage";
import { useAuth } from "@/stores/useAuth";

export function Applications() {
  const userId = useAuth((state) => state.session?.user?.id);

  const [applications, setApplications] = useState<SeekerApplicationDetail[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setApplications(await fetchMyApplications(userId));
      setError(null);
    } catch (caught) {
      setError(
        describeSupabaseError(caught, "Could not load your applications."),
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner label="Loading your applications…" />;

  return (
    <Page>
      <PageHeader
        title="My applications"
        subtitle={`${applications.length} ${applications.length === 1 ? "application" : "applications"}`}
      />

      {error ? (
        <ErrorNotice message={error} onRetry={() => void load()} />
      ) : null}

      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          message="Head to Discover and swipe right on a role you want. It lands here instantly."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((application) => (
            <li key={application.id}>
              <ApplicationRow application={application} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function ApplicationRow({
  application,
}: {
  application: SeekerApplicationDetail;
}) {
  const company = application.company_name ?? "Unknown company";

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <CompanyLogo
          name={company}
          url={companyLogoUrl(application.company_logo_path)}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug text-white">
            {application.job_title}
          </h3>
          <p className="truncate text-sm text-muted">{company}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <p className="mt-3 text-xs font-medium text-muted">
        {formatSalaryRange(
          application.salary_min,
          application.salary_max,
          application.salary_currency,
        )}
        {" · "}
        Applied {formatRelativeTime(application.created_at)}
      </p>

      <ProgressTrail application={application} />
    </article>
  );
}

/**
 * Compact pipeline indicator. A rejection ends the trail where it happened
 * rather than implying the later stages are still reachable.
 */
function ProgressTrail({
  application,
}: {
  application: SeekerApplicationDetail;
}) {
  if (application.status === "rejected") {
    return (
      <p className="mt-3 text-xs font-semibold text-red">
        Closed{" "}
        {formatRelativeTime(application.decided_at ?? application.updated_at)}
      </p>
    );
  }

  const currentIndex = APPLICATION_STATUS_ORDER.indexOf(application.status);

  const caption =
    application.status === "hired"
      ? "Offer stage"
      : application.status === "shortlisted"
        ? "Shortlisted"
        : application.status === "viewed"
          ? "Employer has seen it"
          : "Waiting on the employer";

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex items-center">
        {APPLICATION_STATUS_ORDER.map((status, index) => (
          <div key={status} className="flex items-center">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                index <= currentIndex ? "bg-accent" : "bg-border",
              )}
            />
            {index < APPLICATION_STATUS_ORDER.length - 1 ? (
              <span
                className={cn(
                  "h-0.5 w-5",
                  index < currentIndex ? "bg-accent" : "bg-border",
                )}
              />
            ) : null}
          </div>
        ))}
      </div>
      <span className="text-xs font-semibold text-muted">{caption}</span>
    </div>
  );
}
