import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }

export default function Button({ children, variant = 'primary', className: cn = '', ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55'
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-accent to-blue-600 text-white shadow-md shadow-accent/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30 active:translate-y-0',
    ghost:
      'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0',
  }
  return (
    <button {...rest} className={`${base} ${variants[variant]} ${cn}`}>
      {children}
    </button>
  )
}
