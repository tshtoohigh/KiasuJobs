import { useCallback, useEffect, useRef, useState } from "react";

import { Page } from "@/components/layout/AppShell";
import {
  Button,
  Card,
  CompanyLogo,
  ErrorNotice,
  Field,
  PageHeader,
  SectionTitle,
  Spinner,
  TextArea,
} from "@/components/ui";
import { describeSupabaseError } from "@/lib/supabase";
import type { EmployerProfile as EmployerProfileRow } from "@/lib/types";
import {
  fetchEmployerProfile,
  setCompanyLogo,
  upsertEmployerProfile,
} from "@/services/profiles";
import { companyLogoUrl, uploadCompanyLogo } from "@/services/storage";
import { useAuth } from "@/stores/useAuth";
import { showToast } from "@/stores/useToast";

export function EmployerProfile() {
  const userId = useAuth((state) => state.session?.user?.id);
  const appUser = useAuth((state) => state.appUser);
  const signOut = useAuth((state) => state.signOut);

  const fileInput = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<EmployerProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const row = await fetchEmployerProfile(userId);
      setProfile(row);
      setCompanyName(row?.company_name ?? "");
      setWebsite(row?.website ?? "");
      setIndustry(row?.industry ?? "");
      setCompanySize(row?.company_size ?? "");
      setDescription(row?.description ?? "");
      setError(null);
    } catch (caught) {
      setError(
        describeSupabaseError(caught, "Could not load your company profile."),
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!userId) return;
    if (!companyName.trim()) {
      setError("Your company name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await upsertEmployerProfile(userId, {
        company_name: companyName,
        website: website.trim() || null,
        industry: industry.trim() || null,
        description: description.trim() || null,
        company_size: companySize.trim() || null,
      });
      await load();
      showToast("Company profile saved.", "success");
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not save your changes."));
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = async (file: File | undefined) => {
    if (!file || !userId) return;
    setError(null);
    setUploading(true);
    try {
      const path = await uploadCompanyLogo(userId, file);
      await setCompanyLogo(userId, path);
      await load();
      showToast("Logo updated.", "success");
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not upload that image."));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <Page>
      <PageHeader
        title={profile?.company_name ?? "Your company"}
        subtitle={appUser?.email}
      />

      {error ? <ErrorNotice message={error} /> : null}

      <Card className="mb-4">
        <SectionTitle>Logo</SectionTitle>
        <div className="flex items-center gap-4">
          <CompanyLogo
            name={profile?.company_name || companyName || "Company"}
            url={companyLogoUrl(profile?.company_logo_path)}
            size={64}
          />
          <div className="flex-1">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void onPickLogo(event.target.files?.[0])}
            />
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              loading={uploading}
            >
              {profile?.company_logo_path ? "Replace" : "Upload"}
            </Button>
            <p className="mt-1.5 text-xs text-muted-dark">
              Shown on every card.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Details</SectionTitle>
        <Field
          label="Company name"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
        />
        <Field
          label="Website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <Field
          label="Industry"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
        />
        <Field
          label="Company size"
          value={companySize}
          onChange={(event) => setCompanySize(event.target.value)}
        />
        <TextArea
          label="What you do"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Button onClick={() => void save()} loading={saving} full>
          Save changes
        </Button>
      </Card>

      <Button variant="ghost" onClick={() => void signOut()} full>
        Sign out
      </Button>
    </Page>
  );
}
