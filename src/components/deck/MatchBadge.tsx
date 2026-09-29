import { Sparkles } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * "84% match" pill. Only rendered when the seeker has a parsed resume —
 * `match_score` comes back NULL otherwise, and a meaningless 0% would be worse
 * than no badge at all.
 */
export function MatchBadge({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score == null) return null;

  const tone =
    score >= 80
      ? "bg-green-dim text-green border-green/40"
      : score >= 58
        ? "bg-accent-dim text-accent border-accent/40"
        : "bg-surface text-muted border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        tone,
        className,
      )}
      title="How closely this job matches the keywords in your resume"
    >
      <Sparkles className="h-3 w-3" />
      {score}% match
    </span>
  );
}

/** The resume keywords this job actually hit. Shows *why* it was surfaced. */
export function MatchedKeywords({
  keywords,
  max = 4,
}: {
  keywords: string[];
  max?: number;
}) {
  if (keywords.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-dark">
        Matches
      </span>
      {keywords.slice(0, max).map((keyword) => (
        <span
          key={keyword}
          className="rounded bg-green-dim px-1.5 py-0.5 text-[10px] font-semibold text-green"
        >
          {keyword}
        </span>
      ))}
      {keywords.length > max ? (
        <span className="text-[10px] font-semibold text-muted-dark">
          +{keywords.length - max}
        </span>
      ) : null}
    </div>
  );
}
