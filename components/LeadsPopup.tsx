'use client'

import { useState, useEffect } from 'react'

export default function LeadsPopup() {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !mobile) return

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, email })
      })
      setSubmitted(true)
      setTimeout(() => setShow(false), 2000)
    } catch (error) {
      console.error('Failed to submit lead:', error)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md px-4 py-8">
      <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl ring-1 ring-slate-200/80 animate-pop">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Get 10% off</h2>
            <p className="text-sm text-slate-500 mt-1">Join our exclusive list</p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-slate-900 font-semibold">Thanks for joining!</p>
            <p className="text-sm text-slate-600 mt-2">Check your WhatsApp for exclusive offers.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              required
            />
            <input
              type="tel"
              placeholder="WhatsApp number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              required
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Unlock 10% discount
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
