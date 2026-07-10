import type { Config } from 'tailwindcss';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tgPreset = require('./packages/ui/tailwind-preset.js');

const config: Config = {
  presets: [tgPreset],
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/ui/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ─────────────────────────────────────────────────────────────
      // Luna Travel PWA tokens — map to the CSS variables defined in
      // src/app/globals.css. These are SEPARATE from the @travelgenix/ui
      // preset tokens (which use the tg- prefix). Both coexist:
      //   • Admin chrome → tg-* tokens (from preset)
      //   • Traveller PWA → surface / ink / etc (defined here)
      // ─────────────────────────────────────────────────────────────
      colors: {
        // Surfaces — light + dark via [data-theme="dark"]
        surface:        'var(--surface)',
        'surface-2':    'var(--surface-2)',
        'surface-3':    'var(--surface-3)',

        // Borders
        line:           'var(--border)',
        'line-light':   'var(--border-light)',

        // Text — uses "ink" naming convention (already used throughout the PWA)
        ink:            'var(--text)',
        'ink-2':        'var(--text-2)',
        'ink-3':        'var(--text-3)',

        // Brand accents used by the PWA. Backed by CSS variables so an agency's
        // white-label colours re-theme the app at runtime (defaults = Luna
        // Travel's teal/navy, set in globals.css; overridden per-agency in
        // booking-context). The `rgb(var(--x) / <alpha-value>)` form keeps
        // opacity modifiers (bg-teal/10, text-navy/50, …) working.
        // `navy.dark` stays a fixed near-black — it's used as strong text, not
        // as brand, so it must not shift with the agency colour.
        teal: {
          DEFAULT: 'rgb(var(--brand-accent-rgb) / <alpha-value>)',
          light:   'rgb(var(--brand-accent-light-rgb) / <alpha-value>)',
          dark:    'rgb(var(--brand-accent-dark-rgb) / <alpha-value>)',
        },
        navy: {
          DEFAULT: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
          light:   'rgb(var(--brand-primary-light-rgb) / <alpha-value>)',
          dark:    '#0f172a',
        },

        // Semantic states — these may also exist in the preset but
        // declaring them here gives the PWA a stable shorthand even
        // if it later diverges from the admin chrome.
        success: '#10b981',
        warning: '#f59e0b',
        danger:  '#ef4444',
      },

      // Custom animations used by modals / sheets / page transitions.
      // The keyframes need to be declared here for Tailwind to emit them.
      keyframes: {
        'fade-in': {
          'from': { opacity: '0' },
          'to':   { opacity: '1' },
        },
        'slide-up': {
          'from': { transform: 'translateY(16px)', opacity: '0' },
          'to':   { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-down': {
          'from': { transform: 'translateY(-16px)', opacity: '0' },
          'to':   { transform: 'translateY(0)',     opacity: '1' },
        },
      },
      animation: {
        'fade-in':    'fade-in 200ms ease-out',
        'slide-up':   'slide-up 250ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-down': 'slide-down 250ms cubic-bezier(0.22, 1, 0.36, 1)',
      },

      // The preset overrides borderRadius entirely and stops at 2xl (20px).
      // The PWA uses 3xl in a few places (the bottom-sheet corners on the
      // doc modal, for instance). Re-add it here so existing markup that
      // uses rounded-3xl / rounded-t-3xl picks up a sensible value.
      borderRadius: {
        '3xl': '24px',
      },
    },
  },
};

export default config;
