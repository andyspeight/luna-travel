/**
 * @travelgenix/ui — Tailwind Preset
 *
 * Extends Tailwind's default scales rather than replacing them.
 * This is critical: replacing the core spacing/fontSize scale breaks
 * built-in classes like w-60, gap-5, max-w-7xl that we rely on.
 *
 * Note: darkMode is intentionally NOT set here — the consuming
 * tailwind.config owns that.
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        'tg-primary':       'var(--tg-primary)',
        'tg-primary-light': 'var(--tg-primary-light)',
        'tg-primary-dark':  'var(--tg-primary-dark)',
        'tg-accent':        'var(--tg-accent)',
        'tg-accent-light':  'var(--tg-accent-light)',
        'tg-accent-dark':   'var(--tg-accent-dark)',
        'tg-success':       'var(--tg-success)',
        'tg-success-soft':  'var(--tg-success-soft)',
        'tg-warning':       'var(--tg-warning)',
        'tg-warning-soft':  'var(--tg-warning-soft)',
        'tg-error':         'var(--tg-error)',
        'tg-error-soft':    'var(--tg-error-soft)',
        'tg-info':          'var(--tg-info)',
        'tg-info-soft':     'var(--tg-info-soft)',
        'tg-bg':            'var(--tg-bg-primary)',
        'tg-bg-secondary':  'var(--tg-bg-secondary)',
        'tg-bg-tertiary':   'var(--tg-bg-tertiary)',
        'tg-bg-elevated':   'var(--tg-bg-elevated)',
        'tg-border':        'var(--tg-border)',
        'tg-border-light':  'var(--tg-border-light)',
        'tg-border-strong': 'var(--tg-border-strong)',
        'tg-text':          'var(--tg-text-primary)',
        'tg-text-secondary':'var(--tg-text-secondary)',
        'tg-text-tertiary': 'var(--tg-text-tertiary)',
        'tg-text-inverse':  'var(--tg-text-inverse)',
        'tg-text-accent':   'var(--tg-text-accent)',
      },
      fontFamily: {
        display: ['var(--tg-font-display)'],
        mono:    ['var(--tg-font-mono)'],
      },
      // Travelgenix-specific type tokens that sit alongside Tailwind defaults.
      // We use these via `text-tg-base` etc., NOT by overriding `text-base`.
      // This keeps Tailwind's default scale intact.
      fontSize: {
        'tg-xs':   ['11px', { lineHeight: '1.4', fontWeight: '400' }],
        'tg-sm':   ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'tg-base': ['15px', { lineHeight: '1.6', fontWeight: '400' }],
        'tg-md':   ['16px', { lineHeight: '1.5', fontWeight: '500' }],
        'tg-lg':   ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'tg-xl':   ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'tg-2xl':  ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'tg-3xl':  ['36px', { lineHeight: '1.15', fontWeight: '700' }],
      },
      boxShadow: {
        'tg-xs':     'var(--tg-shadow-xs)',
        'tg-sm':     'var(--tg-shadow-sm)',
        'tg-md':     'var(--tg-shadow-md)',
        'tg-lg':     'var(--tg-shadow-lg)',
        'tg-xl':     'var(--tg-shadow-xl)',
        'tg-float':  'var(--tg-shadow-float)',
        'tg-focus':  'var(--tg-shadow-focus)',
      },
      maxWidth: {
        'tg-container': '1440px',
        'tg-content':   '800px',
        'tg-form':      '480px',
      },
      transitionTimingFunction: {
        'tg-out':    'cubic-bezier(0.16, 1, 0.3, 1)',
        'tg-in':     'cubic-bezier(0.7, 0, 0.84, 0)',
        'tg-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      transitionDuration: {
        'tg-fast': '150ms',
        'tg-base': '200ms',
        'tg-slow': '300ms',
      },
    },
  },
  plugins: [],
};
