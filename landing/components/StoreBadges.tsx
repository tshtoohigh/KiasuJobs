/**
 * Store badges drawn in markup rather than shipped as images — no binary
 * assets to manage, and they stay crisp at any size. Swap in the official
 * Apple/Google artwork before you actually launch; both have brand guidelines
 * that require their supplied assets.
 */
export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <StoreBadge
        href="#download"
        eyebrow="Download on the"
        name="App Store"
        glyph={<AppleGlyph />}
      />
      <StoreBadge
        href="#download"
        eyebrow="Get it on"
        name="Google Play"
        glyph={<PlayGlyph />}
      />
    </div>
  );
}

function StoreBadge({
  href,
  eyebrow,
  name,
  glyph,
}: {
  href: string;
  eyebrow: string;
  name: string;
  glyph: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl bg-ink-900 px-5 py-3 text-white transition hover:bg-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
      aria-label={`${eyebrow} ${name}`}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-white/70">
          {eyebrow}
        </span>
        <span className="text-base font-semibold">{name}</span>
      </span>
    </a>
  );
}

function AppleGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      role="presentation"
    >
      <path d="M16.36 12.9c.02 2.7 2.37 3.6 2.4 3.61-.02.06-.38 1.3-1.25 2.57-.75 1.1-1.53 2.19-2.76 2.21-1.2.03-1.6-.71-2.98-.71-1.38 0-1.8.69-2.94.73-1.19.05-2.09-1.18-2.85-2.27-1.66-2.4-2.93-6.79-1.22-9.75.85-1.47 2.36-2.4 4-2.43 1.16-.02 2.25.78 2.96.78.7 0 2.03-.96 3.42-.82.58.02 2.22.21 3.27 1.59-.09.05-1.95 1.14-1.93 3.4M14.13 4.6c.63-.76 1.05-1.82.93-2.87-.93.04-2.05.62-2.7 1.38-.59.67-1.1 1.75-.96 2.78 1.03.08 2.09-.53 2.73-1.29" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      role="presentation"
    >
      <path d="M3.6 1.8a1.9 1.9 0 0 0-.5 1.3v17.8c0 .5.2 1 .5 1.3l9.3-10.2zm10.7 9l2.7-2.9-9.9-5.6zm0 2.4-7.2 8.5 9.9-5.6zm5-4.3-2.4 1.3 2.4 2.7c.6-.4 1.1-1 1.1-1.9s-.5-1.6-1.1-2.1" />
    </svg>
  );
}
