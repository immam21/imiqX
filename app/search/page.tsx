"use client"

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [sortBy, setSortBy] = useState('featured')

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
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 animate-fade-up">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Filters</div>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Category</p>
              <div className="mt-3 space-y-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory((current) => (current === category ? '' : category))}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${selectedCategory === category ? 'border-accent bg-accent/10 text-accent' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                  >
                    <span>{category}</span>
                    {selectedCategory === category ? <span className="text-xs uppercase tracking-[0.24em]">Selected</span> : null}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Top sellers</p>
              <div className="mt-3 space-y-2">
                {['Best rated', 'Under ₹2,000', 'New arrivals'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Search products</p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">Find the best product for your needs</h1>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{sorted.length} results</div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="featured">Featured</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="rating">Top rated</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by product name, brand or category"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:max-w-xl"
              />
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
              No products match your search yet. Try another keyword or category.
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((p: any) => (
                <Link
                  key={p.productId}
                  href={`/product/${p.productId}`}
                  className="group block overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 shadow-sm transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="grid gap-3 px-4 py-4 md:grid-cols-[120px_minmax(0,1fr)_180px] lg:px-5">
                    <div className="overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-100 via-white to-slate-50">
                      <img src={p.images?.[0] ?? '/placeholder.svg'} alt={p.name} className="h-32 w-full object-cover" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span className="font-semibold text-slate-900">{p.brand || 'Trusted brand'}</span>
                        <span className="rounded-full border border-slate-200 px-2 py-1 text-xs uppercase tracking-[0.24em] text-slate-500">{p.category || 'Category'}</span>
                      </div>
                      <h2 className="text-base font-semibold leading-6 text-slate-900">{p.name}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1 text-amber-600">★ {p.rating ?? '4.5'}</span>
                        <span>{p.stock ? `${p.stock} in stock` : 'Out of stock'}</span>
                        <span className="text-slate-400">50+ bought in past month</span>
                      </div>
                      <p className="text-sm leading-6 text-slate-600 line-clamp-2">{p.description ?? 'Shop this item with fast delivery and easy returns.'}</p>
                      <div className="grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                          <span className="text-xs uppercase tracking-[0.28em] text-slate-500">Prime</span>
                          <span>FREE Delivery</span>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-emerald-700">
                          <span>Save {p.discount ?? 0}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-3 text-right">
                      <div>
                        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Price</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">₹{p.offerPrice ?? p.price}</p>
                        {p.discount ? <p className="text-sm line-through text-slate-400">₹{p.price}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white">View details</div>
                        <div className="text-xs text-slate-500">Secure checkout · Easy returns</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
