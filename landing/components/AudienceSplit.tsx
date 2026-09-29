import { StoreBadges } from "./StoreBadges";

/**
 * The two audiences get their own section and their own call to action, because
 * "post a job" and "find a job" are completely different intents.
 */
export function AudienceSplit() {
  return (
    <div className="bg-brand-50/60">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-6 lg:grid-cols-2">
          <SeekerPanel />
          <EmployerPanel />
        </div>
      </div>
    </div>
  );
}

function SeekerPanel() {
  return (
    <section
      id="for-seekers"
      className="flex flex-col rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5"
    >
      <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
        For job seekers
      </span>

      <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-ink-900">
        I&apos;m looking for a job
      </h2>
      <p className="mt-3 leading-relaxed text-ink-500">
        Stop rewriting the same details into a different form every time. Set
        your profile up once, then apply with your thumb.
      </p>

      <ul className="mt-6 space-y-3">
        <Benefit>Apply in one swipe — resume attached automatically</Benefit>
        <Benefit>
          Only see roles that match your salary and location floor
        </Benefit>
        <Benefit>Skipped jobs stay skipped, permanently</Benefit>
        <Benefit>See when an employer actually opens your application</Benefit>
      </ul>

      <div className="mt-8 pt-2">
        <StoreBadges />
      </div>
    </section>
  );
}

function EmployerPanel() {
  return (
    <section
      id="for-employers"
      className="flex flex-col rounded-3xl bg-ink-900 p-8 text-white shadow-sm"
    >
      <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-400">
        For employers
      </span>

      <h2 className="mt-5 text-3xl font-extrabold tracking-tight">
        I&apos;m hiring
      </h2>
      <p className="mt-3 leading-relaxed text-white/70">
        Post a role and it lands in matching candidates&apos; decks immediately.
        Applicants arrive with a resume already attached — nothing to chase.
      </p>

      <ul className="mt-6 space-y-3">
        <Benefit dark>Post a role in under two minutes</Benefit>
        <Benefit dark>Live applicant notifications as candidates swipe</Benefit>
        <Benefit dark>Shortlist or pass with one tap</Benefit>
        <Benefit dark>
          Resumes are private — only you see your applicants
        </Benefit>
      </ul>

      <div className="mt-8 flex flex-wrap gap-3 pt-2">
        <a
          href="#download"
          className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-ink-900 transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
        >
          Start hiring
        </a>
        <a
          href="mailto:hello@kiasujobs.com"
          className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Talk to us
        </a>
      </div>
    </section>
  );
}

function Benefit({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          dark ? "bg-white/15 text-white" : "bg-apply-500/10 text-apply-500"
        }`}
      >
        ✓
      </span>
      <span
        className={`leading-relaxed ${dark ? "text-white/80" : "text-ink-700"}`}
      >
        {children}
      </span>
    </li>
  );
}
