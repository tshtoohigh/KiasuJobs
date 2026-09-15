import { PhoneMockup } from './PhoneMockup';
import { StoreBadges } from './StoreBadges';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-apply-500" />
            No cover letters. No 20-field forms.
          </p>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
            Swipe right to
            <span className="text-brand-500"> apply</span>.
            <br />
            That&apos;s the whole application.
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-500">
            KiasuJobs shows you one job at a time. Swipe right and your saved resume goes straight
            to the employer. Swipe left and you never see it again. Most people get through a week
            of job boards in about four minutes.
          </p>

          <StoreBadges className="mt-8" />

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-ink-500">
            <Stat value="1 swipe" label="to apply" />
            <Stat value="0" label="forms to re-type" />
            <Stat value="Live" label="application tracking" />
          </div>
        </div>

        <PhoneMockup />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-base font-bold text-ink-900">{value}</span>
      <span>{label}</span>
    </p>
  );
}
