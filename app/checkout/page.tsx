"use client"

import { useState } from 'react'
import { useCart, CartProvider } from '../../hooks/useCart'

function CheckoutForm() {
  const { items, subtotal, clear } = useCart()
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  const sendOrder = async () => {
    if (!name || !mobile || items.length === 0) return alert('Please fill required fields and add items')
    setLoading(true)
    const order = {
      CustomerName: name,
      CustomerMobile: mobile,
      FullAddress: address,
      ProductsJSON: JSON.stringify(items.map((i) => ({ name: i.name, qty: i.qty, price: i.price }))),
      Subtotal: subtotal,
      DeliveryCharge: 40,
      GrandTotal: subtotal + 40,
      OrderStatus: 'Pending',
      WhatsAppSent: false
    }

    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) })
      const data = await res.json()
      if (data.waLink) {
        clear()
        window.location.href = data.waLink
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
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 animate-fade-up">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Checkout</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Secure your order</h1>
              <p className="mt-2 text-sm text-slate-600">Fill in your details and confirm via WhatsApp in one smooth flow.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <input className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <textarea className="mt-4 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Full address" value={address} onChange={(e) => setAddress(e.target.value)} rows={5} />
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Payment options</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">WhatsApp confirmation</p>
                <p className="mt-2 text-sm text-slate-600">We will send your order details to WhatsApp for final confirmation.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Secure order</p>
                <p className="mt-2 text-sm text-slate-600">No cards are stored on this site. All final checkout happens through your WhatsApp app.</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Order summary</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{items.length} items in cart</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">Ready</div>
            </div>

            <div className="mt-6 space-y-3">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                  <img src={item.image ?? '/placeholder.svg'} alt={item.name} className="h-16 w-16 rounded-2xl object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-600">Qty {item.qty}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">₹{item.price * item.qty}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[28px] bg-slate-50 p-4 text-sm text-slate-600">
              Delivery time estimate: 1-2 business days.
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery</span>
                <span>₹40</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Total</span>
                <span>₹{subtotal + 40}</span>
              </div>
            </div>

            <button onClick={sendOrder} disabled={loading} className="mt-5 w-full rounded-full bg-accent px-5 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400">
              {loading ? 'Preparing WhatsApp...' : 'Confirm via WhatsApp'}
            </button>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">Need help?</h3>
            <p className="mt-3 text-sm text-slate-600">Questions about delivery, product details, or order status? Our support team is ready to help.</p>
            <button className="mt-5 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Contact support</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <CartProvider>
      <CheckoutForm />
    </CartProvider>
  )
}
