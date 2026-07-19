"use client"

import { useCart, CartProvider } from '../../hooks/useCart'

function CartView() {
  const { items, updateQty, removeItem, subtotal } = useCart()

  if (items.length === 0)
    return (
      <div className="mx-auto max-w-3xl px-4 pt-24 pb-28 text-center">
        <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-10 shadow-sm">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Your cart</p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">Nothing in your cart yet</h1>
          <p className="mt-3 text-sm text-slate-600">Add products to your cart and they will appear here for a smooth checkout.</p>
          <a href="/" className="mt-8 inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
            Continue shopping
          </a>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 animate-fade-up">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Shopping cart</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Review your items</h1>
          <p className="mt-2 text-sm text-slate-600">Update quantities, remove items, and proceed to checkout in one place.</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {items.length} item{items.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
        <div className="space-y-4">
          {items.map((it) => (
            <li key={it.productId} className="list-none rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm animate-pop">
              <div className="grid gap-4 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center">
                <div className="overflow-hidden rounded-3xl bg-slate-100">
                  <img src={it.image ?? '/placeholder.svg'} alt={it.name} className="h-28 w-full object-cover" />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{it.name}</p>
                      <p className="text-sm text-slate-500">Sold by ImiqX Marketplace</p>
                    </div>
                    <button className="text-sm font-semibold text-red-500 transition hover:text-red-600" onClick={() => removeItem(it.productId)}>
                      Remove
                    </button>
                  </div>
                  <p className="text-sm text-slate-600">₹{it.price} x {it.qty} = <span className="font-semibold text-slate-900">₹{it.price * it.qty}</span></p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <button className="rounded-full px-2 text-xl" onClick={() => updateQty(it.productId, it.qty - 1)}>-</button>
                    <span className="min-w-[32px] text-center font-semibold">{it.qty}</span>
                    <button className="rounded-full px-2 text-xl" onClick={() => updateQty(it.productId, it.qty + 1)}>+</button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
            <div className="mt-6 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Items ({items.length})</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery</span>
                <span>₹40</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount</span>
                <span className="text-emerald-600">₹0</span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-semibold text-slate-900">
              <span>Total</span>
              <span>₹{subtotal + 40}</span>
            </div>
            <a href="/checkout" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
              Continue to checkout
            </a>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Need help?</h3>
            <p className="mt-3 text-sm text-slate-600">Contact support for order changes, gift wrap, or faster delivery assistance.</p>
            <button className="mt-4 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Chat with support</button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-7xl justify-center px-4 pb-4 sm:hidden">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-xl font-semibold text-slate-900">₹{subtotal + 40}</p>
            </div>
            <a href="/checkout" className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white">Checkout</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CartPage() {
  return (
    <CartProvider>
      <CartView />
    </CartProvider>
  )
}
