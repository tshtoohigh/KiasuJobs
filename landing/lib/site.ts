/**
 * Canonical origin for the marketing site. Set NEXT_PUBLIC_SITE_URL in the
 * environment (Vercel: Project → Settings → Environment Variables) before
 * going live, otherwise canonical URLs and the sitemap point at the default.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiasujobs.com"
).replace(/\/$/, "");

export const siteName = "KiasuJobs";

export const siteDescription =
  "KiasuJobs turns job hunting into a swipe. See one role at a time, swipe right to apply instantly with your saved resume, and track every application in one place.";
