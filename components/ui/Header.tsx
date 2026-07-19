import Link from 'next/link'
import React from 'react'
import config from '../../config'

export default function Header() {
  const initials = config.businessName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            {config.logo ? (
              <img src={config.logo} alt={config.businessName} className="h-10 w-10 rounded-2xl border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 text-sm font-semibold uppercase text-white">
                {initials}
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Your store</p>
              <div className="text-base font-semibold text-slate-900">{config.businessName}</div>
            </div>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-between gap-3 sm:justify-end">
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent sm:hidden">
            Search
          </Link>

          <div className="relative hidden md:block w-full max-w-xl">
            <label className="sr-only">Search products</label>
            <input
              placeholder="Search products, brands & categories"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 pl-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
          </div>

          <Link href="/cart" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-accent hover:text-accent">
            <span className="sr-only">View cart</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6h15l-1.5 9h-12z" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white">0</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
