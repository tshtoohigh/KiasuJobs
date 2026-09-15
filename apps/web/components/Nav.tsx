export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#top" className="text-xl font-extrabold tracking-tight text-brand-500">
          KiasuJobs
        </a>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          <a href="#how-it-works" className="text-sm font-medium text-ink-500 hover:text-ink-900">
            How it works
          </a>
          <a href="#for-seekers" className="text-sm font-medium text-ink-500 hover:text-ink-900">
            For job seekers
          </a>
          <a href="#for-employers" className="text-sm font-medium text-ink-500 hover:text-ink-900">
            For employers
          </a>
          <a href="#faq" className="text-sm font-medium text-ink-500 hover:text-ink-900">
            FAQ
          </a>
        </nav>

        <a
          href="#download"
          className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
        >
          Get the app
        </a>
      </div>
    </header>
  );
}
