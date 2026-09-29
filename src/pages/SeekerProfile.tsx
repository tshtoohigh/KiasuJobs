import { LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Page } from "@/components/layout/AppShell";
import { ResumePanel } from "@/components/ResumePanel";
import {
  Button,
  Card,
  Chip,
  ErrorNotice,
  Field,
  PageHeader,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import { describeSupabaseError } from "@/lib/supabase";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/types";
import type { JobType, SeekerProfile as SeekerProfileRow } from "@/lib/types";
import { fetchSeekerProfile, upsertSeekerProfile } from "@/services/profiles";
import { useAuth } from "@/stores/useAuth";
import { useJobQueue } from "@/stores/useJobQueue";
import { showToast } from "@/stores/useToast";

export function SeekerProfile() {
  const userId = useAuth((state) => state.session?.user?.id);
  const appUser = useAuth((state) => state.appUser);
  const signOut = useAuth((state) => state.signOut);
  const reloadDeck = useJobQueue((state) => state.initialise);

  const [profile, setProfile] = useState<SeekerProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headline, setHeadline] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const row = await fetchSeekerProfile(userId);
      setProfile(row);
      setHeadline(row?.headline ?? "");
      setMinSalary(row?.min_salary != null ? String(row.min_salary) : "");
      setJobTypes(row?.preferred_job_types ?? []);
      setError(null);
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not load your profile."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Resume analysis changes ranking, so the deck has to be rebuilt too. */
  const onResumeChanged = useCallback(async () => {
    await load();
    await reloadDeck(true);
  }, [load, reloadDeck]);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await upsertSeekerProfile(userId, {
        headline: headline.trim() || null,
        bio: profile?.bio ?? null,
        years_experience: profile?.years_experience ?? null,
        min_salary: minSalary ? Number.parseInt(minSalary, 10) : null,
        preferred_job_types: jobTypes,
        preferred_locations: profile?.preferred_locations ?? [],
        industries: profile?.industries ?? [],
      });

      // Preferences feed get_job_feed, so the deck has to be rebuilt.
      await reloadDeck(true);
      showToast("Preferences saved — your deck has been refreshed.", "success");
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not save your changes."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <Page>
      <PageHeader
        title={appUser?.full_name ?? "Your profile"}
        subtitle={appUser?.email}
      />

      {error ? <ErrorNotice message={error} /> : null}

      {userId ? (
        <div className="mb-4">
          <ResumePanel
            userId={userId}
            profile={profile}
            onChanged={onResumeChanged}
          />
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionTitle>Deck preferences</SectionTitle>

        <Field
          label="Headline"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Frontend engineer · React & React Native"
        />

        <p className="mb-2 text-[13px] font-semibold text-white">Work style</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {JOB_TYPES.map((type) => (
            <Chip
              key={type}
              label={JOB_TYPE_LABELS[type]}
              selected={jobTypes.includes(type)}
              onClick={() =>
                setJobTypes((current) =>
                  current.includes(type)
                    ? current.filter((entry) => entry !== type)
                    : [...current, type],
                )
              }
            />
          ))}
        </div>

        <Field
          label="Minimum monthly salary"
          type="number"
          min={0}
          value={minSalary}
          onChange={(event) => setMinSalary(event.target.value)}
          placeholder="6000"
          hint="Leave blank to see everything."
        />

        <Button onClick={() => void save()} loading={saving} full>
          Save preferences
        </Button>
      </Card>

      <Button variant="ghost" onClick={() => void signOut()} full>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </Page>
  );
}
