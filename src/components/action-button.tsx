'use client';

import { ReactNode } from 'react';

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function ActionButton({
  children,
  onClick,
  icon,
  variant = 'primary',
  disabled,
  type = 'button',
}: ActionButtonProps) {
  const base =
    'w-full h-[50px] rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100';
  const styles =
    variant === 'primary'
      ? 'bg-navy text-white dark:bg-teal dark:text-navy-dark hover:bg-navy-light dark:hover:bg-teal-light'
      : 'bg-surface text-ink border border-line hover:bg-surface-2';

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
