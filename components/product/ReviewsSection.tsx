'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import type { Review } from '../../types'

function StarPicker({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
        >
          <Star
            size={onChange ? 22 : 14}
            className={i <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}
          />
        </button>
      ))}
    </div>
  )
}

export default function ReviewsSection({ productId, initialReviews }: { productId: string; initialReviews: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  // Rating distribution
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length ? Math.round((reviews.filter((r) => r.rating === star).length / reviews.length) * 100) : 0,
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !rating || !text.trim()) {
      setError('Please fill in your name, select a rating, and write a review.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, name: name.trim(), rating, review: text.trim() }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setReviews((prev) => [
        { productId, name: name.trim(), rating, review: text.trim(), date: new Date().toISOString() },
        ...prev,
      ])
      setSubmitted(true)
      setName('')
      setRating(0)
      setText('')
      setTimeout(() => setSubmitted(false), 5000)
    } catch {
      setError('Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-14 border-t border-slate-200 pt-10">
      <h2 className="text-2xl font-extrabold text-slate-900">Customer Reviews</h2>

      {/* ── Aggregate ── */}
      {reviews.length > 0 && (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Score */}
          <div className="flex shrink-0 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-8 py-6">
            <p className="text-6xl font-extrabold text-slate-900">{avg.toFixed(1)}</p>
            <StarPicker value={Math.round(avg)} />
            <p className="mt-1.5 text-xs text-slate-400">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
          </div>
          {/* Distribution bars */}
          <div className="flex-1 space-y-2">
            {dist.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-2.5 text-xs text-slate-500">
                <span className="w-3 shrink-0 text-right font-semibold">{star}</span>
                <Star size={10} className="shrink-0 fill-amber-400 text-amber-400" />
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Review list ── */}
      {reviews.length > 0 ? (
        <div className="mt-8 space-y-4">
          {reviews.map((r, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-700 text-sm font-extrabold text-white">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{r.name}</p>
                    {r.date && (
                      <p className="text-[11px] text-slate-400">
                        {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <StarPicker value={r.rating} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{r.review}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">No reviews yet — be the first to share your experience!</p>
      )}

      {/* ── Write a review ── */}
      <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="text-base font-bold text-slate-900">Write a Review</h3>
        <p className="mt-0.5 text-xs text-slate-400">Share your experience to help other shoppers.</p>

        {submitted && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            Thank you! Your review has been submitted.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Your name</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-slate-400"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Rating</label>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Your review</label>
            <textarea
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-slate-400"
              placeholder="Share your experience with this product…"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-accent/20 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  )
}
