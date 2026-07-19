import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }

export default function Button({ children, variant = 'primary', ...rest }: Props) {
  const base = 'px-5 py-3 rounded-full text-sm font-semibold inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
  const className =
    variant === 'primary'
      ? `${base} bg-accent text-white shadow-lg shadow-accent/20 hover:bg-slate-900`
      : `${base} border border-slate-200 bg-white text-slate-900 hover:bg-slate-50`
  return (
    <button {...rest} className={`${className} ${rest.className ?? ''}`}>
      {children}
    </button>
  )
}
