import { useRef, useState } from "react";

import {
  Button,
  CompanyLogo,
  ErrorNotice,
  Field,
  SectionTitle,
  TextArea,
} from "@/components/ui";
import { describeSupabaseError } from "@/lib/supabase";
import { setCompanyLogo, upsertEmployerProfile } from "@/services/profiles";
import { companyLogoUrl, uploadCompanyLogo } from "@/services/storage";
import { useAuth } from "@/stores/useAuth";

export function OnboardEmployer() {
  const userId = useAuth((state) => state.session?.user?.id);
  const finishOnboarding = useAuth((state) => state.finishOnboarding);
  const signOut = useAuth((state) => state.signOut);

  const fileInput = useRef<HTMLInputElement | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [description, setDescription] = useState("");

  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveProfile = async () => {
    if (!userId) throw new Error("Not signed in.");
    return upsertEmployerProfile(userId, {
      company_name: companyName,
      website: website.trim() || null,
      industry: industry.trim() || null,
      description: description.trim() || null,
      company_size: companySize.trim() || null,
    });
  };

  /** The logo needs an employer_profiles row to attach to, so save first. */
  const onPickLogo = async (file: File | undefined) => {
    if (!file || !userId) return;
    if (!companyName.trim()) {
      setError("Add your company name before uploading a logo.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      await saveProfile();
      const path = await uploadCompanyLogo(userId, file);
      await setCompanyLogo(userId, path);
      setLogoPath(path);
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not upload that image."));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!userId) return;
    if (!companyName.trim()) {
      setError("Your company name is required.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await saveProfile();
      await finishOnboarding();
    } catch (caught) {
      setError(
        describeSupabaseError(caught, "Could not save your company profile."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto h-full max-w-md overflow-y-auto p-6">
      <h1 className="text-2xl font-extrabold text-white">
        Tell us about your company
      </h1>
      <p className="mt-2 leading-relaxed text-muted">
        Your name and logo appear on every card a candidate swipes, so this is
        worth getting right.
      </p>

      <div className="mt-6">
        {error ? <ErrorNotice message={error} /> : null}
      </div>

      <div className="mb-6 flex items-center gap-4">
        <CompanyLogo
          name={companyName || "Your company"}
          url={companyLogoUrl(logoPath)}
          size={72}
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
            {logoPath ? "Replace logo" : "Upload logo"}
          </Button>
          <p className="mt-1.5 text-xs text-muted-dark">
            Square PNG or JPG, up to 2 MB.
          </p>
        </div>
      </div>

      <section className="mb-4">
        <SectionTitle>Company</SectionTitle>
        <Field
          label="Company name"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="Kopi Tech"
        />
        <Field
          label="Website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="https://kopitech.com"
        />
        <Field
          label="Industry"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder="Software"
        />
        <Field
          label="Company size"
          value={companySize}
          onChange={(event) => setCompanySize(event.target.value)}
          placeholder="11-50"
        />
        <TextArea
          label="What you do"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="One or two sentences candidates will actually read."
        />
      </section>

      <div className="flex flex-col gap-2 pb-6">
        <Button onClick={() => void submit()} loading={busy} full>
          Post your first job
        </Button>
        <Button variant="ghost" onClick={() => void signOut()} full>
          Sign out
        </Button>
      </div>
    </div>
  );
}
