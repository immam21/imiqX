'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LayoutGrid, List, MessageCircle, ShoppingCart, Star } from 'lucide-react'
import type { Product } from '../../types'

interface FeaturedProductsGridProps {
  products: Product[]
  routePrefix?: string
  businessType?: 'ecommerce_product' | 'ecommerce_services'
}

export default function FeaturedProductsGrid({ products, routePrefix = '', businessType = 'ecommerce_product' }: FeaturedProductsGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const route = (path: string) => `${routePrefix}${path}`
  const firstImage = (product: any) => product.images?.find(Boolean) ?? product.image ?? '/placeholder.svg'
  const isServiceBusiness = businessType === 'ecommerce_services'

  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center">
        <div className="mb-4 text-5xl">📦</div>
        <h3 className="text-lg font-bold text-slate-700">No products yet</h3>
        <p className="mt-2 text-sm text-slate-500">We are curating products for you. Please check back shortly for new arrivals.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Toggle bar */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{products.length} products</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Secure checkout enabled</p>
        </div>
        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={`flex h-9 w-9 items-center justify-center transition ${
              viewMode === 'grid' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={`flex h-9 w-9 items-center justify-center transition ${
              viewMode === 'list' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className={viewMode === 'grid'
        ? 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4'
        : 'grid grid-cols-1 gap-3'
      }>
        {products.map((p: any, i) => (
          viewMode === 'list' ? (
            /* ── LIST CARD ── */
            <Link
              key={p.productId}
              href={route(`/product/${p.productId}`)}
              className={`card-3d group flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all hover:border-slate-300 hover:shadow-hover stagger-${Math.min(i + 1, 5)}`}
            >
              <div className="relative w-28 shrink-0 overflow-hidden bg-slate-100 sm:w-36">
                <img
                  src={firstImage(p)}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {p.discount ? (
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {p.discount}% OFF
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {p.brand ?? ''}{p.brand && p.category ? ' · ' : ''}{p.category ?? ''}
                  </div>
                  <h2 className="mt-1 line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-accent">
                    {p.name}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-1">
                    {[1,2,3,4,5].map((j) => (
                      <Star key={j} size={9} className={j <= Math.floor(p.rating ?? 4.5) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'} />
                    ))}
                    <span className="ml-1 text-[10px] text-slate-400">{p.rating ?? '4.5'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-extrabold text-slate-900">₹{p.offerPrice ?? p.price}</p>
                    {p.discount ? <p className="text-[11px] text-slate-400 line-through">₹{p.price}</p> : null}
                  </div>
                  <div className="inline-flex min-w-[116px] items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-accent/35 transition-all group-hover:brightness-110">
                    {isServiceBusiness ? <MessageCircle size={13} /> : <ShoppingCart size={13} />}
                    {isServiceBusiness ? 'Enquire now' : 'Add to cart'}
                  </div>
                </div>
                <div className="mt-2 inline-flex w-max items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  <span>🛡️</span>
                  Trusted product
                </div>
              </div>
            </Link>
          ) : (
            /* ── GRID CARD ── */
            <Link
              key={p.productId}
              href={route(`/product/${p.productId}`)}
              className={`card-3d group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-hover stagger-${Math.min(i + 1, 5)}`}
            >
              <div className="relative overflow-hidden bg-slate-100">
                <img
                  src={firstImage(p)}
                  alt={p.name}
                  className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48"
                />
                {p.discount ? (
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
                    {p.discount}% OFF
                  </span>
                ) : null}
              </div>
              <div className="p-3 sm:p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {p.brand ?? 'Brand'}{p.brand && p.category ? ' · ' : ''}{p.category ?? ''}
                </div>
                <h2 className="mt-1 line-clamp-2 text-xs font-bold text-slate-900 group-hover:text-accent sm:text-sm">
                  {p.name}
                </h2>
                <div className="mt-1.5 flex items-center gap-1">
                  {[1,2,3,4,5].map((j) => (
                    <Star key={j} size={9} className={j <= Math.floor(p.rating ?? 4.5) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'} />
                  ))}
                  <span className="ml-1 text-[10px] text-slate-400">{p.rating ?? '4.5'}</span>
                </div>
                <div className="mt-2.5 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900 sm:text-lg">₹{p.offerPrice ?? p.price}</p>
                    {p.discount ? <p className="text-[10px] text-slate-400 line-through sm:text-xs">₹{p.price}</p> : null}
                  </div>
                  <div className="inline-flex min-w-[106px] items-center justify-center gap-1 rounded-xl bg-accent px-2 py-1 text-[10px] font-bold text-white shadow-sm ring-1 ring-accent/35 transition-all group-hover:brightness-110 sm:min-w-[116px] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
                    {isServiceBusiness ? <MessageCircle size={12} /> : <ShoppingCart size={12} />}
                    {isServiceBusiness ? 'Enquire now' : 'Add to cart'}
                  </div>
                </div>
                <div className="mt-2 inline-flex w-max items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  <span>🔐</span>
                  Safe purchase
                </div>
              </div>
            </Link>
          )
        ))}
      </div>
    </div>
  )
}
