'use client'

import { useState } from 'react'
import { PackageSearch, Package, Truck, CheckCircle2, Clock, XCircle, Loader2, Search, MapPin, ChevronRight } from 'lucide-react'

type OrderProduct = { name: string; qty: number; price: number }

type OrderData = {
  orderId: string
  date: string
  customerName: string
  status: string
  subtotal: string
  deliveryCharge: string
  grandTotal: string
  address: string
  products: OrderProduct[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; step: number }> = {
  Pending:    { label: 'Order Placed',  color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   icon: <Clock size={18} />,        step: 1 },
  Processing: { label: 'Processing',    color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     icon: <Package size={18} />,      step: 2 },
  Shipped:    { label: 'Shipped',       color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', icon: <Truck size={18} />,        step: 3 },
  Delivered:  { label: 'Delivered',     color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200',icon: <CheckCircle2 size={18} />, step: 4 },
  Cancelled:  { label: 'Cancelled',     color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       icon: <XCircle size={18} />,      step: 0 },
}

const STEPS = [
  { label: 'Placed',    icon: <Clock size={14} /> },
  { label: 'Processing',icon: <Package size={14} /> },
  { label: 'Shipped',   icon: <Truck size={14} /> },
  { label: 'Delivered', icon: <CheckCircle2 size={14} /> },
]

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<OrderData | null>(null)
  const [error, setError] = useState('')

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setOrder(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/track-order?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      setOrder(data.order)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = order ? (STATUS_CONFIG[order.status] ?? STATUS_CONFIG.Pending) : null

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">

      {/* Page header */}
      <div className="mb-8 animate-fade-up">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
          <PackageSearch size={24} className="text-accent" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Track Your Order</h1>
        <p className="mt-1.5 text-sm text-slate-500">Enter your order ID and phone number to see the latest status.</p>
      </div>

      {/* Search form */}
      <div className="animate-fade-up stagger-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <form onSubmit={handleTrack} className="space-y-4">
          <div>
            <label htmlFor="orderNumber" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Order Number
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                <Package size={15} />
              </div>
              <input
                id="orderNumber"
                type="text"
                placeholder="e.g. O1752912345678"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
                className="input-field pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Phone Number
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                <Search size={15} />
              </div>
              <input
                id="phone"
                type="tel"
                placeholder="e.g. 917092244494"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="input-field pl-10"
                autoComplete="tel"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Use the same number you provided at checkout (with country code).</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <><Loader2 size={15} className="animate-spin" /> Tracking…</>
            ) : (
              <><PackageSearch size={15} /> Track Order</>
            )}
          </button>
        </form>
      </div>

      {/* Order result */}
      {order && statusConfig && (
        <div className="mt-6 animate-fade-up space-y-4">

          {/* Status banner */}
          <div className={`flex items-center gap-4 rounded-3xl border p-5 ${statusConfig.bg}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${statusConfig.color} bg-white/80 shadow-sm`}>
              {statusConfig.icon}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order #{order.orderId}</p>
              <p className={`mt-0.5 text-lg font-extrabold ${statusConfig.color}`}>{statusConfig.label}</p>
            </div>
            <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${statusConfig.color} bg-white/70`}>
              {order.status}
            </span>
          </div>

          {/* Progress stepper (not shown for Cancelled) */}
          {order.status !== 'Cancelled' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                {STEPS.map((step, i) => {
                  const stepNum = i + 1
                  const active = stepNum <= statusConfig.step
                  const current = stepNum === statusConfig.step
                  return (
                    <div key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs transition-all ${
                        active
                          ? current
                            ? 'border-accent bg-accent text-white shadow-md shadow-accent/30'
                            : 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}>
                        {active && !current ? <CheckCircle2 size={14} /> : step.icon}
                      </div>
                      <span className={`text-[10px] font-semibold ${active ? 'text-slate-700' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                      {i < STEPS.length - 1 && (
                        <div className={`absolute mt-4 hidden h-0.5 w-full sm:block ${active ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Order details */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-bold text-slate-900">Order Details</h3>

            {/* Items */}
            <div className="space-y-3">
              {order.products.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Package size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-400">Qty: {p.qty}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-900">₹{p.price}</p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span><span>₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery</span><span>₹{order.deliveryCharge}</span>
              </div>
              <div className="flex justify-between font-extrabold text-slate-900 text-base pt-1">
                <span>Total</span><span>₹{order.grandTotal}</span>
              </div>
            </div>
          </div>

          {/* Delivery info */}
          {order.address && (
            <div className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <MapPin size={16} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Address</p>
                <p className="mt-1 text-sm text-slate-700 leading-5">{order.address}</p>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
            <ChevronRight size={12} />
            Ordered on {new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      )}
    </div>
  )
}
