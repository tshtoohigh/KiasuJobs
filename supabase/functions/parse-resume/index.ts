// Supabase Edge Function: /parse-resume
//
// Reads resume text and returns the skills, job titles and keywords to match
// jobs against. Same shape as the RS Finance /chat function: the OpenRouter key
// stays server-side and never reaches the browser.
//
// Deploy: supabase functions deploy parse-resume
// Secret: supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
//
// Works without an API key. With no OPENROUTER_API_KEY set it falls back to
// dictionary matching, which is less nuanced but instant, free and good enough
// to rank a job feed — so resume matching is never hard-blocked on billing.
//
// Client sends: { resumeText: string }
// Returns:      { skills, titles, keywords, seniority, summary, mode }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free models on OpenRouter, tried in order until one responds.
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Resumes are long; this is plenty of context and keeps us inside free limits. */
const MAX_RESUME_CHARS = 12000;

interface ParsedResume {
  skills: string[];
  titles: string[];
  keywords: string[];
  seniority: string | null;
  summary: string | null;
  mode: "ai" | "heuristic";
}

// ---------------------------------------------------------------------------
// Heuristic extraction — the no-API-key path
// ---------------------------------------------------------------------------

/** Terms worth matching a job description against. */
const SKILL_DICTIONARY = [
  // languages
  "javascript",
  "typescript",
  "python",
  "java",
  "kotlin",
  "swift",
  "go",
  "golang",
  "rust",
  "ruby",
  "php",
  "c++",
  "c#",
  "scala",
  "elixir",
  "dart",
  "r",
  "matlab",
  "solidity",
  // frontend
  "react",
  "react native",
  "next.js",
  "nextjs",
  "vue",
  "nuxt",
  "angular",
  "svelte",
  "tailwind",
  "css",
  "html",
  "sass",
  "redux",
  "zustand",
  "webpack",
  "vite",
  "accessibility",
  "responsive design",
  "figma",
  "storybook",
  // backend / data
  "node.js",
  "nodejs",
  "express",
  "nestjs",
  "django",
  "flask",
  "fastapi",
  "rails",
  "spring",
  "spring boot",
  "laravel",
  ".net",
  "graphql",
  "rest api",
  "grpc",
  "postgresql",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "elasticsearch",
  "sqlite",
  "supabase",
  "firebase",
  "prisma",
  "sql",
  "nosql",
  "dbt",
  "airflow",
  "spark",
  "kafka",
  "rabbitmq",
  "snowflake",
  "bigquery",
  "etl",
  "data pipeline",
  "data warehouse",
  // cloud / devops
  "aws",
  "azure",
  "gcp",
  "google cloud",
  "docker",
  "kubernetes",
  "terraform",
  "ansible",
  "jenkins",
  "github actions",
  "gitlab ci",
  "ci/cd",
  "linux",
  "nginx",
  "observability",
  "prometheus",
  "grafana",
  "datadog",
  "sre",
  "devops",
  // mobile
  "ios",
  "android",
  "flutter",
  "expo",
  "swiftui",
  "jetpack compose",
  // ai / ml
  "machine learning",
  "deep learning",
  "pytorch",
  "tensorflow",
  "scikit-learn",
  "nlp",
  "computer vision",
  "llm",
  "langchain",
  "pandas",
  "numpy",
  // design
  "ui design",
  "ux design",
  "user research",
  "wireframing",
  "prototyping",
  "design system",
  "interaction design",
  "usability testing",
  "adobe xd",
  "sketch",
  // product / business
  "product management",
  "roadmap",
  "stakeholder management",
  "agile",
  "scrum",
  "kanban",
  "jira",
  "okrs",
  "a/b testing",
  "analytics",
  "sql reporting",
  "project management",
  "business analysis",
  "requirements gathering",
  // finance / ops
  "accounting",
  "financial modelling",
  "financial modeling",
  "forecasting",
  "budgeting",
  "audit",
  "tax",
  "payroll",
  "excel",
  "power bi",
  "tableau",
  "supply chain",
  "logistics",
  "procurement",
  "inventory management",
  // marketing / sales
  "seo",
  "sem",
  "content marketing",
  "copywriting",
  "social media",
  "crm",
  "salesforce",
  "hubspot",
  "lead generation",
  "email marketing",
  "brand strategy",
  // soft / general
  "team leadership",
  "mentoring",
  "stakeholder communication",
  "public speaking",
  "customer support",
  "technical writing",
  "documentation",
];

const TITLE_PATTERNS = [
  "software engineer",
  "senior software engineer",
  "frontend engineer",
  "front-end engineer",
  "backend engineer",
  "back-end engineer",
  "full stack engineer",
  "fullstack engineer",
  "mobile engineer",
  "react native developer",
  "ios developer",
  "android developer",
  "data engineer",
  "data scientist",
  "data analyst",
  "analytics engineer",
  "machine learning engineer",
  "ml engineer",
  "ai engineer",
  "devops engineer",
  "site reliability engineer",
  "platform engineer",
  "cloud engineer",
  "security engineer",
  "qa engineer",
  "test engineer",
  "embedded engineer",
  "product manager",
  "product owner",
  "project manager",
  "program manager",
  "product designer",
  "ux designer",
  "ui designer",
  "ux researcher",
  "graphic designer",
  "business analyst",
  "financial analyst",
  "accountant",
  "auditor",
  "controller",
  "marketing manager",
  "digital marketer",
  "content writer",
  "copywriter",
  "sales executive",
  "account manager",
  "customer success manager",
  "operations manager",
  "supply chain analyst",
  "logistics coordinator",
  "engineering manager",
  "technical lead",
  "tech lead",
  "architect",
  "consultant",
  "teacher",
  "lecturer",
  "nurse",
  "administrator",
  "human resources",
  "recruiter",
];

function detectSeniority(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(head of|vp of|vice president|director|chief)\b/.test(lower))
    return "leadership";
  if (/\b(principal|staff engineer|architect)\b/.test(lower))
    return "principal";
  if (/\b(lead|manager|managed a team|team lead)\b/.test(lower)) return "lead";
  if (/\b(senior|sr\.)\b/.test(lower)) return "senior";
  if (/\b(junior|jr\.|graduate|intern|entry[- ]level|fresh grad)\b/.test(lower))
    return "junior";

  // Fall back to years of experience if it's stated.
  const years = lower.match(/(\d{1,2})\+?\s*years?\s+(of\s+)?experience/);
  if (years?.[1]) {
    const n = Number.parseInt(years[1], 10);
    if (n >= 8) return "senior";
    if (n >= 4) return "mid";
    return "junior";
  }
  return null;
}

function heuristicParse(resumeText: string): ParsedResume {
  const lower = resumeText.toLowerCase();

  const skills = SKILL_DICTIONARY.filter((term) => {
    // Word-boundary match so "r" doesn't match every word containing r, and
    // "go" doesn't match "going".
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9+#.])${escaped}($|[^a-z0-9+#.])`, "i").test(
      lower,
    );
  });

  const titles = TITLE_PATTERNS.filter((title) => lower.includes(title));

  // Keywords = skills plus the distinctive words from any matched titles.
  const titleWords = titles
    .flatMap((title) => title.split(/\s+/))
    .filter(
      (word) => word.length > 3 && !["engineer", "manager"].includes(word),
    );

  const keywords = Array.from(new Set([...skills, ...titles, ...titleWords]));

  return {
    skills: skills.slice(0, 40),
    titles: titles.slice(0, 10),
    keywords: keywords.slice(0, 60),
    seniority: detectSeniority(resumeText),
    summary: null,
    mode: "heuristic",
  };
}

// ---------------------------------------------------------------------------
// AI extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract structured data from resumes for a job-matching app.

Return ONLY a JSON object, no prose and no markdown fences, in exactly this shape:
{
  "skills": ["string"],
  "titles": ["string"],
  "keywords": ["string"],
  "seniority": "junior" | "mid" | "senior" | "lead" | "principal" | "leadership",
  "summary": "string"
}

Rules:
- "skills": concrete, matchable skills and technologies the person actually has. Lowercase. Max 30.
- "titles": job titles they could plausibly be hired for next, lowercase. Max 8.
- "keywords": everything useful for keyword-matching a job description — skills,
  titles, domains, industries, tools. Lowercase, single words or short phrases. Max 50.
- "seniority": one value from the list, inferred from years and scope of work.
- "summary": one sentence, max 160 characters, describing the candidate.
- Never invent skills that are not evidenced in the resume.`;

/** Models sometimes wrap JSON in prose or fences; dig it out either way. */
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start)
    throw new Error("No JSON object found");
  return JSON.parse(candidate.slice(start, end + 1));
}

function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 1 && entry.length <= 60),
    ),
  ).slice(0, max);
}

async function aiParse(
  resumeText: string,
  apiKey: string,
): Promise<ParsedResume | null> {
  for (const model of MODELS) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://kiasujobs.app",
          "X-Title": "KiasuJobs",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: resumeText.slice(0, MAX_RESUME_CHARS) },
          ],
          max_tokens: 900,
          // Low temperature: this is extraction, not writing.
          temperature: 0.1,
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) continue;

      const parsed = extractJson(content) as Record<string, unknown>;

      const skills = cleanList(parsed.skills, 30);
      const titles = cleanList(parsed.titles, 8);
      const keywords = cleanList(parsed.keywords, 50);

      // A response with nothing matchable in it is worse than the heuristic.
      if (skills.length === 0 && keywords.length === 0) continue;

      const seniority =
        typeof parsed.seniority === "string"
          ? parsed.seniority.toLowerCase()
          : null;
      const summary =
        typeof parsed.summary === "string"
          ? parsed.summary.trim().slice(0, 200)
          : null;

      return {
        skills,
        titles,
        keywords:
          keywords.length > 0
            ? keywords
            : Array.from(new Set([...skills, ...titles])),
        seniority,
        summary,
        mode: "ai",
      };
    } catch {
      // Try the next model.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Must be signed in — this reads someone's resume.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const resumeText =
      typeof body.resumeText === "string" ? body.resumeText : "";

    if (resumeText.trim().length < 80) {
      return json(
        {
          error:
            "That resume had almost no readable text. If it is a scanned image, " +
            "export a text-based PDF or paste the text in manually.",
        },
        400,
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");

    // Try AI first, fall back to the dictionary. Either way the caller gets
    // something usable, and `mode` says which path ran.
    const result =
      (apiKey ? await aiParse(resumeText, apiKey) : null) ??
      heuristicParse(resumeText);

    return json(result);
  } catch (err) {
    return json(
      { error: `Could not read that resume: ${String(err).slice(0, 160)}` },
      500,
    );
  }
});
