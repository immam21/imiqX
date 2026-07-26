'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Props {
  images: string[]
  productName: string
}

export default function ProductImageGallery({ images, productName }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const imgs = images.length > 0 ? images : ['/placeholder.svg']

  const closeLightbox = useCallback(() => setLightboxOpen(false), [])
  const prevLb = useCallback(() => setLightboxIndex(i => (i - 1 + imgs.length) % imgs.length), [imgs.length])
  const nextLb = useCallback(() => setLightboxIndex(i => (i + 1) % imgs.length), [imgs.length])

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') prevLb()
      if (e.key === 'ArrowRight') nextLb()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen, closeLightbox, prevLb, nextLb])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxOpen])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) diff > 0 ? nextLb() : prevLb()
    touchStartX.current = null
  }

  return (
    <>
      <div className="space-y-4">
        {/* Main image — click to open lightbox */}
        <button
          type="button"
          onClick={() => openLightbox(activeIndex)}
          className="group relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Open image fullscreen"
        >
          <div className="aspect-square overflow-hidden">
            <img
              src={imgs[activeIndex]}
              alt={productName}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
          {/* Zoom hint */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition group-hover:bg-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
            </svg>
            Tap to zoom
          </div>
        </button>

        {/* Thumbnail strip */}
        {imgs.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {imgs.slice(0, 6).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-slate-100 transition ${
                  i === activeIndex
                    ? 'border-accent shadow-md shadow-accent/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                aria-label={`View image ${i + 1}`}
              >
                <img src={img} alt={`${productName} view ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox overlay ── */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/96"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>

          {/* Counter */}
          {imgs.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              {lightboxIndex + 1} / {imgs.length}
            </div>
          )}

          {/* Image */}
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              key={lightboxIndex}
              src={imgs[lightboxIndex]}
              alt={`${productName} — image ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain select-none"
              draggable={false}
            />
          </div>

          {/* Prev / Next arrows */}
          {imgs.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevLb() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
                aria-label="Previous image"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextLb() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
                aria-label="Next image"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </>
          )}

          {/* Dot indicators */}
          {imgs.length > 1 && (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
              {imgs.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
                  className={`h-2 rounded-full transition-all duration-300 ${i === lightboxIndex ? 'w-6 bg-white' : 'w-2 bg-white/35 hover:bg-white/60'}`}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
