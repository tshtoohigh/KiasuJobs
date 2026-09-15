import type { Metadata, Viewport } from 'next';

import { siteDescription, siteName, siteUrl } from '@/lib/site';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'KiasuJobs — Swipe right to apply for jobs',
    template: '%s · KiasuJobs',
  },
  description: siteDescription,
  keywords: [
    'job search app',
    'swipe to apply',
    'apply for jobs',
    'job hunting',
    'hiring app',
    'recruitment',
    'Singapore jobs',
  ],
  applicationName: siteName,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName,
    title: 'KiasuJobs — Swipe right to apply for jobs',
    description:
      'One role per card. Swipe right to apply instantly with your saved resume. Swipe left to move on.',
    locale: 'en_SG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KiasuJobs — Swipe right to apply for jobs',
    description:
      'One role per card. Swipe right to apply instantly with your saved resume. Swipe left to move on.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  category: 'business',
};

export const viewport: Viewport = {
  themeColor: '#4e46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
