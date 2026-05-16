/**
 * @travelgenix/ui — Tailwind Preset
 *
 * EXTENDS Tailwind's default scales rather than replacing them.
 * Critical: spacing, fontSize, and borderRadius must NOT be redefined
 * here, or all default Tailwind utilities (w-60, gap-5, px-8, etc.)
 * stop working.
 *
 * Only adds Travelgenix-specific colour tokens.
 *
 * darkMode is intentionally NOT set here — the consuming
 * tailwind.config owns that.
 */

module.exports = {
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
    },
  },
  plugins: [],
};
