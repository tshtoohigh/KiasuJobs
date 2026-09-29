import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Page } from "@/components/layout/AppShell";
import {
  Button,
  Chip,
  ErrorNotice,
  Field,
  PageHeader,
  SectionTitle,
  TextArea,
} from "@/components/ui";
import { describeSupabaseError } from "@/lib/supabase";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_TYPES,
  JOB_TYPE_LABELS,
} from "@/lib/types";
import type { EmploymentType, JobType } from "@/lib/types";
import { createJobPosting } from "@/services/jobs";
import { useAuth } from "@/stores/useAuth";
import { showToast } from "@/stores/useToast";

export function NewJob() {
  const userId = useAuth((state) => state.session?.user?.id);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [jobType, setJobType] = useState<JobType>("hybrid");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("full_time");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (status: "draft" | "published") => {
    if (!userId) return;

    if (title.trim().length < 2) return setError("Give the role a title.");
    if (!description.trim())
      return setError("Add a description — candidates read it.");

    const min = salaryMin ? Number.parseInt(salaryMin, 10) : null;
    const max = salaryMax ? Number.parseInt(salaryMax, 10) : null;
    if (min != null && max != null && max < min) {
      return setError(
        "The top of the salary range must be at least the bottom.",
      );
    }

    setError(null);
    setBusy(true);
    try {
      await createJobPosting(userId, {
        title,
        description,
        // One requirement per line keeps the input obvious.
        requirements: requirements
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        salary_min: min,
        salary_max: max,
        location,
        job_type: jobType,
        employment_type: employmentType,
        industry: industry.trim() || null,
        status,
      });

      showToast(
        status === "published"
          ? "Posted — it is in candidate decks now."
          : "Saved as a draft.",
        "success",
      );
      navigate("/");
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not save this posting."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Post a job"
        subtitle="Published roles appear in matching candidates' decks immediately."
      />

      {error ? <ErrorNotice message={error} /> : null}

      <section className="mb-4">
        <SectionTitle>The role</SectionTitle>
        <Field
          label="Job title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Senior React Native Engineer"
        />
        <TextArea
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What the person will own, who they work with, what success looks like."
          rows={6}
        />
        <TextArea
          label="Requirements"
          value={requirements}
          onChange={(event) => setRequirements(event.target.value)}
          placeholder={
            "4+ years React\nTypeScript\nComfortable owning releases"
          }
          hint="One per line."
        />
      </section>

      <section className="mb-4">
        <SectionTitle>Work style</SectionTitle>
        <div className="mb-4 flex flex-wrap gap-2">
          {JOB_TYPES.map((type) => (
            <Chip
              key={type}
              label={JOB_TYPE_LABELS[type]}
              selected={jobType === type}
              onClick={() => setJobType(type)}
            />
          ))}
        </div>

        <p className="mb-2 text-[13px] font-semibold text-white">
          Employment type
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map((type) => (
            <Chip
              key={type}
              label={EMPLOYMENT_TYPE_LABELS[type]}
              selected={employmentType === type}
              onClick={() => setEmploymentType(type)}
            />
          ))}
        </div>

        <Field
          label="Location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Tanjong Pagar, Singapore"
        />
        <Field
          label="Industry"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder="Software"
          hint="Used to match candidate preferences."
        />
      </section>

      <section className="mb-4">
        <SectionTitle>Salary (monthly, SGD)</SectionTitle>
        <div className="flex gap-3">
          <div className="flex-1">
            <Field
              label="From"
              type="number"
              min={0}
              value={salaryMin}
              onChange={(event) => setSalaryMin(event.target.value)}
              placeholder="8000"
            />
          </div>
          <div className="flex-1">
            <Field
              label="To"
              type="number"
              min={0}
              value={salaryMax}
              onChange={(event) => setSalaryMax(event.target.value)}
              placeholder="11000"
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-dark">
          Leave both blank to show "Salary not disclosed" — expect fewer swipes.
        </p>
      </section>

      <div className="flex flex-col gap-2 pb-2">
        <Button onClick={() => void submit("published")} loading={busy} full>
          Publish job
        </Button>
        <Button
          variant="secondary"
          onClick={() => void submit("draft")}
          disabled={busy}
          full
        >
          Save as draft
        </Button>
      </div>
    </Page>
  );
}
