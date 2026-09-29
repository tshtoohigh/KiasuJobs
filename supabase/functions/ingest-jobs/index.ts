// Supabase Edge Function: /ingest-jobs
//
// Pulls real job openings from public job APIs and upserts them into
// job_postings. Designed to be run on a schedule (see supabase/cron.sql).
//
// Deploy:  supabase functions deploy ingest-jobs --no-verify-jwt
// Secrets: supabase secrets set INGEST_SECRET=pick-a-long-random-string
//          supabase secrets set ADZUNA_APP_ID=...    (optional)
//          supabase secrets set ADZUNA_APP_KEY=...   (optional)
//
// Why these sources: they publish APIs intended for third-party use. Scraping
// LinkedIn or Indeed is against their terms, actively blocked, and would break
// constantly — so it is deliberately not done here.
//
//   remotive   — no key, remote roles
//   arbeitnow  — no key, global incl. visa-sponsored
//   jobicy     — no key, remote with region filters
//   adzuna     — free key, real Singapore listings
//
// Writes with the service_role key, so RLS is bypassed. Authorisation is the
// INGEST_SECRET header (or a service_role bearer token) — see `authorise`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

/** Per-source cap, so one run can't blow up the table or the function timeout. */
const PER_SOURCE_LIMIT = 40;

type JobType = "remote" | "hybrid" | "onsite";
type EmploymentType = "full_time" | "part_time" | "contract" | "internship";

interface NormalisedJob {
  source: string;
  external_id: string;
  external_url: string;
  title: string;
  description: string;
  requirements: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  location: string;
  job_type: JobType;
  employment_type: EmploymentType;
  industry: string | null;
  company_name: string;
  company_logo_url: string | null;
  status: "published";
  published_at: string;
}

// ---------------------------------------------------------------------------
// Text helpers — these APIs return HTML of wildly varying quality
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&hellip;": "…",
};

function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return (
    input
      // Keep paragraph and list breaks as newlines before dropping tags.
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
      .replace(
        /&[a-z#0-9]+;/gi,
        (match) => ENTITIES[match.toLowerCase()] ?? " ",
      )
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Pulls bullet-shaped lines out of a description to use as requirements.
 * Good enough to give a card something to show; not trying to be clever.
 */
function extractRequirements(description: string): string[] {
  const lines = description
    .split("\n")
    .map((line) => line.replace(/^[•\-*\u2022\s]+/, "").trim())
    .filter((line) => line.length >= 12 && line.length <= 140);

  const bulletish = description
    .split("\n")
    .filter((line) => /^\s*[•\-*\u2022]/.test(line)).length;

  // Only trust this when the description actually looked like a bullet list.
  return bulletish >= 3 ? lines.slice(0, 6) : [];
}

function inferJobType(haystack: string, fallback: JobType): JobType {
  const text = haystack.toLowerCase();
  if (/\bremote\b|work from home|wfh|distributed/.test(text)) return "remote";
  if (/\bhybrid\b/.test(text)) return "hybrid";
  return fallback;
}

function inferEmploymentType(haystack: string): EmploymentType {
  const text = haystack.toLowerCase();
  if (/\bintern(ship)?\b/.test(text)) return "internship";
  if (/\bpart[\s-]?time\b/.test(text)) return "part_time";
  if (/\bcontract\b|\bfreelance\b|\btemporary\b/.test(text)) return "contract";
  return "full_time";
}

/**
 * Sources disagree on salary units: Adzuna and Jobicy quote annual figures,
 * while this app displays monthly. Convert rather than show a number that is
 * 12x wrong.
 */
function annualToMonthly(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value / 12);
}

function sane(value: unknown): number | null {
  const n =
    typeof value === "string" ? Number.parseFloat(value) : (value as number);
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function isoDate(value: unknown): string {
  const parsed = value ? new Date(String(value)) : new Date();
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "KiasuJobs/1.0 (job aggregator)",
      },
    });
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Adapters — one per provider
// ---------------------------------------------------------------------------

async function fetchRemotive(): Promise<NormalisedJob[]> {
  const payload = (await fetchJson(
    `https://remotive.com/api/remote-jobs?limit=${PER_SOURCE_LIMIT}`,
  )) as { jobs?: Record<string, unknown>[] };

  return (payload.jobs ?? []).slice(0, PER_SOURCE_LIMIT).map((raw) => {
    const description = stripHtml(String(raw.description ?? ""));
    return {
      source: "remotive",
      external_id: String(raw.id),
      external_url: String(raw.url ?? ""),
      title: truncate(String(raw.title ?? "Untitled role"), 200),
      description: truncate(description || "No description provided.", 20000),
      requirements: extractRequirements(description),
      // Remotive's `salary` is free text ("$50k - $70k"), too unreliable to parse.
      salary_min: null,
      salary_max: null,
      salary_currency: "USD",
      location: truncate(
        String(raw.candidate_required_location ?? "Remote"),
        120,
      ),
      job_type: "remote",
      employment_type: inferEmploymentType(String(raw.job_type ?? "")),
      industry: raw.category ? truncate(String(raw.category), 60) : null,
      company_name: truncate(
        String(raw.company_name ?? "Unknown company"),
        120,
      ),
      company_logo_url: raw.company_logo ? String(raw.company_logo) : null,
      status: "published",
      published_at: isoDate(raw.publication_date),
    };
  });
}

async function fetchArbeitnow(): Promise<NormalisedJob[]> {
  const payload = (await fetchJson(
    "https://www.arbeitnow.com/api/job-board-api",
  )) as {
    data?: Record<string, unknown>[];
  };

  return (payload.data ?? []).slice(0, PER_SOURCE_LIMIT).map((raw) => {
    const description = stripHtml(String(raw.description ?? ""));
    const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
    const jobTypes = Array.isArray(raw.job_types)
      ? raw.job_types.map(String)
      : [];
    const isRemote = raw.remote === true;

    return {
      source: "arbeitnow",
      external_id: String(raw.slug),
      external_url: String(raw.url ?? ""),
      title: truncate(String(raw.title ?? "Untitled role"), 200),
      description: truncate(description || "No description provided.", 20000),
      requirements: extractRequirements(description),
      salary_min: null,
      salary_max: null,
      salary_currency: "EUR",
      location: truncate(String(raw.location ?? "Unspecified"), 120),
      job_type: isRemote
        ? "remote"
        : inferJobType(String(raw.title ?? ""), "onsite"),
      employment_type: inferEmploymentType(
        jobTypes.join(" ") || String(raw.title ?? ""),
      ),
      industry: tags[0] ? truncate(tags[0], 60) : null,
      company_name: truncate(
        String(raw.company_name ?? "Unknown company"),
        120,
      ),
      company_logo_url: null,
      status: "published",
      published_at: isoDate(
        typeof raw.created_at === "number"
          ? raw.created_at * 1000
          : raw.created_at,
      ),
    };
  });
}

async function fetchJobicy(): Promise<NormalisedJob[]> {
  const payload = (await fetchJson(
    `https://jobicy.com/api/v2/remote-jobs?count=${PER_SOURCE_LIMIT}`,
  )) as { jobs?: Record<string, unknown>[] };

  return (payload.jobs ?? []).slice(0, PER_SOURCE_LIMIT).map((raw) => {
    const description = stripHtml(
      String(raw.jobDescription ?? raw.jobExcerpt ?? ""),
    );
    const industries = Array.isArray(raw.jobIndustry)
      ? raw.jobIndustry.map(String)
      : [];
    const types = Array.isArray(raw.jobType) ? raw.jobType.map(String) : [];

    return {
      source: "jobicy",
      external_id: String(raw.id),
      external_url: String(raw.url ?? ""),
      title: truncate(String(raw.jobTitle ?? "Untitled role"), 200),
      description: truncate(description || "No description provided.", 20000),
      requirements: extractRequirements(description),
      // Jobicy quotes annual salaries.
      salary_min: annualToMonthly(sane(raw.annualSalaryMin)),
      salary_max: annualToMonthly(sane(raw.annualSalaryMax)),
      salary_currency:
        String(raw.salaryCurrency ?? "USD")
          .slice(0, 3)
          .toUpperCase() || "USD",
      location: truncate(String(raw.jobGeo ?? "Remote"), 120),
      job_type: "remote",
      employment_type: inferEmploymentType(types.join(" ")),
      industry: industries[0] ? truncate(industries[0], 60) : null,
      company_name: truncate(String(raw.companyName ?? "Unknown company"), 120),
      company_logo_url: raw.companyLogo ? String(raw.companyLogo) : null,
      status: "published",
      published_at: isoDate(raw.pubDate),
    };
  });
}

/**
 * Adzuna is the one that gets you actual Singapore listings. Needs a free
 * app id/key from developer.adzuna.com; skipped silently when unset.
 */
async function fetchAdzuna(country = "sg"): Promise<NormalisedJob[]> {
  const appId = Deno.env.get("ADZUNA_APP_ID");
  const appKey = Deno.env.get("ADZUNA_APP_KEY");
  if (!appId || !appKey) return [];

  const url =
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
    `?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}` +
    `&results_per_page=${PER_SOURCE_LIMIT}&content-type=application/json`;

  const payload = (await fetchJson(url)) as {
    results?: Record<string, unknown>[];
  };

  return (payload.results ?? []).slice(0, PER_SOURCE_LIMIT).map((raw) => {
    const description = stripHtml(String(raw.description ?? ""));
    const company = (raw.company ?? {}) as { display_name?: string };
    const location = (raw.location ?? {}) as { display_name?: string };
    const category = (raw.category ?? {}) as { label?: string };
    const title = String(raw.title ?? "Untitled role");

    return {
      source: "adzuna",
      external_id: String(raw.id),
      external_url: String(raw.redirect_url ?? ""),
      title: truncate(stripHtml(title), 200),
      description: truncate(description || "No description provided.", 20000),
      requirements: extractRequirements(description),
      // Adzuna quotes annual salaries.
      salary_min: annualToMonthly(sane(raw.salary_min)),
      salary_max: annualToMonthly(sane(raw.salary_max)),
      salary_currency: country.toLowerCase() === "sg" ? "SGD" : "USD",
      location: truncate(location.display_name ?? "Singapore", 120),
      job_type: inferJobType(`${title} ${description.slice(0, 400)}`, "onsite"),
      employment_type: inferEmploymentType(
        `${title} ${description.slice(0, 400)}`,
      ),
      industry: category.label ? truncate(category.label, 60) : null,
      company_name: truncate(company.display_name ?? "Unknown company", 120),
      company_logo_url: null,
      status: "published",
      published_at: isoDate(raw.created),
    };
  });
}

// ---------------------------------------------------------------------------
// Authorisation
// ---------------------------------------------------------------------------

function authorise(req: Request): boolean {
  const secret = Deno.env.get("INGEST_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const header = req.headers.get("x-ingest-secret");
  if (secret && header === secret) return true;

  const auth = req.headers.get("Authorization") ?? "";
  if (serviceKey && auth === `Bearer ${serviceKey}`) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (!authorise(req)) {
    return json(
      {
        error:
          "Unauthorised. Send x-ingest-secret (matching the INGEST_SECRET secret) " +
          "or an Authorization: Bearer <service_role key> header.",
      },
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(
      {
        error: "Function is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.",
      },
      500,
    );
  }

  // service_role bypasses RLS, which is what lets us write ownerless postings.
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adapters: { name: string; run: () => Promise<NormalisedJob[]> }[] = [
    { name: "remotive", run: fetchRemotive },
    { name: "arbeitnow", run: fetchArbeitnow },
    { name: "jobicy", run: fetchJobicy },
    {
      name: "adzuna",
      run: () => fetchAdzuna(Deno.env.get("ADZUNA_COUNTRY") ?? "sg"),
    },
  ];

  const report: Record<
    string,
    { fetched: number; written: number; error?: string }
  > = {};

  // Sequential on purpose: one slow provider shouldn't be able to starve the
  // others of the function's time budget, and the order is meaningful.
  for (const adapter of adapters) {
    try {
      const jobs = (await adapter.run()).filter(
        (job) => job.external_id && job.external_url && job.title,
      );

      if (jobs.length === 0) {
        report[adapter.name] = { fetched: 0, written: 0 };
        continue;
      }

      // `updated_at` moves on every run, which is what close_stale_external_jobs
      // uses to tell a live listing from a dead one.
      const rows = jobs.map((job) => ({
        ...job,
        employer_id: null,
        updated_at: new Date().toISOString(),
      }));

      const { error, count } = await supabase
        .from("job_postings")
        .upsert(rows, { onConflict: "source,external_id", count: "exact" });

      report[adapter.name] = {
        fetched: jobs.length,
        written: error ? 0 : (count ?? jobs.length),
        ...(error ? { error: error.message } : {}),
      };
    } catch (err) {
      report[adapter.name] = {
        fetched: 0,
        written: 0,
        error: String(err).slice(0, 200),
      };
    }
  }

  // Retire listings we haven't seen in a while.
  let closed = 0;
  try {
    const { data } = await supabase.rpc("close_stale_external_jobs");
    closed = typeof data === "number" ? data : 0;
  } catch {
    // Non-fatal — ingestion still succeeded.
  }

  const written = Object.values(report).reduce(
    (sum, entry) => sum + entry.written,
    0,
  );

  return json({
    ok: true,
    ran_at: new Date().toISOString(),
    total_written: written,
    closed_stale: closed,
    sources: report,
    note: Deno.env.get("ADZUNA_APP_ID")
      ? undefined
      : "Adzuna skipped — set ADZUNA_APP_ID and ADZUNA_APP_KEY for Singapore listings.",
  });
});
