"use client"

import { useState, useEffect } from 'react'
import { useCart } from '../../hooks/useCart'
import { MapPin, CreditCard, CheckCircle2, Loader2 } from 'lucide-react'

const STEPS = ['Cart', 'Shipping', 'Confirm']

function getTenantPrefix() {
  if (typeof window === 'undefined') return ''

  const pathname = String(window.location.pathname || '')
  const firstSegment = pathname.split('/').filter(Boolean)[0]?.toLowerCase() || ''
  const reserved = new Set(['api', '_next', 'favicon.ico', 'icons', 'manifest.json', 'sw.js', 'offline.html', 'admin', 'platform-admin'])
  if (firstSegment && !reserved.has(firstSegment)) {
    return `/${firstSegment}`
  }

  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('tenant_path_prefix='))
    ?.split('=')[1]
  const prefix = decodeURIComponent(raw || '').trim()
  return prefix && prefix !== '/' ? prefix : ''
}

function withTenantPrefix(path: string) {
  const prefix = getTenantPrefix()
  if (!prefix) return path
  if (path === prefix || path.startsWith(`${prefix}/`)) return path
  return `${prefix}${path.startsWith('/') ? path : `/${path}`}`
}

function couponStorageKey(prefix: string) {
  return prefix ? `miqx_coupon_v1:${prefix.toLowerCase()}` : 'miqx_coupon_v1'
}

function CheckoutForm() {
  const { items, subtotal, clear } = useCart()
  const [cartReady, setCartReady] = useState(false)  // true once localStorage has been read
  const [deliveryCharge, setDeliveryCharge] = useState(40)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [door, setDoor] = useState('')
  const [fullAddress, setFullAddress] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [loading, setLoading] = useState(false)
  const [waLink, setWaLink] = useState<string | null>(null)
  const [customerConfirmLink, setCustomerConfirmLink] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'whatsapp' | 'razorpay'>('whatsapp')
  const [razorpayReady, setRazorpayReady] = useState(false)
  const [tenantPrefix, setTenantPrefix] = useState('')
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(true)

  useEffect(() => {
    const prefix = getTenantPrefix()
    setTenantPrefix(prefix)
    // Mark cart as ready after first render so localStorage has been read
    setCartReady(true)
    fetch(withTenantPrefix('/api/settings'))
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.deliveryCharge === 'number') setDeliveryCharge(data.deliveryCharge)
        const enabled = data?.subscription?.features?.online_payments !== false
        setOnlinePaymentsEnabled(enabled)
        if (!enabled) setPaymentMethod('whatsapp')
      })
      .catch(() => {})
    try {
      const saved = localStorage.getItem(couponStorageKey(prefix))
      if (saved) setAppliedCoupon(JSON.parse(saved))
    } catch {}
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => setRazorpayReady(true)
    document.body.appendChild(script)
    return () => { try { document.body.removeChild(script) } catch {} }
  }, [])

  const buildOrder = () => {
    const discountAmount = appliedCoupon?.discountAmount ?? 0
    return {
      CustomerName: name,
      CustomerMobile: phone,
      DoorNumber: door,
      FullAddress: fullAddress,
      City: city,
      Pincode: pincode,
      ProductsJSON: JSON.stringify(items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price }))),
      Subtotal: subtotal,
      DeliveryCharge: deliveryCharge,
      CouponCode: appliedCoupon?.code ?? '',
      CouponDiscount: discountAmount,
      GrandTotal: subtotal + deliveryCharge - discountAmount,
      OrderStatus: 'Pending',
      WhatsAppSent: false,
    }
  }

  const validate = () => {
    if (!name.trim()) { alert('Please enter your full name.'); return false }
    if (!/^\d{10}$/.test(phone)) { alert('Please enter a valid 10-digit phone number.'); return false }
    if (!fullAddress.trim()) { alert('Please enter your street / full address.'); return false }
    if (!city.trim()) { alert('Please enter your city.'); return false }
    if (!/^\d{6}$/.test(pincode)) { alert('Please enter a valid 6-digit pincode.'); return false }
    if (items.length === 0) { alert('Your cart is empty.'); return false }
    return true
  }

  // ── WhatsApp payment flow ────────────────────────────────────────────────
  const sendOrderWhatsApp = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch(withTenantPrefix('/api/orders'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: buildOrder() }) })
      const data = await res.json()
      if (data.waLink) {
        clear(); localStorage.removeItem(couponStorageKey(tenantPrefix))
        setWaLink(data.waLink)
        setCustomerConfirmLink(data.customerConfirmLink || null)
      } else { alert(data?.error || 'Failed to create order') }
    } catch (e: any) { alert(e?.message || 'Failed to create order') }
    finally { setLoading(false) }
  }

  // ── Razorpay payment flow ────────────────────────────────────────────────
  const sendOrderRazorpay = async () => {
    if (!validate()) return
    if (!razorpayReady) { alert('Payment gateway loading, please wait a moment.'); return }
    setLoading(true)
    try {
      const order = buildOrder()
      // 1. Save order to Sheets first (status = Pending)
      const orderRes = await fetch(withTenantPrefix('/api/orders'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) })
      const orderData = await orderRes.json()
      if (!orderData.ok) { alert(orderData?.error || 'Failed to create order'); return }

      // 2. Create Razorpay order
      const payRes = await fetch(withTenantPrefix('/api/payment/create-order'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: order.GrandTotal }) })
      const payData = await payRes.json()
      if (!payData.razorpayOrderId) { alert(payData.error || 'Payment gateway error'); return }

      // 3. Open Razorpay checkout
      const rzp = new (window as any).Razorpay({
        key:         payData.keyId,
        amount:      payData.amount,
        currency:    'INR',
        name:        name,
        description: `Order ${orderData.orderId ?? ''}`,
        order_id:    payData.razorpayOrderId,
        prefill:     { name, contact: phone },
        theme:       { color: '#2563EB' },
        handler: async (response: any) => {
          setLoading(true)
          try {
            const verRes = await fetch(withTenantPrefix('/api/payment/verify'), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...response, orderId: orderData.orderId }),
            })
            const verData = await verRes.json()
            if (verData.ok) {
              clear(); localStorage.removeItem(couponStorageKey(tenantPrefix))
              setWaLink(orderData.waLink ?? '#')
            } else { alert('Payment verification failed. Contact support with payment ID: ' + response.razorpay_payment_id) }
          } finally { setLoading(false) }
        },
        modal: { ondismiss: () => setLoading(false) },
      })
      rzp.open()
    } catch (e: any) {
      alert('Payment error: ' + (e.message || 'Please try again'))
      setLoading(false)
    }
  }

  const sendOrder = paymentMethod === 'razorpay' && onlinePaymentsEnabled ? sendOrderRazorpay : sendOrderWhatsApp

  // Wait for cart to hydrate from localStorage
  if (!cartReady) {
    return (
      <div className="theme-aurora flex min-h-[50vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    )
  }

  // If cart is empty after hydration, send back to cart
  if (cartReady && items.length === 0 && !waLink) {
    return (
      <div className="theme-aurora relative min-h-screen overflow-hidden px-4 py-20 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-300/20 blur-[90px]" />
          <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-sky-300/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-md">
        <div className="glass-surface rounded-3xl border border-dashed border-slate-200 p-14 shadow-sm">
          <div className="mb-4 text-5xl">🛒</div>
          <h2 className="text-xl font-extrabold text-slate-900">Your cart is empty</h2>
          <p className="mt-2 text-sm text-slate-500">Add products to your cart before checking out.</p>
          <a href={`${tenantPrefix}/search`} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-accent/25 transition hover:-translate-y-0.5">
            Browse products
          </a>
        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="theme-aurora relative min-h-screen overflow-hidden pb-24 pt-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-8 h-96 w-96 rounded-full bg-cyan-300/20 blur-[100px]" />
        <div className="absolute right-0 top-24 h-[28rem] w-[28rem] rounded-full bg-blue-200/25 blur-[110px]" />
      </div>
    <div className="relative mx-auto max-w-7xl px-4 sm:px-6 animate-fade-up">
      {/* ── Success screen ── */}
      {waLink && (
        <div className="mx-auto max-w-md text-center">
          <div className="glass-surface rounded-3xl border border-cyan-100 p-10 shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={30} className="text-emerald-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Order placed! 🎉</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your order has been saved. Tap below to confirm with the store and also get your order confirmation on WhatsApp.
            </p>

            {/* Button 1: Send order to store */}
            <a
              href={waLink!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-6 py-4 text-sm font-bold text-white shadow-md shadow-[#25D366]/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#25D366]/30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
              Send order to store
            </a>

            {/* Button 2: Customer confirmation on their own number */}
            {customerConfirmLink && (
              <a
                href={customerConfirmLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-[#25D366] bg-white px-6 py-3.5 text-sm font-bold text-[#25D366] transition hover:bg-[#25D366]/5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
                Get my order confirmation
              </a>
            )}

            <a href={`${tenantPrefix}/`} className="mt-3 block text-xs text-slate-400 hover:text-slate-600 transition">
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
          <div className="glass-surface rounded-3xl border border-cyan-100 p-6 shadow-sm">
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
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full name *</label>
                <input className="input-field" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone number * <span className="normal-case font-normal text-slate-400">(10 digits)</span></label>
                <input className="input-field" placeholder="10-digit mobile number" type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]{10}"
                  value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </div>
              {/* Door number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Door no. <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                <input className="input-field" placeholder="Flat / Door no." value={door} onChange={(e) => setDoor(e.target.value)} />
              </div>
              {/* Full address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Street / Full address *</label>
                <textarea
                  className="input-field resize-none"
                  placeholder="Street, Area, Landmark..."
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  rows={3}
                />
              </div>
              {/* City + Pincode side by side */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">City *</label>
                  <input className="input-field" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pincode * <span className="normal-case font-normal text-slate-400">(6 digits)</span></label>
                  <input className="input-field" placeholder="6-digit pincode" inputMode="numeric" maxLength={6} pattern="[0-9]{6}"
                    value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                </div>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="glass-surface rounded-3xl border border-cyan-100 p-6 shadow-sm">
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
              <button type="button" onClick={() => setPaymentMethod('whatsapp')}
                className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${paymentMethod === 'whatsapp' ? 'border-accent/20 bg-accent/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${paymentMethod === 'whatsapp' ? 'border-accent bg-white' : 'border-slate-300 bg-white'}`}>
                  {paymentMethod === 'whatsapp' && <div className="h-2.5 w-2.5 rounded-full bg-accent" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">WhatsApp confirmation</p>
                  <p className="mt-1 text-xs text-slate-500">Complete your order via WhatsApp. No card required.</p>
                </div>
              </button>
              {onlinePaymentsEnabled ? (
                <button type="button" onClick={() => setPaymentMethod('razorpay')}
                  className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${paymentMethod === 'razorpay' ? 'border-accent/20 bg-accent/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${paymentMethod === 'razorpay' ? 'border-accent bg-white' : 'border-slate-300 bg-white'}`}>
                    {paymentMethod === 'razorpay' && <div className="h-2.5 w-2.5 rounded-full bg-accent" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Pay online</p>
                    <p className="mt-1 text-xs text-slate-500">UPI, credit/debit cards via Razorpay. Instant confirmation.</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {['UPI', 'Visa', 'MC', 'RuPay'].map(b => (
                        <span key={b} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{b}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                  Online payment is locked for this plan. Upgrade subscription to enable Razorpay checkout.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order summary */}
        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="glass-surface rounded-3xl border border-cyan-100 p-6 shadow-sm">
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
                <span>Discount{appliedCoupon ? ` (${appliedCoupon.code})` : ''}</span>
                <span className="font-semibold text-emerald-600">₹{appliedCoupon?.discountAmount ?? 0}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-base font-bold text-slate-900">Total</span>
              <span className="text-xl font-extrabold text-slate-900">₹{subtotal + deliveryCharge - (appliedCoupon?.discountAmount ?? 0)}</span>
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
                  {paymentMethod === 'razorpay' ? (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                      Pay ₹{subtotal + deliveryCharge - (appliedCoupon?.discountAmount ?? 0)} Online
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                      Confirm via WhatsApp
                    </>
                  )}
                </span>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">🔒 Secure · No card details stored</p>
          </div>

          <div className="glass-surface rounded-3xl border border-cyan-100 p-6 shadow-sm">
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
    </div>
  )
}

export default function CheckoutPage() {
  return <CheckoutForm />
}
