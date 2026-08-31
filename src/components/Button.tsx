import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const styles: Record<Variant, string> = {
  primary:
    'bg-teal text-white hover:bg-teal-dark shadow-sm disabled:opacity-50',
  secondary:
    'bg-white text-ink border border-line hover:border-teal hover:text-teal-dark disabled:opacity-50',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-white disabled:opacity-50',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50'
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
