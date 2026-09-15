import { STORAGE_BUCKETS } from "@/lib/types";
import { supabase } from "@/lib/supabase";

/**
 * Uploads go straight from an <input type="file"> — the browser gives us a
 * real `File`, which supabase-js accepts as-is. (The React Native version of
 * this app had to read files into an ArrayBuffer first.)
 *
 * Object paths are always `<user_id>/<filename>`, which is the shape the
 * storage policies in schema.sql authorise against.
 */

function fileExtension(filename: string, fallback: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match?.[1]?.toLowerCase() ?? fallback;
}

export interface UploadedResume {
  path: string;
  filename: string;
}

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Filenames are timestamped rather than overwritten: `applications` snapshots
 * the resume path at apply time, and a stable path would let a later upload
 * silently rewrite what an employer already reviewed.
 */
export async function uploadResume(
  userId: string,
  file: File,
): Promise<UploadedResume> {
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error(
      "That file is over 5 MB. Try compressing or exporting it again.",
    );
  }

  const path = `${userId}/${Date.now()}-resume.${fileExtension(file.name, "pdf")}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.resumes)
    .upload(path, file, {
      contentType: file.type || "application/pdf",
      upsert: false,
    });

  if (error) throw error;
  return { path, filename: file.name };
}

/**
 * Employers can't read the private bucket directly, so the applicant list asks
 * for a short-lived signed URL. This only succeeds when the
 * `resumes_select_applicants_for_owning_employer` policy matches — i.e. that
 * candidate actually applied to one of their postings.
 */
export async function createResumeSignedUrl(
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.resumes)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl)
    throw new Error("Could not create a link to this resume.");
  return data.signedUrl;
}

export async function uploadCompanyLogo(
  userId: string,
  file: File,
): Promise<string> {
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("That image is over 2 MB. Try a smaller one.");
  }

  const path = `${userId}/${Date.now()}-logo.${fileExtension(file.name, "png")}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.companyLogos)
    .upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (error) throw error;
  return path;
}

/** `company-logos` is a public bucket, so this needs no round trip. */
export function companyLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage
    .from(STORAGE_BUCKETS.companyLogos)
    .getPublicUrl(path);
  return data.publicUrl ?? null;
}
