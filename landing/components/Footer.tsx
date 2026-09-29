export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <p className="text-lg font-extrabold text-brand-500">KiasuJobs</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Swipe-to-apply job hunting. One role per card, your resume already
              attached.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterColumn
              heading="Product"
              links={[
                { label: "How it works", href: "#how-it-works" },
                { label: "For job seekers", href: "#for-seekers" },
                { label: "For employers", href: "#for-employers" },
              ]}
            />
            <FooterColumn
              heading="Company"
              links={[
                { label: "FAQ", href: "#faq" },
                { label: "Contact", href: "mailto:hello@kiasujobs.com" },
              ]}
            />
            <FooterColumn
              heading="Legal"
              links={[
                { label: "Privacy", href: "#" },
                { label: "Terms", href: "#" },
              ]}
            />
          </div>
        </div>

        <p className="mt-10 border-t border-black/5 pt-6 text-xs text-ink-500">
          © {year} KiasuJobs. Built as a demo project.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900">
        {heading}
      </h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-ink-500 hover:text-ink-900"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
