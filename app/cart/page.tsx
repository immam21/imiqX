"use client"

import { useState, useEffect } from 'react'
import { useCart } from '../../hooks/useCart'
import type { CartItem } from '../../hooks/useCart'
import { ShoppingCart, Trash2, Minus, Plus, ArrowRight, MoveLeft } from 'lucide-react'

function getTenantPrefix() {
  if (typeof document === 'undefined') return ''
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('tenant_path_prefix='))
    ?.split('=')[1]
  const prefix = decodeURIComponent(raw || '').trim()
  return prefix && prefix !== '/' ? prefix : ''
}

function couponStorageKey(prefix: string) {
  return prefix ? `miqx_coupon_v1:${prefix.toLowerCase()}` : 'miqx_coupon_v1'
}

function CartView() {
  const { items, updateQty, removeItem, subtotal } = useCart()
  const [deliveryCharge, setDeliveryCharge] = useState(40)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: string; value: number; discountAmount: number } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [tenantPrefix, setTenantPrefix] = useState('')
  const [couponsEnabled, setCouponsEnabled] = useState(true)

  useEffect(() => {
    const prefix = getTenantPrefix()
    setTenantPrefix(prefix)
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.deliveryCharge === 'number') setDeliveryCharge(data.deliveryCharge)
        const enabled = data?.subscription?.features?.coupons !== false
        setCouponsEnabled(enabled)
        if (!enabled) {
          setAppliedCoupon(null)
          try { localStorage.removeItem(couponStorageKey(prefix)) } catch {}
        }
      })
      .catch(() => {})
    try {
      const saved = localStorage.getItem(couponStorageKey(prefix))
      if (saved) setAppliedCoupon(JSON.parse(saved))
    } catch {}
  }, [])

  const applyCoupon = async () => {
    if (!couponsEnabled) return
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const res = await fetch(`/api/coupons?code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (!res.ok) { setCouponError(data.error || 'Invalid coupon'); return }
      const { coupon } = data
      if (coupon.minOrder && subtotal < coupon.minOrder) {
        setCouponError(`Minimum order of ₹${coupon.minOrder} required`); return
      }
      const discountAmount = coupon.type === 'percent'
        ? Math.floor(subtotal * coupon.value / 100)
        : Math.min(coupon.value, subtotal)
      const applied = { code: coupon.code, type: coupon.type, value: coupon.value, discountAmount }
      setAppliedCoupon(applied)
      localStorage.setItem(couponStorageKey(tenantPrefix), JSON.stringify(applied))
      setCouponCode('')
    } catch {
      setCouponError('Failed to apply coupon')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    localStorage.removeItem(couponStorageKey(tenantPrefix))
  }

  if (items.length === 0)
    return (
      <div className="theme-aurora relative min-h-screen overflow-hidden px-4 pb-28 pt-12 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-300/20 blur-[90px]" />
          <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-sky-300/20 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-2xl">
        <div className="glass-surface rounded-3xl border border-dashed border-slate-200 p-16 shadow-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
            <ShoppingCart className="text-slate-400" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Your cart is empty</h1>
          <p className="mt-2 text-sm text-slate-500">Looks like you haven't added anything yet.</p>
          <a
            href={`${tenantPrefix}/`}
            className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-accent/25 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Continue shopping
            <ArrowRight size={15} />
          </a>
        </div>
        </div>
      </div>
    )

  return (
    <div className="theme-aurora relative min-h-screen overflow-hidden pb-32 pt-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-8 h-96 w-96 rounded-full bg-cyan-300/20 blur-[100px]" />
        <div className="absolute right-0 top-24 h-[28rem] w-[28rem] rounded-full bg-blue-200/25 blur-[110px]" />
      </div>
    <div className="relative mx-auto max-w-7xl px-4 sm:px-6 animate-fade-up">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Shopping bag</p>
          <h1 className="mt-1.5 text-3xl font-extrabold text-slate-900">Review your items</h1>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
          <ShoppingCart size={15} className="text-slate-400" />
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_0.85fr]">
        {/* Cart items */}
        <div className="space-y-4">
          {items.map((it: CartItem) => (
            <div key={it.productId} className="glass-surface overflow-hidden rounded-3xl border border-cyan-100 shadow-card transition-all animate-pop hover:shadow-hover">
              <div className="grid gap-4 p-5 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start">
                <div className="overflow-hidden rounded-2xl bg-slate-100">
                  <img
                    src={it.image ?? '/placeholder.svg'}
                    alt={it.name}
                    className="h-24 w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{it.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-400">Sold by the store</p>
                    </div>
                    <button
                      onClick={() => removeItem(it.productId)}
                      aria-label={`Remove ${it.name}`}
                      className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    {/* Quantity control */}
                    <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <button
                        onClick={() => updateQty(it.productId, it.qty - 1)}
                        aria-label="Decrease quantity"
                        className="flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="flex h-9 min-w-[40px] items-center justify-center border-x border-slate-200 text-sm font-bold text-slate-900">
                        {it.qty}
                      </span>
                      <button
                        onClick={() => updateQty(it.productId, it.qty + 1)}
                        aria-label="Increase quantity"
                        className="flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    {/* Price */}
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">₹{it.price} × {it.qty}</p>
                      <p className="text-base font-extrabold text-slate-900">₹{it.price * it.qty}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="glass-surface rounded-3xl border border-cyan-100 p-6 shadow-sm">
            <h2 className="mb-5 text-base font-bold text-slate-900">Order summary</h2>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Items ({items.length})</span>
                <span className="font-semibold text-slate-900">₹{subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery</span>
                <span className="font-semibold text-slate-900">₹{deliveryCharge}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount</span>
                <span className="font-semibold text-emerald-600">−₹{couponsEnabled ? (appliedCoupon?.discountAmount ?? 0) : 0}</span>
              </div>
            </div>

            {/* Coupon input */}
            <div className="mt-4">
              {!couponsEnabled ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                  <p className="text-xs font-semibold text-amber-700">Coupons are not available in your current plan.</p>
                </div>
              ) : appliedCoupon ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-emerald-700">🎉 Coupon applied: {appliedCoupon.code}</p>
                    <p className="text-[11px] text-emerald-600">
                      {appliedCoupon.type === 'percent' ? `${appliedCoupon.value}% off` : `₹${appliedCoupon.value} off`} · You save ₹{appliedCoupon.discountAmount}
                    </p>
                  </div>
                  <button onClick={removeCoupon} className="ml-3 text-xs font-semibold text-emerald-600 underline hover:text-emerald-800">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/15 placeholder:normal-case placeholder:text-slate-400"
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {couponLoading ? '…' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && <p className="mt-1.5 text-xs font-medium text-red-500">{couponError}</p>}
            </div>

            <div className="my-4 h-px bg-slate-100" />
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">Total</span>
              <span className="text-xl font-extrabold text-slate-900">₹{subtotal + deliveryCharge - (couponsEnabled ? (appliedCoupon?.discountAmount ?? 0) : 0)}</span>
            </div>
            <a
              href={`${tenantPrefix}/checkout`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-blue-600 px-5 py-4 text-sm font-bold text-white shadow-md shadow-accent/25 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30"
            >
              Proceed to checkout
              <ArrowRight size={15} />
            </a>
            <a href={`${tenantPrefix}/`} className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-slate-900">
              <MoveLeft size={13} /> Continue shopping
            </a>
          </div>

          <div className="glass-surface rounded-3xl border border-cyan-100 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Need help?</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">Contact our team for order changes, gift wrap, or faster delivery.</p>
            <button className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              Chat with support
            </button>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2.5">
            {[{ e: '🔒', t: 'Secure' }, { e: '🚚', t: 'Fast ship' }, { e: '↩️', t: 'Returns' }].map(({ e, t }) => (
              <div key={t} className="glass-surface flex flex-col items-center gap-1.5 rounded-2xl border border-cyan-100 py-4">
                <span className="text-lg">{e}</span>
                <span className="text-[10px] font-semibold text-slate-500">{t}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Mobile sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4 sm:hidden">
        <div className="glass-surface overflow-hidden rounded-3xl border border-cyan-100 shadow-2xl">
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-extrabold text-slate-900">₹{subtotal + deliveryCharge - (appliedCoupon?.discountAmount ?? 0)}</p>
            </div>
            <a
              href={`${tenantPrefix}/checkout`}
              className="rounded-2xl bg-gradient-to-r from-accent to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-95"
            >
              Checkout
            </a>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

export default function CartPage() {
  return <CartView />
}
