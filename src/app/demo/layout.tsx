import type { Metadata } from 'next';

/**
 * Metadata for a link that gets pasted into WhatsApp, LinkedIn and email.
 *
 * A sales page is judged before it is opened. Without these, the preview card
 * falls back to the PWA's own title and manifest icon, which reads as somebody
 * sharing a half-built web app rather than a product.
 *
 * The cover image is the same photograph the hero uses, so the card and the
 * page are recognisably the same thing.
 */
export const metadata: Metadata = {
  title: 'Luna Travel — see the app',
  description:
    'Every booking becomes an app: flights, documents, destination guide and live alerts, under your own brand. Open one of four live demo trips — no sign-in.',
  openGraph: {
    title: 'Luna Travel — see the app',
    description:
      'Four live demo trips. Flights, documents, destination guide and live alerts, under your own brand.',
    images: ['/images/destinations/cover-mv-landscape.webp'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Luna Travel — see the app',
    description: 'Four live demo trips. No sign-in, nothing to install.',
    images: ['/images/destinations/cover-mv-landscape.webp'],
  },
  // A demo page is for people, not for search results competing with the
  // marketing site.
  robots: { index: false, follow: true },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
