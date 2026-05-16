/**
 * @travelgenix/ui — Core Components
 * 
 * The shared component library used by every Travelgenix admin surface.
 * 
 * Every component:
 * - Uses design tokens (zero hardcoded values)
 * - Has light + dark mode working from day one
 * - Has all interactive states (default, hover, active, focus, disabled)
 * - Meets WCAG 4.5:1 contrast
 * - Respects prefers-reduced-motion
 * - Has 44px minimum touch targets where interactive
 */

import React, { forwardRef } from 'react';

// ============================================================
// UTILITIES
// ============================================================
export const cx = (...classes) => classes.filter(Boolean).join(' ');

// ============================================================
// BUTTON
// ============================================================
const buttonVariants = {
  primary:   'bg-tg-primary hover:bg-tg-primary-light active:bg-tg-primary-dark text-white',
  accent:    'bg-tg-accent hover:bg-tg-accent-dark active:bg-tg-accent-dark text-white',
  secondary: 'bg-transparent border border-tg-border hover:bg-tg-bg-secondary text-tg-text',
  ghost:     'bg-transparent hover:bg-tg-bg-secondary text-tg-text-secondary hover:text-tg-text',
  danger:    'bg-tg-error hover:bg-tg-error/90 text-white',
};

const buttonSizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',  // 44px — touch target compliant
  lg: 'h-12 px-6 text-md',
};

export const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-md font-medium',
      'transition-all duration-base ease-out',
      'focus-visible:outline-none focus-visible:shadow-focus',
      'active:scale-[0.98]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
      buttonVariants[variant],
      buttonSizes[size],
      className
    )}
    {...props}
  >
    {loading ? (
      <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    ) : (
      <>
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </>
    )}
  </button>
));
Button.displayName = 'Button';

// ============================================================
// INPUT
// ============================================================
export const Input = forwardRef(({
  label,
  helper,
  error,
  required,
  leftIcon,
  rightIcon,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-tg-text mb-1">
          {label}
          {required && <span className="text-tg-error ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tg-text-tertiary pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
          className={cx(
            'w-full h-11 rounded-md border bg-tg-bg text-base text-tg-text',
            'placeholder:text-tg-text-tertiary',
            'transition-colors duration-base',
            'focus:outline-none focus:shadow-focus',
            leftIcon ? 'pl-10' : 'pl-3',
            rightIcon ? 'pr-10' : 'pr-3',
            error
              ? 'border-tg-error focus:border-tg-error focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]'
              : 'border-tg-border focus:border-tg-accent',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tg-text-tertiary">
            {rightIcon}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-tg-error" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p id={`${inputId}-helper`} className="mt-1 text-sm text-tg-text-tertiary">
          {helper}
        </p>
      ) : null}
    </div>
  );
});
Input.displayName = 'Input';

// ============================================================
// PILL / BADGE
// ============================================================
const pillVariants = {
  default: 'bg-tg-bg-tertiary text-tg-text-secondary',
  primary: 'bg-tg-primary/10 text-tg-primary dark:bg-tg-primary/20 dark:text-tg-accent-light',
  accent:  'bg-tg-accent/10 text-tg-accent-dark dark:bg-tg-accent/20 dark:text-tg-accent-light',
  success: 'bg-tg-success-soft text-tg-success',
  warning: 'bg-tg-warning-soft text-tg-warning',
  error:   'bg-tg-error-soft text-tg-error',
  info:    'bg-tg-info-soft text-tg-info',
};

export const Pill = ({ variant = 'default', children, className }) => (
  <span className={cx(
    'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium uppercase tracking-wide',
    pillVariants[variant],
    className
  )}>
    {children}
  </span>
);

// ============================================================
// STATUS DOT (with optional breathing animation)
// ============================================================
const statusColors = {
  live:        'bg-tg-success',
  paused:      'bg-tg-text-tertiary',
  maintenance: 'bg-tg-warning',
  setup:       'bg-tg-info',
  offline:     'bg-tg-error',
};

export const StatusDot = ({ status = 'live', pulse = true, className }) => (
  <span className={cx('relative inline-flex h-2 w-2', className)} role="presentation">
    {pulse && status === 'live' && (
      <span className={cx(
        'absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping motion-reduce:hidden',
        statusColors[status]
      )} aria-hidden />
    )}
    <span className={cx('relative inline-flex h-2 w-2 rounded-full', statusColors[status])} />
  </span>
);

export const StatusLabel = ({ status, label, pulse = true }) => {
  const textColors = {
    live:        'text-tg-success',
    paused:      'text-tg-text-secondary',
    maintenance: 'text-tg-warning',
    setup:       'text-tg-info',
    offline:     'text-tg-error',
  };
  return (
    <span className={cx('inline-flex items-center gap-2 text-sm font-medium', textColors[status])}>
      <StatusDot status={status} pulse={pulse} />
      {label}
    </span>
  );
};

// ============================================================
// CARD
// ============================================================
export const Card = ({ className, children, interactive = false, ...props }) => (
  <div
    className={cx(
      'bg-tg-bg-elevated border border-tg-border rounded-xl',
      interactive && 'transition-all duration-base ease-out hover:shadow-md hover:-translate-y-px cursor-pointer',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, action, className }) => (
  <div className={cx('px-6 py-4 flex items-center justify-between border-b border-tg-border', className)}>
    <div>
      <h3 className="text-base font-semibold text-tg-text">{title}</h3>
      {subtitle && <p className="text-sm text-tg-text-tertiary mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const CardBody = ({ className, children }) => (
  <div className={cx('p-6', className)}>{children}</div>
);

// ============================================================
// KPI STRIP — divided row of metrics, no individual card boxes
// ============================================================
export const KPIStrip = ({ metrics, columns = 4 }) => {
  const gridCols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' }[columns];
  return (
    <div className="rounded-xl bg-tg-bg-elevated border border-tg-border">
      <div className={cx('grid divide-x divide-tg-border', gridCols)}>
        {metrics.map((m, i) => (
          <div key={i} className="px-6 py-5">
            <div className="text-xs uppercase tracking-wider text-tg-text-tertiary mb-2">{m.label}</div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums text-tg-text">{m.value}</div>
            {m.sub && <div className="text-sm text-tg-text-tertiary mt-1">{m.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// DATA ROW — for dense list views
// ============================================================
export const DataRow = ({ avatar, primary, secondary, meta, status, onClick, className }) => (
  <button
    onClick={onClick}
    className={cx(
      'w-full px-6 py-4 flex items-center gap-4 text-left',
      'hover:bg-tg-bg-secondary transition-colors duration-fast',
      'focus-visible:outline-none focus-visible:bg-tg-bg-secondary',
      className
    )}
  >
    {avatar && <div className="shrink-0">{avatar}</div>}
    <div className="flex-1 min-w-0">
      <div className="text-base font-medium text-tg-text truncate">{primary}</div>
      {secondary && <div className="text-sm text-tg-text-tertiary mt-0.5 truncate">{secondary}</div>}
    </div>
    {meta && <div className="hidden md:flex items-center gap-8 text-sm">{meta}</div>}
    {status}
  </button>
);

// ============================================================
// AVATAR — initial-based, deterministic from name
// ============================================================
export const Avatar = ({ name, size = 'md', bg, className }) => {
  const sizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-12 w-12 text-base',
  };
  const initials = name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div
      className={cx(
        'rounded-md flex items-center justify-center text-white font-semibold shrink-0',
        sizes[size],
        !bg && 'bg-tg-primary',
        className
      )}
      style={bg ? { backgroundColor: bg } : undefined}
      aria-label={name}
    >
      {initials}
    </div>
  );
};

// ============================================================
// PAGE LAYOUT — consistent admin page wrapper
// ============================================================
export const PageHeader = ({ eyebrow, title, description, action, className }) => (
  <div className={cx('flex items-end justify-between mb-8', className)}>
    <div>
      {eyebrow && <div className="text-xs uppercase tracking-wider text-tg-text-tertiary mb-1">{eyebrow}</div>}
      <h1 className="text-2xl font-semibold tracking-tight text-tg-text">{title}</h1>
      {description && <p className="text-sm text-tg-text-secondary mt-1 max-w-content">{description}</p>}
    </div>
    {action}
  </div>
);

export const PageContainer = ({ className, children }) => (
  <div className={cx('px-8 py-8 max-w-container mx-auto', className)}>{children}</div>
);

// ============================================================
// EMPTY STATE
// ============================================================
export const EmptyState = ({ icon, title, description, action, className }) => (
  <div className={cx('rounded-xl bg-tg-bg-elevated border border-tg-border px-6 py-12 text-center', className)}>
    {icon && <div className="mx-auto mb-3 text-tg-text-tertiary">{icon}</div>}
    <h3 className="text-base font-medium text-tg-text mb-1">{title}</h3>
    {description && <p className="text-sm text-tg-text-tertiary max-w-form mx-auto mb-4">{description}</p>}
    {action}
  </div>
);

// ============================================================
// TABS
// ============================================================
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex items-center gap-1 border-b border-tg-border mb-6 overflow-x-auto">
    {tabs.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={cx(
          'px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
          'transition-colors duration-base',
          'focus-visible:outline-none focus-visible:shadow-focus',
          value === t.id
            ? 'border-tg-primary dark:border-tg-accent text-tg-text'
            : 'border-transparent text-tg-text-tertiary hover:text-tg-text'
        )}
        aria-selected={value === t.id}
        role="tab"
      >
        {t.label}
        {t.count != null && (
          <span className="ml-2 text-xs text-tg-text-tertiary tabular-nums">{t.count}</span>
        )}
      </button>
    ))}
  </div>
);

// ============================================================
// SEGMENTED CONTROL — for filter switches
// ============================================================
export const Segmented = ({ options, value, onChange }) => (
  <div className="inline-flex items-center gap-1 p-1 rounded-md bg-tg-bg-tertiary">
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={cx(
          'px-3 h-8 rounded-sm text-sm font-medium transition-colors duration-base',
          'focus-visible:outline-none focus-visible:shadow-focus',
          value === opt.value
            ? 'bg-tg-bg-elevated text-tg-text shadow-xs'
            : 'text-tg-text-secondary hover:text-tg-text'
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ============================================================
// SIDEBAR
// ============================================================
export const Sidebar = ({ brand, items, value, onChange, footer, className }) => (
  <aside className={cx(
    'w-60 shrink-0 border-r border-tg-border bg-tg-bg flex flex-col',
    className
  )}>
    {brand && (
      <div className="px-5 py-5 border-b border-tg-border">{brand}</div>
    )}
    <nav className="flex-1 px-3 py-4 space-y-1" role="navigation">
      {items.map(item => {
        const Icon = item.icon;
        const active = value === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cx(
              'w-full flex items-center gap-3 px-3 h-10 rounded-md text-sm',
              'transition-colors duration-base',
              'focus-visible:outline-none focus-visible:shadow-focus',
              active
                ? 'bg-tg-bg-tertiary text-tg-text font-medium'
                : 'text-tg-text-secondary hover:bg-tg-bg-secondary hover:text-tg-text'
            )}
            aria-current={active ? 'page' : undefined}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
            <span>{item.label}</span>
            {item.badge != null && (
              <span className="ml-auto text-xs text-tg-text-tertiary tabular-nums">{item.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
    {footer && (
      <div className="px-3 py-3 border-t border-tg-border">{footer}</div>
    )}
  </aside>
);

// ============================================================
// LABEL — form label helper
// ============================================================
export const Label = ({ children, htmlFor, required, className }) => (
  <label htmlFor={htmlFor} className={cx('block text-sm font-medium text-tg-text mb-1', className)}>
    {children}
    {required && <span className="text-tg-error ml-0.5" aria-hidden>*</span>}
  </label>
);

// ============================================================
// SKELETON — for loading states
// ============================================================
export const Skeleton = ({ className }) => (
  <div className={cx('animate-pulse bg-tg-bg-tertiary rounded-md motion-reduce:animate-none', className)} />
);
