/**
 * Shown when `src/lib/supabase.ts` still has the placeholder credentials.
 * Without this the app would just throw a network error on every screen, which
 * is a much worse first-run experience than being told what to do.
 */
export function SetupNotice() {
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-accent">KiasuJobs</h1>
        <p className="mt-1 text-muted">
          Two minutes of setup and you're swiping.
        </p>
      </div>

      <div className="rounded-2xl border border-amber/40 bg-amber-dim p-5">
        <p className="font-semibold text-amber">
          Supabase isn't connected yet.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-white/80">
          The app needs a database before it can show any jobs.
        </p>
      </div>

      <ol className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <Step n={1}>
          Create a free project at{" "}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent underline"
          >
            supabase.com/dashboard
          </a>
        </Step>
        <Step n={2}>
          In your project, open <Code>SQL Editor</Code> and run the contents of{" "}
          <Code>supabase/schema.sql</Code>, then <Code>supabase/seed.sql</Code>{" "}
          for demo jobs.
        </Step>
        <Step n={3}>
          Go to <Code>Settings → API</Code> and copy your{" "}
          <Code>Project URL</Code> and <Code>anon public</Code> key.
        </Step>
        <Step n={4}>
          Paste both into <Code>src/lib/supabase.ts</Code> at the top, replacing
          the placeholders.
        </Step>
        <Step n={5}>Save. Vite hot-reloads and this screen disappears.</Step>
      </ol>

      <p className="text-xs leading-relaxed text-muted-dark">
        The anon key is meant to live in client code — every table is protected
        by Row Level Security. Never paste the <Code>service_role</Code> key
        here.
      </p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dim text-xs font-bold text-accent">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-white">
      {children}
    </code>
  );
}
