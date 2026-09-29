import { useCallback, useEffect, useState } from "react";

import { ResumePanel } from "@/components/ResumePanel";
import {
  Button,
  Chip,
  ErrorNotice,
  Field,
  SectionTitle,
  TextArea,
} from "@/components/ui";
import { describeSupabaseError } from "@/lib/supabase";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/types";
import type { JobType, SeekerProfile } from "@/lib/types";
import { fetchSeekerProfile, upsertSeekerProfile } from "@/services/profiles";
import { useAuth } from "@/stores/useAuth";

const INDUSTRY_OPTIONS = [
  "Software",
  "Design",
  "Logistics",
  "Finance",
  "Healthcare",
  "Education",
  "Marketing",
];

/** Splits a free-text list ("Singapore, Remote") into clean entries. */
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function OnboardSeeker() {
  const userId = useAuth((state) => state.session?.user?.id);
  const finishOnboarding = useAuth((state) => state.finishOnboarding);
  const signOut = useAuth((state) => state.signOut);

  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [locations, setLocations] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The resume panel writes straight to seeker_profiles, so this screen reads
  // it back to show what the parser found.
  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const row = await fetchSeekerProfile(userId);
      setProfile(row);
      // Pre-fill the headline from the AI summary if the user hasn't typed one.
      setHeadline((current) => current || (row?.ai_titles?.[0] ?? ""));
    } catch {
      // Non-fatal: onboarding still works without it.
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value)
      ? list.filter((entry) => entry !== value)
      : [...list, value];

  const submit = async () => {
    if (!userId) return;
    setError(null);
    setBusy(true);
    try {
      await upsertSeekerProfile(userId, {
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        years_experience: yearsExperience
          ? Number.parseInt(yearsExperience, 10)
          : null,
        min_salary: minSalary ? Number.parseInt(minSalary, 10) : null,
        preferred_job_types: jobTypes,
        preferred_locations: parseList(locations),
        industries,
      });
      await finishOnboarding();
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not save your profile."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto h-full max-w-md overflow-y-auto p-6">
      <h1 className="text-2xl font-extrabold text-white">
        Set up your profile
      </h1>
      <p className="mt-2 leading-relaxed text-muted">
        Upload your resume and we&apos;ll read it to rank jobs for you.
        Preferences narrow the deck further — leave one blank to mean
        &ldquo;anything&rdquo;.
      </p>

      {error ? (
        <div className="mt-5">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <div className="mt-6">
        {userId ? (
          <ResumePanel
            userId={userId}
            profile={profile}
            onChanged={loadProfile}
          />
        ) : null}
      </div>

      <section className="mt-6">
        <SectionTitle>About you</SectionTitle>
        <Field
          label="Headline"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Frontend engineer · React & React Native"
        />
        <TextArea
          label="Short bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="What you do, and what you want next."
        />
        <Field
          label="Years of experience"
          type="number"
          min={0}
          value={yearsExperience}
          onChange={(event) => setYearsExperience(event.target.value)}
          placeholder="5"
        />
      </section>

      <section className="mb-6">
        <SectionTitle>What you&apos;re looking for</SectionTitle>

        <p className="mb-2 text-[13px] font-semibold text-white">Work style</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {JOB_TYPES.map((type) => (
            <Chip
              key={type}
              label={JOB_TYPE_LABELS[type]}
              selected={jobTypes.includes(type)}
              onClick={() => setJobTypes((current) => toggle(current, type))}
            />
          ))}
        </div>

        <p className="mb-2 text-[13px] font-semibold text-white">Industries</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {INDUSTRY_OPTIONS.map((industry) => (
            <Chip
              key={industry}
              label={industry}
              selected={industries.includes(industry)}
              onClick={() =>
                setIndustries((current) => toggle(current, industry))
              }
            />
          ))}
        </div>

        <Field
          label="Preferred locations"
          value={locations}
          onChange={(event) => setLocations(event.target.value)}
          placeholder="Singapore, Kuala Lumpur"
          hint="Comma separated. Remote roles always show regardless."
        />

        <Field
          label="Minimum monthly salary"
          type="number"
          min={0}
          value={minSalary}
          onChange={(event) => setMinSalary(event.target.value)}
          placeholder="6000"
          hint="Jobs whose top of range falls below this are hidden."
        />
      </section>

      <div className="flex flex-col gap-2 pb-6">
        <Button onClick={() => void submit()} loading={busy} full>
          Start swiping
        </Button>
        <Button variant="ghost" onClick={() => void signOut()} full>
          Sign out
        </Button>
      </div>
    </div>
  );
}
