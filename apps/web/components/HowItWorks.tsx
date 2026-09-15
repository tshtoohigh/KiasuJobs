const STEPS = [
  {
    step: '01',
    title: 'Set up once',
    body: 'Upload your resume and say what you want — remote or on-site, which industries, your salary floor. Two minutes, and you never fill in a form again.',
  },
  {
    step: '02',
    title: 'Swipe through real roles',
    body: 'One job per card: title, company, salary, location. Tap to read the whole description. Cards are pre-loaded, so there is no spinner between decisions.',
  },
  {
    step: '03',
    title: 'Right to apply, left to forget',
    body: 'A right swipe sends your resume immediately. A left swipe removes that role from your deck permanently — you will not see it again next week.',
  },
  {
    step: '04',
    title: 'Watch it move',
    body: 'Every application is tracked from sent, to viewed by the employer, to shortlisted. No more wondering whether anyone opened it.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          How it works
        </h2>
        <p className="mt-3 text-lg text-ink-500">
          Job hunting is mostly repetition. We removed the repetition.
        </p>
      </div>

      <ol className="mt-12 grid gap-6 sm:grid-cols-2">
        {STEPS.map((item) => (
          <li
            key={item.step}
            className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <span className="text-sm font-extrabold tracking-widest text-brand-400">
              {item.step}
            </span>
            <h3 className="mt-3 text-xl font-bold text-ink-900">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-ink-500">{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
