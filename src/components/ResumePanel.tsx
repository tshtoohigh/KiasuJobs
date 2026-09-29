import { FileText, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { describeSupabaseError } from "@/lib/supabase";
import type { SeekerProfile } from "@/lib/types";
import { setSeekerResume } from "@/services/profiles";
import {
  ResumeTextError,
  analyseResume,
  extractResumeText,
  saveResumeInsights,
} from "@/services/resume";
import { uploadResume } from "@/services/storage";
import { showToast } from "@/stores/useToast";

import { Button, SectionTitle } from "./ui";

type Phase = "idle" | "uploading" | "reading" | "analysing";

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  uploading: "Uploading…",
  reading: "Reading the file…",
  analysing: "Finding your skills…",
};

/**
 * Resume upload plus keyword extraction.
 *
 * Upload and analysis are deliberately independent: the file is stored first, so
 * a failure in text extraction or in the Edge Function never costs the user
 * their upload. Analysis only affects ranking — the resume still gets attached
 * to applications either way.
 */
export function ResumePanel({
  userId,
  profile,
  onChanged,
}: {
  userId: string;
  profile: SeekerProfile | null;
  onChanged: () => Promise<void> | void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  // Shown when a PDF can't be read (scans, Word files) so there's still a way through.
  const [showPaste, setShowPaste] = useState(false);
  const [pastedText, setPastedText] = useState("");

  const busy = phase !== "idle";
  const hasInsights = (profile?.ai_keywords?.length ?? 0) > 0;

  /** Analyse text we already have, then persist the keywords. */
  const runAnalysis = async (text: string) => {
    setPhase("analysing");
    const insights = await analyseResume(text);
    await saveResumeInsights(userId, text, insights);
    await onChanged();

    showToast(
      insights.mode === "ai"
        ? `Found ${insights.skills.length} skills — your deck is re-ranked.`
        : `Found ${insights.skills.length} skills (keyword matching).`,
      "success",
    );
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setShowPaste(false);

    try {
      // 1. Store the file. This is the part that must not fail silently.
      setPhase("uploading");
      const uploaded = await uploadResume(userId, file);
      await setSeekerResume(userId, uploaded.path, uploaded.filename);
      await onChanged();

      // 2. Extract text. Failure here is recoverable — offer the paste box.
      setPhase("reading");
      let text: string;
      try {
        text = await extractResumeText(file);
      } catch (extractError) {
        setShowPaste(true);
        setError(
          extractError instanceof ResumeTextError
            ? extractError.message
            : describeSupabaseError(extractError, "Could not read that file."),
        );
        showToast("Resume saved, but the text could not be read.", "info");
        return;
      }

      // 3. Analyse.
      await runAnalysis(text);
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not process that file."));
    } finally {
      setPhase("idle");
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onAnalysePaste = async () => {
    if (pastedText.trim().length < 80) {
      setError("Paste a bit more — at least a couple of sentences.");
      return;
    }
    setError(null);
    try {
      await runAnalysis(pastedText);
      setShowPaste(false);
      setPastedText("");
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not analyse that text."));
    } finally {
      setPhase("idle");
    }
  };

  const onReanalyse = async () => {
    if (!profile?.resume_text) return;
    setError(null);
    try {
      await runAnalysis(profile.resume_text);
    } catch (caught) {
      setError(
        describeSupabaseError(caught, "Could not re-analyse your resume."),
      );
    } finally {
      setPhase("idle");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle>Resume</SectionTitle>

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            profile?.resume_path
              ? "bg-accent-dim text-accent"
              : "bg-surface text-muted-dark",
          )}
        >
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">
            {profile?.resume_filename ?? "No resume yet"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-dark">
            {profile?.resume_path
              ? "Attached to every application you send."
              : "PDF works best — we read it to match you to jobs."}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red/40 bg-red-dim p-3 text-xs leading-relaxed text-red">
          {error}
        </p>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain"
        className="hidden"
        onChange={(event) => void onPickFile(event.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={profile?.resume_path ? "secondary" : "primary"}
          onClick={() => fileInput.current?.click()}
          loading={busy}
        >
          <Upload className="h-4 w-4" />
          {profile?.resume_path ? "Replace" : "Upload resume"}
        </Button>

        {profile?.resume_text && !busy ? (
          <Button variant="ghost" onClick={() => void onReanalyse()}>
            <Sparkles className="h-4 w-4" />
            Re-analyse
          </Button>
        ) : null}
      </div>

      {busy ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          {PHASE_LABEL[phase as Exclude<Phase, "idle">]}
        </p>
      ) : null}

      {showPaste ? (
        <div className="mt-4 rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-semibold text-white">
            Paste your resume text instead
          </p>
          <textarea
            rows={5}
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            placeholder="Paste the contents of your resume here…"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:border-accent focus:outline-none"
          />
          <Button
            className="mt-2"
            onClick={() => void onAnalysePaste()}
            loading={busy}
          >
            <Sparkles className="h-4 w-4" />
            Analyse text
          </Button>
        </div>
      ) : null}

      {hasInsights ? <ResumeInsightsSummary profile={profile} /> : null}
    </div>
  );
}

/** What the parser found, so the matching isn't a black box. */
function ResumeInsightsSummary({ profile }: { profile: SeekerProfile | null }) {
  if (!profile) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
          What we matched you on
        </span>
      </div>

      {profile.ai_summary ? (
        <p className="mb-3 text-sm leading-relaxed text-muted">
          {profile.ai_summary}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {profile.ai_skills.slice(0, 14).map((skill) => (
          <span
            key={skill}
            className="rounded-md bg-accent-dim px-2 py-1 text-[11px] font-semibold text-accent"
          >
            {skill}
          </span>
        ))}
        {profile.ai_skills.length > 14 ? (
          <span className="px-1 py-1 text-[11px] font-semibold text-muted-dark">
            +{profile.ai_skills.length - 14} more
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-dark">
        {profile.ai_seniority ? `Read as ${profile.ai_seniority}-level. ` : ""}
        Jobs matching these terms are ranked higher in your deck.
      </p>
    </div>
  );
}
