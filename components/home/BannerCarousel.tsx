'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Banner } from '../../types'

export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent(c => (c + 1) % banners.length), [banners.length])
  const prev = () => setCurrent(c => (c - 1 + banners.length) % banners.length)

  useEffect(() => {
    if (banners.length <= 1) return
    const id = setInterval(next, 5000)
    return () => clearInterval(id)
  }, [next, banners.length])

  if (banners.length === 0) return null

  const banner = banners[current]

  return (
    <section className="relative overflow-hidden bg-slate-900">
      <div className="relative h-[260px] sm:h-[360px] lg:h-[440px]">
        {/* Background image with crossfade */}
        {banners.map((b, i) => (
          <img
            key={b.bannerId}
            src={b.imageUrl}
            alt={b.title}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
            <div key={current} className="max-w-xl space-y-4 animate-fade-up">
              <h2 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
                {banner.title}
              </h2>
              {banner.subtitle && (
                <p className="text-base text-slate-300 sm:text-lg">{banner.subtitle}</p>
              )}
              {banner.linkUrl && (
                <a
                  href={banner.linkUrl}
                  className="inline-flex items-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  {banner.buttonText || 'Shop now'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Prev / Next */}
        {banners.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous banner"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/35"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button
              onClick={next}
              aria-label="Next banner"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/35"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </>
        )}

        {/* Dot indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
