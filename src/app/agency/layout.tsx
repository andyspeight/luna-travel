import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agency portal · Luna Travel',
  robots: { index: false, follow: false },
};

// The agency portal is a standalone, self-contained surface. It intentionally
// does NOT use the admin SSO gate (tg-auth-gate.js) — Luna-native agencies are
// non-Travelgenix clients and sign in via a magic link, not Travelgenix ID.
export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
