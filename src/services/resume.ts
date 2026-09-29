import { supabase } from "@/lib/supabase";
import type { ResumeInsights } from "@/lib/types";

/**
 * Turning a resume into match keywords, in three steps:
 *
 *   1. extractResumeText  — get plain text out of the file, in the browser
 *   2. analyseResume      — send that text to the parse-resume Edge Function
 *   3. saveResumeInsights — persist the keywords so get_job_feed can rank on them
 *
 * PDF text extraction happens client-side on purpose: it keeps the file itself
 * out of the function payload, and pdf.js is far better at this than anything
 * available in Deno.
 */

/** Scanned/image-only PDFs yield almost nothing; below this we ask for a paste. */
const MIN_USEFUL_CHARS = 80;

/**
 * pdf.js is ~1 MB, so it's imported lazily — someone who never uploads a resume
 * never downloads it.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Vite resolves this to a real URL at build time; without it pdf.js tries to
  // fetch a worker from a path that doesn't exist in the bundle.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  // 12 pages is far more than any real resume; a guard against pathological files.
  const pageCount = Math.min(pdf.numPages, 12);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) =>
        typeof item === "object" && item && "str" in item
          ? String(item.str)
          : "",
      )
      .join(" ");
    pages.push(text);
  }

  await pdf.destroy();

  return pages
    .join("\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class ResumeTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeTextError";
  }
}

/**
 * Pulls text out of a resume file. Handles PDF and plain text; .doc/.docx are a
 * zipped XML format that isn't worth a parser here, so those are rejected with
 * an explanation rather than silently producing garbage.
 */
export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  let text = "";

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    try {
      text = await extractPdfText(file);
    } catch (error) {
      throw new ResumeTextError(
        `Could not read that PDF (${String(error).slice(0, 80)}). You can paste the text instead.`,
      );
    }
  } else if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    text = (await file.text()).trim();
  } else if (name.endsWith(".doc") || name.endsWith(".docx")) {
    throw new ResumeTextError(
      "Word files can be uploaded but not read automatically. Export as PDF, or paste the text in.",
    );
  } else {
    throw new ResumeTextError(
      "Unsupported file type. Use a PDF or plain text.",
    );
  }

  if (text.length < MIN_USEFUL_CHARS) {
    throw new ResumeTextError(
      "That file had almost no readable text — it is probably a scan or an image. " +
        "Export a text-based PDF, or paste the text in.",
    );
  }

  return text;
}

/**
 * Sends resume text to the Edge Function for keyword extraction.
 *
 * The function tries an AI model first and falls back to dictionary matching,
 * so this resolves with usable keywords whether or not OPENROUTER_API_KEY is
 * configured. `mode` on the result says which path ran.
 */
export async function analyseResume(
  resumeText: string,
): Promise<ResumeInsights> {
  const { data, error } = await supabase.functions.invoke<
    ResumeInsights & { error?: string }
  >("parse-resume", { body: { resumeText } });

  if (error) {
    throw new Error(
      `Resume analysis is unavailable. Deploy the parse-resume function, or skip this step. (${error.message})`,
    );
  }
  if (!data || data.error) {
    throw new Error(data?.error ?? "The resume could not be analysed.");
  }

  return {
    skills: data.skills ?? [],
    titles: data.titles ?? [],
    keywords: data.keywords ?? [],
    seniority: data.seniority ?? null,
    summary: data.summary ?? null,
    mode: data.mode ?? "heuristic",
  };
}

/** Persists the extracted keywords. This is what re-ranks the deck. */
export async function saveResumeInsights(
  userId: string,
  resumeText: string,
  insights: ResumeInsights,
): Promise<void> {
  const { error } = await supabase.from("seeker_profiles").upsert(
    {
      user_id: userId,
      // Stored so the resume can be re-analysed later without a re-upload.
      resume_text: resumeText.slice(0, 40000),
      ai_keywords: insights.keywords,
      ai_skills: insights.skills,
      ai_titles: insights.titles,
      ai_seniority: insights.seniority,
      ai_summary: insights.summary,
      ai_parsed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

/** Clears the AI fields, returning the deck to plain recency ordering. */
export async function clearResumeInsights(userId: string): Promise<void> {
  const { error } = await supabase
    .from("seeker_profiles")
    .update({
      resume_text: null,
      ai_keywords: [],
      ai_skills: [],
      ai_titles: [],
      ai_seniority: null,
      ai_summary: null,
      ai_parsed_at: null,
    })
    .eq("user_id", userId);

  if (error) throw error;
}
