import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument)', 'Georgia', 'serif'],
      },
      colors: {
        // Travelgenix brand
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
        // Surfaces (via CSS vars so dark mode toggles)
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
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15,23,42,0.05)',
        sm: '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
        md: '0 4px 6px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)',
        lg: '0 10px 15px rgba(15,23,42,0.08), 0 4px 6px rgba(15,23,42,0.04)',
        xl: '0 20px 25px rgba(15,23,42,0.08), 0 10px 10px rgba(15,23,42,0.04)',
        float: '0 25px 50px rgba(15,23,42,0.12)',
      },
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
