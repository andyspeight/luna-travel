import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { BookingProvider } from '@/lib/booking-context';
import { ThemeProvider } from '@/lib/theme-context';
import { CoverProvider } from '@/lib/cover-context';
import { TabBar } from '@/components/tab-bar';
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

export const metadata: Metadata = {
  title: 'Luna Travel',
  description: 'Your trip in your pocket — from confirmation to coming home.',
  applicationName: 'Luna Travel',
  appleWebApp: {
    capable: true,
    title: 'Luna Travel',
    statusBarStyle: 'black-translucent',
  },
  manifest: '/manifest.json',
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
      <body className="font-sans antialiased">
        <ThemeProvider>
          <BookingProvider>
            <CoverProvider>
              <div
                className="min-h-screen pb-[88px]"
                style={{ paddingTop: 'var(--safe-top)' }}
              >
                {children}
              </div>
              <TabBar />
            </CoverProvider>
          </BookingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
