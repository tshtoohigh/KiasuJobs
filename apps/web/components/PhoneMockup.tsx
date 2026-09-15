import { formatLocation, formatSalaryRange } from '@kiasujobs/shared';

/**
 * Static preview of the deck. The salary and location strings come from
 * @kiasujobs/shared, the same helpers the app uses, so the marketing preview
 * can't drift from the real formatting.
 */
export function PhoneMockup() {
  const salary = formatSalaryRange(8000, 11000, 'SGD');
  const location = formatLocation('Tanjong Pagar, Singapore', 'hybrid');

  return (
    <div className="relative mx-auto w-[280px] sm:w-[320px]" aria-hidden="true">
      {/* Card peeking out behind the top one, to imply a deck */}
      <div className="absolute inset-x-6 top-6 h-full rounded-[2.2rem] bg-brand-100/70" />
      <div className="absolute inset-x-3 top-3 h-full rounded-[2.4rem] bg-brand-50" />

      <div className="relative rounded-[2.6rem] border-[10px] border-ink-900 bg-white shadow-2xl">
        <div className="flex h-6 items-center justify-center">
          <div className="h-1.5 w-16 rounded-full bg-ink-900/15" />
        </div>

        <div className="px-4 pb-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-bold text-ink-900">Hey Aisha</p>
            <p className="text-[10px] font-medium text-ink-500">2h ago</p>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
                KT
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">Kopi Tech</p>
                <p className="text-[10px] text-ink-500">Software · 11–50</p>
              </div>
            </div>

            <h3 className="mt-3 text-lg font-bold leading-tight text-ink-900">
              Senior React Native Engineer
            </h3>
            <p className="mt-1 text-sm font-bold text-apply-500">{salary}</p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-600">
                {location}
              </span>
              <span className="rounded-md bg-black/5 px-2 py-1 text-[10px] font-semibold text-ink-500">
                Full-time
              </span>
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">
              Own the merchant app 12,000 hawker stalls use to take payments. We care about startup
              time, offline behaviour and gesture feel…
            </p>

            {/* The right-swipe affordance, mid-drag */}
            <div className="mt-3 flex justify-start">
              <span className="rotate-[-8deg] rounded-lg border-2 border-apply-500 bg-apply-500/10 px-2.5 py-1 text-xs font-extrabold tracking-widest text-apply-500">
                APPLY
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-skip-500 text-lg font-bold text-skip-500">
              ✕
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-500">
              ⌄
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-apply-500 text-lg font-bold text-apply-500">
              ✓
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
