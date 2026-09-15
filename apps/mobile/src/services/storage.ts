import { STORAGE_BUCKETS } from '@kiasujobs/shared';

import { supabase } from '@/lib/supabase';

/**
 * React Native has no `File`, and `Blob` support is patchy, so the reliable
 * way to hand a local file to supabase-js is to read it into an ArrayBuffer.
 */
async function readLocalFile(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read the selected file (${response.status}).`);
  }
  return await response.arrayBuffer();
}

function fileExtension(filename: string, fallback: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match?.[1]?.toLowerCase() ?? fallback;
}

export interface UploadedResume {
  path: string;
  filename: string;
}

/**
 * Uploads a resume into the private bucket under `<uid>/…`, which is the shape
 * the storage policies authorise against.
 *
 * Filenames are timestamped rather than overwritten: `applications` snapshots
 * the path at apply time, and a stable path would let a later upload silently
 * rewrite what an employer already reviewed.
 */
export async function uploadResume(
  userId: string,
  file: { uri: string; name: string; mimeType?: string | null },
): Promise<UploadedResume> {
  const bytes = await readLocalFile(file.uri);
  const extension = fileExtension(file.name, 'pdf');
  const path = `${userId}/${Date.now()}-resume.${extension}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKETS.resumes).upload(path, bytes, {
    contentType: file.mimeType ?? 'application/pdf',
    upsert: false,
  });

  if (error) throw error;
  return { path, filename: file.name };
}

/**
 * Employers can't read the private bucket directly, so the applicant list asks
 * for a short-lived signed URL. This only succeeds when the
 * `resumes_select_applicants_for_owning_employer` policy matches.
 */
export async function createResumeSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.resumes)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not create a link to this resume.');
  return data.signedUrl;
}

export async function uploadCompanyLogo(
  userId: string,
  asset: { uri: string; fileName?: string | null; mimeType?: string | null },
): Promise<string> {
  const bytes = await readLocalFile(asset.uri);
  const extension = fileExtension(asset.fileName ?? 'logo.png', 'png');
  const path = `${userId}/${Date.now()}-logo.${extension}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKETS.companyLogos).upload(path, bytes, {
    contentType: asset.mimeType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`,
    upsert: false,
  });

  if (error) throw error;
  return path;
}

/** `company-logos` is a public bucket, so this needs no round trip. */
export function companyLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(STORAGE_BUCKETS.companyLogos).getPublicUrl(path);
  return data.publicUrl ?? null;
}
