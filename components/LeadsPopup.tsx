'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight } from 'lucide-react'

const POPUP_KEY = 'leads_popup_seen_v2'

interface LeadsPopupProps {
  offerLabel?: string
  offerTitle?: string
  offerSubtitle?: string
}

export default function LeadsPopup({
  offerLabel = 'Exclusive offer',
  offerTitle = 'Get 10% off your first order',
  offerSubtitle = 'Join our members list for exclusive deals & early access.',
}: LeadsPopupProps) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    // Only show once per browser (localStorage persists across sessions)
    if (typeof window !== 'undefined' && localStorage.getItem(POPUP_KEY)) return
    const timer = setTimeout(() => setShow(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    localStorage.setItem(POPUP_KEY, '1')
    setShow(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !mobile) return
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile })
      })
      setSubmitted(true)
      localStorage.setItem(POPUP_KEY, '1')
      setTimeout(() => setShow(false), 2200)
    } catch (error) {
      console.error('Failed to submit lead:', error)
    }
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/80 animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-accent via-blue-600 to-indigo-700 px-6 py-7">
          <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.06]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/[0.06]" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); dismiss() }}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/80 transition hover:bg-white/25 hover:text-white"
          >
            <X size={14} />
          </button>
          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/80">
              {offerLabel}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-white">{offerTitle}</h2>
            <p className="mt-1.5 text-sm text-blue-100/80">{offerSubtitle}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {submitted ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">You're in! 🎉</h3>
              <p className="mt-1.5 text-sm text-slate-500">Check your WhatsApp for your exclusive discount code.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                required
              />
              <input
                type="tel"
                placeholder="WhatsApp number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="input-field"
                required
              />
              <button type="submit" className="btn-primary w-full">
                Unlock discount
                <ArrowRight size={15} />
              </button>
              <p className="text-center text-[11px] text-slate-400">No spam. Unsubscribe anytime.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
