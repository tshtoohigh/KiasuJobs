import { AudienceSplit } from '@/components/AudienceSplit';
import { FAQ_ITEMS, Faq } from '@/components/Faq';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { Nav } from '@/components/Nav';
import { StoreBadges } from '@/components/StoreBadges';
import { siteUrl } from '@/lib/site';

/**
 * Fully server-rendered — no client components on this page, so the HTML a
 * crawler receives is the finished page.
 */
export default function HomePage() {
  return (
    <>
      <StructuredData />
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <AudienceSplit />
        <Faq />
        <DownloadCta />
      </main>
      <Footer />
    </>
  );
}

function DownloadCta() {
  return (
    <section id="download" className="bg-brand-500">
      <div className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Your next role is about four minutes away
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/80">
          Download KiasuJobs, upload your resume once, and start swiping. Free for job seekers,
          forever.
        </p>
        <div className="mt-8 flex justify-center">
          <StoreBadges />
        </div>
        <p className="mt-6 text-sm text-white/60">
          Not published to the stores yet — this is a demo build. Run it locally with Expo Go.
        </p>
      </div>
    </section>
  );
}

/**
 * JSON-LD for the app listing and the FAQ. The FAQ block is what earns the
 * expandable answers in Google results, and it's generated from the same array
 * the page renders so the two can't disagree.
 */
function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MobileApplication',
        name: 'KiasuJobs',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'iOS, Android',
        url: siteUrl,
        description:
          'Swipe-to-apply job hunting. See one role at a time and swipe right to apply instantly with your saved resume.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'SGD',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Server-rendered constant, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
