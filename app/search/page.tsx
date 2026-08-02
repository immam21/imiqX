"use client"

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, Check, Star, LayoutGrid, List, Sparkles, ShieldCheck, Truck, BadgePercent, RotateCcw } from 'lucide-react'

const PAGE_SIZE = 10

function getTenantPrefix() {
  if (typeof document === 'undefined') return ''
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('tenant_path_prefix='))
    ?.split('=')[1]
  const prefix = decodeURIComponent(raw || '').trim()
  return prefix && prefix !== '/' ? prefix : ''
}

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [sortBy, setSortBy] = useState('featured')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [quickFilter, setQuickFilter] = useState<'all' | 'deals' | 'top_rated' | 'under_2000' | 'new_arrivals'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [tenantPrefix, setTenantPrefix] = useState('')

  const route = (path: string) => `${tenantPrefix}${path}`

  useEffect(() => {
    setTenantPrefix(getTenantPrefix())
  }, [])

  useEffect(() => {
    let mounted = true
    const apiPath = tenantPrefix ? `${tenantPrefix}/api/products` : '/api/products'
    fetch(apiPath)
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setProducts(data.products || [])
      })
    return () => {
      mounted = false
    }
  }, [tenantPrefix])

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category || 'Uncategorized'))).slice(0, 12), [products])

  const quickFilters = [
    { key: 'all' as const, label: 'All products', icon: Sparkles },
    { key: 'deals' as const, label: 'Best deals', icon: BadgePercent },
    { key: 'top_rated' as const, label: 'Top rated', icon: Star },
    { key: 'under_2000' as const, label: 'Under ₹2,000', icon: Check },
    { key: 'new_arrivals' as const, label: 'New arrivals', icon: Sparkles },
  ]

  const filtered = useMemo(() => {
    const query = q.toLowerCase()
    return products.filter((p: any) => {
      const matchesQuery = !query || (p.name || '').toLowerCase().includes(query) || (p.brand || '').toLowerCase().includes(query)
      const matchesCategory = !selectedCategory || (p.category || 'Uncategorized') === selectedCategory

      const effectivePrice = Number(p.offerPrice ?? p.price ?? 0)
      const hasDeal = Number(p.discount ?? 0) > 0 || Number(p.price ?? 0) > Number(p.offerPrice ?? p.price ?? 0)
      const rating = Number(p.rating ?? 0)

      const matchesQuickFilter =
        quickFilter === 'all' ||
        (quickFilter === 'deals' && hasDeal) ||
        (quickFilter === 'top_rated' && rating >= 4) ||
        (quickFilter === 'under_2000' && effectivePrice > 0 && effectivePrice <= 2000) ||
        (quickFilter === 'new_arrivals' && /new|latest/i.test(String(p.category ?? '')))

      return matchesQuery && matchesCategory && matchesQuickFilter
    })
  }, [q, products, selectedCategory, quickFilter])

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

  const hasActiveFilters = !!(q || selectedCategory || quickFilter !== 'all')
  const clearAll = () => {
    setQ('')
    setSelectedCategory('')
    setQuickFilter('all')
    setCurrentPage(1)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [q, selectedCategory, quickFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sorted.slice(start, start + PAGE_SIZE)
  }, [sorted, currentPage])

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-sky-50/80 via-white to-cyan-50/50 pb-24 pt-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-24 h-96 w-96 rounded-full bg-cyan-300/35 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[26rem] w-[26rem] rounded-full bg-blue-200/35 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 animate-fade-up">

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">

          {/* ── Sidebar ── */}
          <aside className="h-fit rounded-3xl border border-cyan-100 bg-white/90 p-5 shadow-[0_18px_40px_rgba(8,47,73,0.08)] backdrop-blur-sm lg:sticky lg:top-28">
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
              <div className="max-h-[300px] space-y-1 overflow-auto pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${!selectedCategory ? 'bg-cyan-600/10 font-semibold text-cyan-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  All categories
                  {!selectedCategory && <Check size={13} />}
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory((cur) => (cur === category ? '' : category))}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedCategory === category ? 'bg-cyan-600/10 font-semibold text-cyan-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span>{category}</span>
                    {selectedCategory === category && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3.5 text-xs text-slate-600">
              <p className="mb-2 font-bold uppercase tracking-[0.18em] text-cyan-700">Trusted shopping</p>
              <div className="space-y-2">
                <p className="flex items-center gap-2"><ShieldCheck size={13} className="text-cyan-700" /> Secure checkout</p>
                <p className="flex items-center gap-2"><Truck size={13} className="text-cyan-700" /> Fast delivery support</p>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <RotateCcw size={14} />
                Reset all filters
              </button>
            )}
          </div>
          </aside>

          {/* ── Main content ── */}
          <main className="space-y-5">
          {/* Search + sort bar */}
          <div className="rounded-3xl border border-cyan-100 bg-white/95 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
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
                <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    className={`flex h-9 w-10 items-center justify-center transition ${
                      viewMode === 'grid' ? 'bg-accent text-white' : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <span className="h-5 w-px bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    className={`flex h-9 w-10 items-center justify-center transition ${
                      viewMode === 'list' ? 'bg-accent text-white' : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {q && (
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
                    Search: {q}
                  </span>
                )}
                {selectedCategory && (
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
                    Category: {selectedCategory}
                  </span>
                )}
                {quickFilter !== 'all' && (
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
                    Filter: {quickFilters.find((item) => item.key === quickFilter)?.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Product grid */}
          {sorted.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-cyan-200 bg-white/90 p-14 text-center shadow-[0_12px_32px_rgba(14,116,144,0.08)]">
              <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Search size={30} />
              </div>
              <h3 className="text-lg font-bold text-slate-700">No matching products yet</h3>
              <p className="mt-2 text-sm text-slate-500">Try another keyword, switch category, or reset filters to view all products.</p>
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="mt-5 rounded-full border border-cyan-200 bg-cyan-50 px-5 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
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
              {pagedProducts.map((p: any) => (
                viewMode === 'list' ? (
                  /* ── LIST CARD ── */
                  <Link
                    key={p.productId}
                    href={route(`/product/${p.productId}`)}
                    className="group flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-hover"
                  >
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden bg-slate-100 sm:h-36 sm:w-36">
                      <img
                        src={p.images?.[0] ?? '/placeholder.svg'}
                        alt={p.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
                        <h2 className="mt-1 line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-cyan-700">
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
                        <div className="rounded-xl bg-cyan-100 px-3 py-1.5 text-xs font-bold text-cyan-700 transition-all group-hover:bg-cyan-700 group-hover:text-white">
                          Buy now
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  /* ── GRID CARD ── */
                  <Link
                    key={p.productId}
                    href={route(`/product/${p.productId}`)}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-hover"
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
                        <div className="rounded-xl bg-cyan-100 px-2 py-1 text-[10px] font-bold text-cyan-700 transition-all group-hover:bg-cyan-700 group-hover:text-white sm:px-3 sm:py-1.5 sm:text-xs">
                          Buy now
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              ))}
            </div>
          )}

          {sorted.length > 0 && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-cyan-100 bg-white/90 p-3.5 shadow-sm">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`h-9 min-w-[36px] rounded-lg px-2 text-xs font-bold transition ${
                    currentPage === page
                      ? 'bg-accent text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
          </main>
        </div>
      </div>
    </div>
  )
}
