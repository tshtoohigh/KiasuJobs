import { useRef, useState } from "react";

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
import type { JobType } from "@/lib/types";
import { setSeekerResume, upsertSeekerProfile } from "@/services/profiles";
import { uploadResume } from "@/services/storage";
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

  const fileInput = useRef<HTMLInputElement | null>(null);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [locations, setLocations] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);

  const [resume, setResume] = useState<{
    path: string;
    filename: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value)
      ? list.filter((entry) => entry !== value)
      : [...list, value];

  const onPickFile = async (file: File | undefined) => {
    if (!file || !userId) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadResume(userId, file);
      await setSeekerResume(userId, uploaded.path, uploaded.filename);
      setResume(uploaded);
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not upload that file."));
    } finally {
      setUploading(false);
    }
  };

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
        This is what employers see when you swipe right. Preferences shape your
        deck — leave one blank to mean "anything".
      </p>

      <div className="mt-6">
        {error ? <ErrorNotice message={error} /> : null}
      </div>

      <section className="mb-6">
        <SectionTitle>Resume</SectionTitle>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="truncate font-semibold text-white">
            {resume ? resume.filename : "No file chosen yet"}
          </p>
          <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-dark">
            {resume
              ? "Attached to every application you send."
              : "PDF or Word, up to 5 MB. You can add it later from your profile."}
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            className="hidden"
            onChange={(event) => void onPickFile(event.target.files?.[0])}
          />
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
            loading={uploading}
          >
            {resume ? "Replace file" : "Choose file"}
          </Button>
        </div>
      </section>

      <section className="mb-6">
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
        <SectionTitle>What you're looking for</SectionTitle>

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
