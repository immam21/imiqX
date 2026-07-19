'use client'

import Link from 'next/link'
import { Heart, Star } from 'lucide-react'

type Product = {
  productId: string
  name: string
  brand?: string
  category?: string
  image?: string
  images?: string[]
  offerPrice: number
  price: number
  discount?: number
  description?: string
}

function Stars({ count = 4 }: { count?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={11}
          className={i <= count ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
        />
      ))}
    </div>
  )
}

export default function ProductCard({ product }: { product: Product }) {
  const imageSrc = product.image ?? product.images?.[0] ?? '/placeholder.svg'
  const hasDiscount = !!(product.discount && product.discount > 0)
  const savings = hasDiscount ? Math.round(product.price - product.offerPrice) : 0

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-hover hover:border-slate-300 animate-fade-up">
      <Link href={`/product/${product.productId}`} className="flex flex-1 flex-col">

        {/* ── Image ── */}
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <img
            src={imageSrc}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-slate-900/0 transition-all duration-300 group-hover:bg-slate-900/8" />

          {/* Discount badge */}
          {hasDiscount ? (
            <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              {product.discount}% OFF
            </span>
          ) : product.category ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
              {product.category}
            </span>
          ) : null}

          {/* Wishlist */}
          <button
            aria-label="Add to wishlist"
            onClick={(e) => e.preventDefault()}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-300 opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 hover:text-rose-500 group-hover:opacity-100 focus:opacity-100"
          >
            <Heart size={14} />
          </button>

          {/* Quick-view pill */}
          <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex items-center justify-center rounded-xl bg-white/95 py-2.5 text-[12px] font-semibold text-slate-900 shadow-md backdrop-blur-sm">
              Quick view →
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex flex-1 flex-col p-4">
          {/* Meta */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>{product.brand ?? 'Premium'}</span>
            {product.category && (
              <>
                <span className="text-slate-200">·</span>
                <span>{product.category}</span>
              </>
            )}
          </div>

          {/* Name */}
          <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-accent">
            {product.name}
          </h3>

          {/* Stars */}
          <div className="mt-2 flex items-center gap-2">
            <Stars count={4} />
            <span className="text-[11px] text-slate-400">4.5 (128)</span>
          </div>

          {/* Price */}
          <div className="mt-auto pt-3 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-extrabold text-slate-900">₹{product.offerPrice}</span>
                {hasDiscount && (
                  <span className="text-sm text-slate-400 line-through">₹{product.price}</span>
                )}
              </div>
              {savings > 0 && (
                <p className="text-[11px] font-semibold text-emerald-600">Save ₹{savings}</p>
              )}
            </div>
            <span className="shrink-0 rounded-xl bg-accent/10 px-3 py-1.5 text-[12px] font-bold text-accent transition-all group-hover:bg-accent group-hover:text-white">
              Buy
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
