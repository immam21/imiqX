"use client"

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, Check, Star, LayoutGrid, List } from 'lucide-react'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [sortBy, setSortBy] = useState('featured')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    let mounted = true
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setProducts(data.products || [])
      })
    return () => {
      mounted = false
    }
  }, [])

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category || 'Uncategorized'))).slice(0, 8), [products])

  const filtered = useMemo(() => {
    const query = q.toLowerCase()
    return products.filter((p: any) => {
      const matchesQuery = !query || (p.name || '').toLowerCase().includes(query) || (p.brand || '').toLowerCase().includes(query)
      const matchesCategory = !selectedCategory || (p.category || 'Uncategorized') === selectedCategory
      return matchesQuery && matchesCategory
    })
  }, [q, products, selectedCategory])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sortBy === 'price_low') {
      return list.sort((a, b) => (a.offerPrice ?? a.price) - (b.offerPrice ?? b.price))
    }
    if (sortBy === 'price_high') {
      return list.sort((a, b) => (b.offerPrice ?? b.price) - (a.offerPrice ?? a.price))
    }
    if (sortBy === 'rating') {
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    }
    return list
  }, [filtered, sortBy])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 animate-fade-up">
      {/* Page header */}
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Explore</p>
        <h1 className="mt-1.5 text-3xl font-extrabold text-slate-900">All products</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">

        {/* ── Sidebar ── */}
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Filters</span>
          </div>

          {/* Mobile search in sidebar */}
          <div className="relative mb-5 lg:hidden">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search size={13} />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/15"
            />
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2.5 text-xs font-bold text-slate-700">Category</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${!selectedCategory ? 'bg-accent/10 font-semibold text-accent' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  All categories
                  {!selectedCategory && <Check size={13} />}
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory((cur) => (cur === category ? '' : category))}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedCategory === category ? 'bg-accent/10 font-semibold text-accent' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span>{category}</span>
                    {selectedCategory === category && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2.5 text-xs font-bold text-slate-700">Quick filters</p>
              <div className="space-y-1">
                {['Best rated', 'Under ₹2,000', 'New arrivals'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="space-y-5">
          {/* Search + sort bar */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 hidden lg:block">
                <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                  <Search size={14} />
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search products, brands…"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/15"
                />
              </div>
              <div className="flex items-center gap-2.5 sm:ml-auto">
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                  {sorted.length} results
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                >
                  <option value="featured">Featured</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="rating">Top rated</option>
                </select>
                {/* View toggle */}
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
            </div>
          </div>

          {/* Product grid */}
          {sorted.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-14 text-center">
              <div className="mb-3 text-5xl">🔍</div>
              <h3 className="text-lg font-bold text-slate-700">No products found</h3>
              <p className="mt-2 text-sm text-slate-400">Try a different keyword or clear your filters.</p>
              {(q || selectedCategory) && (
                <button
                  onClick={() => { setQ(''); setSelectedCategory('') }}
                  className="mt-5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3'
              : 'grid grid-cols-1 gap-3'
            }>
              {sorted.map((p: any) => (
                viewMode === 'list' ? (
                  /* ── LIST CARD ── */
                  <Link
                    key={p.productId}
                    href={`/product/${p.productId}`}
                    className="group flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all hover:border-slate-300 hover:shadow-hover"
                  >
                    <div className="relative w-28 shrink-0 overflow-hidden bg-slate-100 sm:w-36">
                      <img
                        src={p.images?.[0] ?? '/placeholder.svg'}
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
                          {[1,2,3,4,5].map((i) => (
                            <Star key={i} size={9} className={i <= Math.floor(p.rating ?? 4.5) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'} />
                          ))}
                          <span className="ml-1 text-[10px] text-slate-400">{p.rating ?? '4.5'}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-extrabold text-slate-900">₹{p.offerPrice ?? p.price}</p>
                          {p.discount ? <p className="text-[11px] text-slate-400 line-through">₹{p.price}</p> : null}
                        </div>
                        <div className="rounded-xl bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition-all group-hover:bg-accent group-hover:text-white">
                          View →
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  /* ── GRID CARD ── */
                  <Link
                    key={p.productId}
                    href={`/product/${p.productId}`}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-hover"
                  >
                    <div className="relative overflow-hidden bg-slate-100">
                      <img
                        src={p.images?.[0] ?? '/placeholder.svg'}
                        alt={p.name}
                        className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-44"
                      />
                      {p.discount ? (
                        <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
                          {p.discount}% OFF
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <span>{p.brand ?? 'Brand'}</span>
                        {p.category && <><span>·</span><span>{p.category}</span></>}
                      </div>
                      <h2 className="mt-1 line-clamp-2 text-xs font-bold text-slate-900 transition-colors group-hover:text-accent sm:text-sm">
                        {p.name}
                      </h2>
                      <div className="mt-1.5 flex items-center gap-1">
                        {[1,2,3,4,5].map((i) => (
                          <Star key={i} size={9} className={i <= Math.floor(p.rating ?? 4.5) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'} />
                        ))}
                        <span className="ml-1 text-[10px] text-slate-400">{p.rating ?? '4.5'}</span>
                      </div>
                      <div className="mt-2.5 flex items-end justify-between">
                        <div>
                          <p className="text-sm font-extrabold text-slate-900 sm:text-lg">₹{p.offerPrice ?? p.price}</p>
                          {p.discount ? <p className="text-[10px] text-slate-400 line-through sm:text-xs">₹{p.price}</p> : null}
                        </div>
                        <div className="rounded-xl bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent transition-all group-hover:bg-accent group-hover:text-white sm:px-3 sm:py-1.5 sm:text-xs">
                          View →
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
