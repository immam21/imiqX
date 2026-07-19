"use client"

import { useState, useEffect } from 'react'
import { useCart } from '../../hooks/useCart'
import { MapPin, CreditCard, CheckCircle2, Loader2 } from 'lucide-react'

const STEPS = ['Cart', 'Shipping', 'Confirm']

function CheckoutForm() {
  const { items, subtotal, clear } = useCart()
  const [deliveryCharge, setDeliveryCharge] = useState(40)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [door, setDoor] = useState('')
  const [fullAddress, setFullAddress] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [loading, setLoading] = useState(false)
  const [waLink, setWaLink] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => { if (typeof data.deliveryCharge === 'number') setDeliveryCharge(data.deliveryCharge) })
      .catch(() => {})
  }, [])

  const sendOrder = async () => {
    if (!name || !phone || items.length === 0) return alert('Please fill required fields and add items')
    setLoading(true)
    const order = {
      CustomerName: name,
      CustomerMobile: phone,
      DoorNumber: door,
      FullAddress: fullAddress,
      City: city,
      Pincode: pincode,
      ProductsJSON: JSON.stringify(items.map((i) => ({ name: i.name, qty: i.qty, price: i.price }))),
      Subtotal: subtotal,
      DeliveryCharge: deliveryCharge,
      GrandTotal: subtotal + deliveryCharge,
      OrderStatus: 'Pending',
      WhatsAppSent: false
    }

    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) })
      const data = await res.json()
      if (data.waLink) {
        clear()
        setWaLink(data.waLink)
      } else {
        alert('Failed to create order')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 animate-fade-up">
      {/* ── Success screen ── */}
      {waLink && (
        <div className="mx-auto max-w-md text-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={30} className="text-emerald-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Order placed!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your order has been saved. Tap the button below to send it via WhatsApp and confirm delivery.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-6 py-4 text-sm font-bold text-white shadow-md shadow-[#25D366]/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#25D366]/30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
              Send order on WhatsApp
            </a>
            <a href="/" className="mt-3 block text-xs text-slate-400 hover:text-slate-600 transition">
              ← Back to home
            </a>
          </div>
        </div>
      )}

      {/* ── Checkout form ── */}
      {!waLink && (
      <>
      <div className="mb-10 flex items-center justify-center">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                  i <= 1
                    ? 'bg-accent text-white shadow-md shadow-accent/25'
                    : 'border-2 border-slate-200 bg-white text-slate-400'
                }`}
              >
                {i < 1 ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span className={`mt-1.5 text-[11px] font-semibold ${i <= 1 ? 'text-accent' : 'text-slate-400'}`}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-3 mb-4 h-0.5 w-12 sm:w-20 transition ${i < 1 ? 'bg-accent' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-5">
          {/* Shipping details */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <MapPin size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Shipping details</h2>
                <p className="text-xs text-slate-400">Where should we deliver your order?</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full name *</label>
                  <input className="input-field" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone number *</label>
                  <input className="input-field" placeholder="Enter your phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Door number</label>
                  <input className="input-field" placeholder="Flat / Door no." value={door} onChange={(e) => setDoor(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">City</label>
                  <input className="input-field" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full address</label>
                <textarea
                  className="input-field resize-none"
                  placeholder="Street, Area, Landmark..."
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pincode</label>
                <input className="input-field" placeholder="6-digit pincode" maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CreditCard size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Payment method</h2>
                <p className="text-xs text-slate-400">How you'll pay for your order</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-4 rounded-2xl border-2 border-accent/20 bg-accent/5 p-4">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-white">
                  <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">WhatsApp confirmation</p>
                  <p className="mt-1 text-xs text-slate-500">Complete your order via WhatsApp. No card required.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-60">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white" />
                <div>
                  <p className="text-sm font-bold text-slate-400">Online payment</p>
                  <p className="mt-1 text-xs text-slate-400">Coming soon — UPI, credit/debit cards.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Order summary */}
        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-bold text-slate-900">Order summary</h2>

            <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <img src={item.image ?? '/placeholder.svg'} alt={item.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">Qty: {item.qty}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-900">₹{item.price * item.qty}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3">
              <span className="text-base">🚚</span>
              <p className="text-xs font-medium text-slate-600">Estimated delivery: 1–3 business days</p>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-semibold text-slate-900">₹{subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery</span>
                <span className="font-semibold text-slate-900">₹{deliveryCharge}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount</span>
                <span className="font-semibold text-emerald-600">₹0</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-base font-bold text-slate-900">Total</span>
              <span className="text-xl font-extrabold text-slate-900">₹{subtotal + deliveryCharge}</span>
            </div>

            <button
              onClick={sendOrder}
              disabled={loading}
              className={`mt-5 w-full rounded-2xl px-5 py-4 text-sm font-bold text-white transition-all duration-200 ${
                loading
                  ? 'cursor-not-allowed bg-slate-300'
                  : 'bg-gradient-to-r from-accent to-blue-600 shadow-md shadow-accent/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin-slow" />
                  Preparing WhatsApp...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                  Confirm via WhatsApp
                </span>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">🔒 Secure · No card details stored</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Need help?</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">Questions about your order? Contact our support team anytime.</p>
            <button className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              Chat with support
            </button>
          </div>
        </aside>
      </div>
      </>
      )}
    </div>
  )
}

export default function CheckoutPage() {
  return <CheckoutForm />
}
