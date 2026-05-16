/**
 * @travelgenix/ui — Tailwind Preset
 * 
 * Every Travelgenix project extends this preset in its tailwind.config.js:
 * 
 *   import tgPreset from '@travelgenix/ui/tailwind-preset';
 *   export default {
 *     presets: [tgPreset],
 *     content: [...],
 *   };
 * 
 * This guarantees that `text-base` means 15px everywhere,
 * `rounded-md` means 8px everywhere, `p-4` means 16px everywhere.
 * 
 * Drift across products becomes impossible.
 */

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand
        'tg-primary':       'var(--tg-primary)',
        'tg-primary-light': 'var(--tg-primary-light)',
        'tg-primary-dark':  'var(--tg-primary-dark)',
        'tg-accent':        'var(--tg-accent)',
        'tg-accent-light':  'var(--tg-accent-light)',
        'tg-accent-dark':   'var(--tg-accent-dark)',
        // Semantic
        'tg-success':       'var(--tg-success)',
        'tg-success-soft':  'var(--tg-success-soft)',
        'tg-warning':       'var(--tg-warning)',
        'tg-warning-soft':  'var(--tg-warning-soft)',
        'tg-error':         'var(--tg-error)',
        'tg-error-soft':    'var(--tg-error-soft)',
        'tg-info':          'var(--tg-info)',
        'tg-info-soft':     'var(--tg-info-soft)',
        // Surfaces
        'tg-bg':            'var(--tg-bg-primary)',
        'tg-bg-secondary':  'var(--tg-bg-secondary)',
        'tg-bg-tertiary':   'var(--tg-bg-tertiary)',
        'tg-bg-elevated':   'var(--tg-bg-elevated)',
        // Borders
        'tg-border':        'var(--tg-border)',
        'tg-border-light':  'var(--tg-border-light)',
        'tg-border-strong': 'var(--tg-border-strong)',
        // Text
        'tg-text':          'var(--tg-text-primary)',
        'tg-text-secondary':'var(--tg-text-secondary)',
        'tg-text-tertiary': 'var(--tg-text-tertiary)',
        'tg-text-inverse':  'var(--tg-text-inverse)',
        'tg-text-accent':   'var(--tg-text-accent)',
      },
      fontFamily: {
        sans:    ['var(--tg-font-body)'],
        display: ['var(--tg-font-display)'],
        mono:    ['var(--tg-font-mono)'],
      },
      fontSize: {
        // Mapped to design skill type scale — strictly enforced
        'xs':   ['11px', { lineHeight: '1.4', fontWeight: '400' }],
        'sm':   ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'base': ['15px', { lineHeight: '1.6', fontWeight: '400' }],
        'md':   ['16px', { lineHeight: '1.5', fontWeight: '500' }],
        'lg':   ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'xl':   ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        '2xl':  ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        '3xl':  ['36px', { lineHeight: '1.15', fontWeight: '700' }],
      },
      spacing: {
        // 4px grid only
        '1':  '4px',
        '2':  '8px',
        '3':  '12px',
        '4':  '16px',
        '5':  '20px',
        '6':  '24px',
        '8':  '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
      },
      borderRadius: {
        'sm':   '6px',
        'md':   '8px',
        'lg':   '12px',
        'xl':   '16px',
        '2xl':  '20px',
        'full': '9999px',
      },
      boxShadow: {
        'xs':     'var(--tg-shadow-xs)',
        'sm':     'var(--tg-shadow-sm)',
        'md':     'var(--tg-shadow-md)',
        'lg':     'var(--tg-shadow-lg)',
        'xl':     'var(--tg-shadow-xl)',
        'float':  'var(--tg-shadow-float)',
        'focus':  'var(--tg-shadow-focus)',
      },
      zIndex: {
        'content':  '0',
        'sticky':   '10',
        'dropdown': '20',
        'overlay':  '30',
        'modal':    '40',
        'toast':    '50',
        'tooltip':  '60',
      },
      maxWidth: {
        'container': '1440px',
        'content':   '800px',
        'form':      '480px',
      },
      transitionTimingFunction: {
        'out':    'cubic-bezier(0.16, 1, 0.3, 1)',
        'in':     'cubic-bezier(0.7, 0, 0.84, 0)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
        'slow': '300ms',
      },
      screens: {
        'sm':  '640px',
        'md':  '768px',
        'lg':  '1024px',
        'xl':  '1280px',
        '2xl': '1440px',
      },
    },
  },
  plugins: [],
};
