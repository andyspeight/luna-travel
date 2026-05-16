import type { Config } from 'tailwindcss';
import tgPreset from './packages/ui/tailwind-preset.js';

const config: Config = {
  presets: [tgPreset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/ui/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument)', 'Georgia', 'serif'],
      },
      colors: {
        // Travelgenix brand — kept for compatibility with existing PWA code
        navy: {
          DEFAULT: '#1B2B5B',
          light: '#2A3F7A',
          dark: '#111D3E',
        },
        teal: {
          DEFAULT: '#00B4D8',
          light: '#48CAE4',
          dark: '#0096B7',
        },
        gold: '#F59E0B',
        // Semantic
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        // Surfaces (existing PWA uses these CSS vars)
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        ink: {
          DEFAULT: 'var(--text)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
        },
        line: {
          DEFAULT: 'var(--border)',
          light: 'var(--border-light)',
        },
      },
      // Keep your animations
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        pulse: 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
