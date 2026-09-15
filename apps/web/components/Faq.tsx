export const FAQ_ITEMS = [
  {
    question: 'Does swiping right really submit an application?',
    answer:
      'Yes. A right swipe sends your profile and saved resume to that employer straight away. You get a confirmation the moment it goes, and the application appears in your tracker.',
  },
  {
    question: 'What if I swipe right by accident?',
    answer:
      'The card has to travel about a third of the screen before it counts, so brushes and scrolls do not trigger it. You can also tap the tick and cross buttons instead of swiping.',
  },
  {
    question: 'Will I see the same job twice?',
    answer:
      'No. Every decision is recorded, so a role you skipped never comes back and a role you applied to is filtered out of your deck.',
  },
  {
    question: 'Who can see my resume?',
    answer:
      'Only employers you have applied to. Resumes live in private storage, and access is enforced at the database level rather than in the app — an employer cannot request a resume from someone who has not applied to their posting.',
  },
  {
    question: 'Is it free?',
    answer:
      'Free for job seekers, always. Employers pay per posting once they are past their first role.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
      <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
        Frequently asked
      </h2>

      <div className="mt-8 divide-y divide-black/5 border-y border-black/5">
        {FAQ_ITEMS.map((item) => (
          // <details> keeps this interactive without shipping any JavaScript.
          <details key={item.question} className="group py-5">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-semibold text-ink-900 marker:content-none [&::-webkit-details-marker]:hidden">
              {item.question}
              <span
                aria-hidden="true"
                className="shrink-0 text-2xl leading-none text-brand-500 transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-ink-500">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
