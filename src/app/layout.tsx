import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { BookingProvider } from '@/lib/booking-context';
import { ThemeProvider } from '@/lib/theme-context';
import { LocaleProvider } from '@/lib/locale-context';
import { CoverProvider } from '@/lib/cover-context';
import { TabBar } from '@/components/tab-bar';
import { VersionCheck } from '@/components/version-check';
import { EngagementPing } from '@/components/engagement-ping';
import { MaintenanceBanner } from '@/components/maintenance-banner';
import { PhoneCanvas } from '@/components/phone-canvas';
import { AppIdentity } from '@/components/app-identity';
import { iconUrl, DEFAULT_SPEC, DEFAULT_APP_NAME } from '@/lib/app-icon';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const instrument = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
});

// The neutral defaults: until the page knows whose trip this is, the app is
// "Your trip" with a plane, not "Luna Travel" with "LT", because the traveller
// reading it belongs to an agency (components/app-identity then makes it
// theirs). The agency portal, admin and demo set their own titles.
const DEFAULT_ICON = (size: 180 | 192) => iconUrl(DEFAULT_SPEC, size);

export const metadata: Metadata = {
  title: DEFAULT_APP_NAME,
  description: 'Your trip in your pocket — from confirmation to coming home.',
  applicationName: DEFAULT_APP_NAME,
  appleWebApp: {
    capable: true,
    title: DEFAULT_APP_NAME,
    statusBarStyle: 'black-translucent',
  },
  // No `manifest` here: it is linked in <head> below, because it has to be
  // fetched with the traveller's cookie and metadata cannot say so.
  icons: {
    icon: [{ url: DEFAULT_ICON(192), sizes: '192x192', type: 'image/png' }],
    apple: [{ url: DEFAULT_ICON(180), sizes: '180x180' }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable}`}>
      <head>
        {/* The manifest for whoever this is, from the first byte: a signed-in
            traveller gets their agency's app before any script has run.
            Browsers fetch a manifest without cookies unless told otherwise. */}
        <link rel="manifest" href="/api/app/manifest/current" crossOrigin="use-credentials" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <LocaleProvider>
            <BookingProvider>
              <CoverProvider>
                <VersionCheck />
                <EngagementPing />
                <AppIdentity />
                {/* The banner and the tab bar go INSIDE the canvas: both are
                    fixed, so on a wide screen they belong to the phone rather
                    than to the window. */}
                <PhoneCanvas>
                  <MaintenanceBanner />
                  <div
                    className="lt-app-shell min-h-screen pb-[88px]"
                    style={{ paddingTop: 'var(--safe-top)' }}
                  >
                    {children}
                  </div>
                  <TabBar />
                </PhoneCanvas>
              </CoverProvider>
            </BookingProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
