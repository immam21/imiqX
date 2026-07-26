'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LayoutDashboard,
  Package,
  Tags,
  Palette,
  Users,
  CreditCard,
  Settings as SettingsIcon,
  LifeBuoy,
  ExternalLink,
  LogOut,
  Eye,
  EyeOff,
  Pencil,
  ScanLine,
  ReceiptText,
  Truck,
  Trash2,
  Download,
  MessageCircle,
  ShoppingBag,
  TrendingUp,
  BookOpen,
  Ticket,
} from 'lucide-react'
import { toRenderableAssetUrl } from '../../lib/assetUrl'
import tenantDummyCredentials from '../../docs/tenant-dummy-credentials.json'
import { DEFAULT_FEATURES, type SubscriptionFeatureKey, type SubscriptionFeatureMap } from '../../lib/subscriptionFeatures'

function getTenantPrefix() {
  if (typeof window === 'undefined') return ''

  // Path-based tenant prefix is the most reliable source for tenant-scoped admin routes.
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
  if (/^https?:\/\//i.test(path)) return path
  if (path === prefix || path.startsWith(`${prefix}/`)) return path
  return `${prefix}${path.startsWith('/') ? path : `/${path}`}`
}

function toDisplayName(input: string) {
  const value = String(input || '').trim()
  if (!value) return 'Storefront'
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getDummyBusinessName() {
  const slug = getTenantPrefix().replace(/^\//, '').trim().toLowerCase()
  const rows = Array.isArray(tenantDummyCredentials) ? tenantDummyCredentials : []
  const match = rows.find((row: any) => String(row?.tenantCode || '').trim().toLowerCase() === slug)
  return String(match?.businessName || '').trim()
}

function getAdminSessionKey() {
  const scope = (getTenantPrefix() || '__root__').toLowerCase()
  return `admin_token:${scope}`
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Order = {
  dbId?: string
  orderId: string; date: string; customerName: string; customerPhone: string
  doorNumber?: string; city?: string; pincode?: string
  address: string; productsJSON: string; subtotal: number; deliveryCharge: number
  grandTotal: number; status: string; couponCode: string; couponDiscount: number
  paymentMethod?: string; paymentStatus?: string
  trackingId?: string; courierName?: string; trackingBarcode?: string
}
type Stats = {
  totalOrders: number; todayOrders: number; todayRevenue: number; totalRevenue: number
  pendingOrders: number; processingOrders: number; shippedOrders: number; deliveredOrders: number
}
type Product = {
  productId: string
  name: string
  category: string
  brand: string
  description?: string
  price: number
  offerPrice: number
  stock: number
  image: string
  images?: string[]
}
type Banner  = { bannerId: string; title: string; subtitle: string; imageUrl: string; linkUrl: string; buttonText: string }
type Coupon  = { code: string; type: string; value: number; minOrder: number; expiry: string; active: string }
type PlanSummary = {
  id: string
  sid?: string
  plan_code: string
  name: string
  billing_cycle: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly'
  price: number
  currency: string
  features?: Record<string, unknown>
  limits?: Record<string, unknown>
  is_active: boolean
  created_at?: string
}
type TenantSubscription = {
  id: string
  tenant_id: string
  plan_id: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  current_period_start?: string | null
  current_period_end?: string | null
  trial_ends_at?: string | null
  created_at?: string
  plan?: PlanSummary | null
}

type SupportComment = {
  id: string
  author_type: 'tenant' | 'platform'
  comment: string
  created_at?: string
}

type SupportTicket = {
  id: string
  sid?: string
  subject: string
  description: string
  status: string
  priority: string
  created_at?: string
  updated_at?: string
  comments?: SupportComment[]
  latestComment?: string | null
  comments_unavailable?: boolean
}

type PlatformComm = {
  id: string
  title: string
  body: string
  image_url?: string | null
  start_at?: string | null
  end_at?: string | null
}



// ─── Auth helper ──────────────────────────────────────────────────────────────
function useAdminFetch(token: string) {
  return useCallback((url: string, opts?: RequestInit) =>
    fetch(withTenantPrefix(url), { ...opts, headers: { 'x-admin-token': token, 'Content-Type': 'application/json', ...opts?.headers } }),
  [token])
}

function confirmAction(message: string, title = 'Please confirm') {
  if (typeof window === 'undefined') return Promise.resolve(true)

  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm'

    const panel = document.createElement('div')
    panel.className = 'w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl shadow-black/40'

    const titleEl = document.createElement('h3')
    titleEl.className = 'text-base font-bold text-white'
    titleEl.textContent = title

    const msgEl = document.createElement('p')
    msgEl.className = 'mt-2 text-sm leading-6 text-slate-300'
    msgEl.textContent = message

    const actions = document.createElement('div')
    actions.className = 'mt-5 flex items-center justify-end gap-2'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10'
    cancelBtn.textContent = 'Cancel'

    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.className = 'rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent/30 transition hover:brightness-110'
    confirmBtn.textContent = 'Confirm'

    const cleanup = (result: boolean) => {
      window.removeEventListener('keydown', handleKeyDown)
      overlay.remove()
      resolve(result)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cleanup(false)
    }

    cancelBtn.onclick = () => cleanup(false)
    confirmBtn.onclick = () => cleanup(true)
    overlay.onclick = (event) => {
      if (event.target === overlay) cleanup(false)
    }

    actions.appendChild(cancelBtn)
    actions.appendChild(confirmBtn)
    panel.appendChild(titleEl)
    panel.appendChild(msgEl)
    panel.appendChild(actions)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)
    window.addEventListener('keydown', handleKeyDown)
    confirmBtn.focus()
  })
}

function showSavedPopup(message: string, title = 'Saved') {
  if (typeof window === 'undefined') return Promise.resolve()

  return new Promise<void>((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm'

    const panel = document.createElement('div')
    panel.className = 'w-full max-w-md rounded-2xl border border-cyan-300/30 bg-slate-900/95 p-5 shadow-2xl shadow-black/40'

    const titleEl = document.createElement('h3')
    titleEl.className = 'text-base font-bold text-white'
    titleEl.textContent = title

    const msgEl = document.createElement('p')
    msgEl.className = 'mt-2 text-sm leading-6 text-slate-300'
    msgEl.textContent = message

    const actions = document.createElement('div')
    actions.className = 'mt-5 flex items-center justify-end'

    const okBtn = document.createElement('button')
    okBtn.type = 'button'
    okBtn.className = 'rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400'
    okBtn.textContent = 'OK'

    const cleanup = () => {
      window.removeEventListener('keydown', onKeyDown)
      overlay.remove()
      resolve()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') cleanup()
    }

    okBtn.onclick = cleanup
    overlay.onclick = (event) => {
      if (event.target === overlay) cleanup()
    }

    actions.appendChild(okBtn)
    panel.appendChild(titleEl)
    panel.appendChild(msgEl)
    panel.appendChild(actions)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)
    window.addEventListener('keydown', onKeyDown)
    okBtn.focus()
  })
}

function showPlatformComm(comm: PlatformComm) {
  if (typeof window === 'undefined') return

  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md'

  const panel = document.createElement('div')
  panel.className = 'w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950 shadow-2xl shadow-cyan-500/10'

  const top = document.createElement('div')
  top.className = 'bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-indigo-500/20 px-6 py-5'

  const title = document.createElement('h3')
  title.className = 'text-lg font-extrabold text-white'
  title.textContent = comm.title

  const body = document.createElement('p')
  body.className = 'mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200'
  body.textContent = comm.body

  top.appendChild(title)
  top.appendChild(body)

  if (comm.image_url) {
    const img = document.createElement('img')
    img.src = comm.image_url
    img.alt = comm.title
    img.className = 'max-h-64 w-full object-cover'
    panel.appendChild(img)
  }

  const footer = document.createElement('div')
  footer.className = 'flex items-center justify-end px-6 py-4'

  const okBtn = document.createElement('button')
  okBtn.type = 'button'
  okBtn.className = 'rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-400'
  okBtn.textContent = 'OK'

  const cleanup = () => {
    overlay.remove()
    window.removeEventListener('keydown', onKeyDown)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Enter') cleanup()
  }

  okBtn.onclick = cleanup
  footer.appendChild(okBtn)

  panel.appendChild(top)
  panel.appendChild(footer)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  window.addEventListener('keydown', onKeyDown)
  okBtn.focus()
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }: { onAuth: (token: string) => void }) {
  const [loginId, setLoginId] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const [routePrefix, setRoutePrefix] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  useEffect(() => {
    fetch(withTenantPrefix('/api/settings'), { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d.routePrefix) setRoutePrefix(d.routePrefix)
      if (d.businessName) {
        setBusinessName(d.businessName)
      } else if (getDummyBusinessName()) {
        setBusinessName(getDummyBusinessName())
      } else if (d.tenantId) {
        setBusinessName(toDisplayName(d.tenantId))
      }
      const rawLogo = String(d.logoUrl || d.LogoURL || d?.settings?.LogoURL || '').trim()
      if (rawLogo) setLogoUrl(toRenderableAssetUrl(rawLogo))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setLogoFailed(false)
  }, [logoUrl])

  const tenantSlug = routePrefix.replace(/^\//, '') || 'store'
  const displayName = businessName || tenantSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const storefrontHome = routePrefix || '/'

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const effectiveRes = await fetch(withTenantPrefix('/api/admin/auth'), {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password: pw }),
      })
      const data = await effectiveRes.json()
      if (!effectiveRes.ok) { setError(data.error || 'Invalid login ID or password'); return }
      onAuth(data.token)
    } catch { setError('Connection failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="admin-light fixed inset-0 z-[9999] overflow-auto bg-[radial-gradient(circle_at_14%_18%,rgba(6,182,212,0.10),transparent_40%),radial-gradient(circle_at_84%_20%,rgba(59,130,246,0.09),transparent_36%),linear-gradient(145deg,#f8fbff,#eef5ff_52%,#f8fafc)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-10 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[26rem] w-[26rem] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-teal-400/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="glass-surface mb-4 flex items-center justify-between rounded-2xl border border-cyan-200/15 bg-slate-900/70 px-4 py-3 text-white shadow-[0_14px_30px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            {logoUrl && !logoFailed ? (
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-cyan-200/60 bg-white shadow-sm">
                <img src={logoUrl} alt={displayName} className="h-full w-full object-contain" onError={() => setLogoFailed(true)} />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-extrabold shadow-md shadow-cyan-500/30">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[13px] font-bold leading-none">{displayName}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Portal</p>
            </div>
          </div>
          <a
            href={storefrontHome}
            className="rounded-xl border border-cyan-300/35 bg-cyan-100/80 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-cyan-200 hover:text-slate-900"
          >
            Back to Storefront
          </a>
        </header>

        <main className="flex flex-1 items-stretch gap-5 pb-4">
          <section className="hidden w-[44%] rounded-[2rem] border border-cyan-200/20 bg-gradient-to-br from-cyan-500/28 via-blue-700/30 to-indigo-800/32 p-10 text-white shadow-[0_24px_50px_rgba(2,6,23,0.48)] backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-100/40 bg-cyan-100/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-50">
                Secure access
              </p>
              <h2 className="mt-6 text-4xl font-extrabold leading-tight">
                Control your store
                <br />
                with confidence.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-cyan-50/92">
                Manage orders, product updates, offers, and customer requests from one streamlined dashboard.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                { icon: <Package size={20} />, label: 'Orders', desc: 'Manage fulfillment in real time' },
                { icon: <ShoppingBag size={20} />, label: 'Products', desc: 'Update pricing and inventory quickly' },
                { icon: <Ticket size={20} />, label: 'Coupons', desc: 'Launch offers in seconds' },
                { icon: <TrendingUp size={20} />, label: 'Insights', desc: 'Track performance and growth' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="card-3d flex items-center gap-3 rounded-2xl border border-cyan-100/20 bg-slate-900/38 px-4 py-3 backdrop-blur-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-200/30">{icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{label}</p>
                    <p className="text-xs text-cyan-50/90">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                {logoUrl && !logoFailed ? (
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-cyan-200/60 bg-white shadow-sm">
                    <img src={logoUrl} alt={displayName} className="h-full w-full object-contain" onError={() => setLogoFailed(true)} />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-extrabold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-lg font-bold text-slate-900">{displayName}</span>
              </div>

              <div className="card-3d rounded-3xl border border-cyan-100/15 bg-slate-900/72 p-8 shadow-[0_24px_64px_rgba(2,6,23,0.55)] backdrop-blur-xl">
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/14 text-cyan-300 ring-1 ring-cyan-300/30">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                  <h1 className="text-2xl font-extrabold text-white">{displayName} Admin</h1>
                  <p className="mt-1 text-sm text-slate-300">Sign in to manage your store dashboard.</p>
                </div>

                {!showForgot ? (
                  <form onSubmit={login} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Admin Login ID</label>
                      <input
                        type="text" placeholder="Enter your login ID" value={loginId}
                        onChange={e => setLoginId(e.target.value)} required autoComplete="username"
                        className="w-full rounded-xl border border-slate-600/70 bg-slate-950/78 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none transition focus:border-cyan-300/70 focus:bg-slate-950 focus:ring-2 focus:ring-cyan-300/25"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Password</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={pw}
                          onChange={e => setPw(e.target.value)} required autoComplete="current-password"
                          className="w-full rounded-xl border border-slate-600/70 bg-slate-950/78 px-4 py-3 pr-11 text-sm text-white placeholder-slate-400 outline-none transition focus:border-cyan-300/70 focus:bg-slate-950 focus:ring-2 focus:ring-cyan-300/25"
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-cyan-200">
                          {showPw
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button type="button" onClick={() => setShowForgot(true)} className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline">
                        Forgot password?
                      </button>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500/12 px-4 py-2.5">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p className="text-xs font-medium text-rose-200">{error}</p>
                      </div>
                    )}

                    <button type="submit" disabled={loading}
                      className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
                      {loading
                        ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Signing in…</span>
                        : 'Sign in to Dashboard'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/12 px-4 py-3">
                      <span className="text-2xl">🔐</span>
                      <div>
                        <p className="text-sm font-bold text-amber-300">Password assistance</p>
                        <p className="mt-0.5 text-xs text-slate-300">For password reset, please contact platform admin now.</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-slate-900/55 p-5 text-sm text-slate-200">
                      <p className="font-semibold text-white">Need help accessing your account?</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        Reach your platform admin and request an admin password reset for <span className="font-semibold text-white">{displayName}</span>.
                      </p>
                    </div>

                    <button onClick={() => setShowForgot(false)} className="w-full rounded-xl border border-white/15 bg-slate-900/60 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white">
                      ← Back to login
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>

        <footer className="glass-surface mt-auto flex flex-col items-center justify-between gap-2 rounded-2xl border border-cyan-200/15 bg-slate-900/65 px-4 py-3 text-[11px] text-slate-300 sm:flex-row">
          <p>Powered by <span className="font-semibold text-accent">ImiqX</span> Commerce OS</p>
          <p className="text-slate-400">Secure admin access</p>
        </footer>
      </div>

    </div>
  )
}

// ─── Shared UI primitives ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card-3d rounded-2xl border border-slate-200 bg-[linear-gradient(155deg,#ffffff,#f1f5f9)] p-5 shadow-[0_10px_22px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${accent || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-[linear-gradient(120deg,#ffffff,#f8fbff)] px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div>
        <h2 className="display-heading text-[1.3rem] font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-3d rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f8fbff)] shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur-md ${className}`}>
      {children}
    </div>
  )
}

function Inp({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full rounded-xl border border-slate-600/70 bg-slate-950/78 px-3 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition focus:border-cyan-300/70 focus:bg-slate-950 focus:ring-2 focus:ring-cyan-300/25 ${className}`}
    />
  )
}

function Sel({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`w-full rounded-xl border border-slate-600/70 bg-slate-950/78 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/25 ${className}`}
    />
  )
}

function Btn({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', className = '' }:
  { children: React.ReactNode; variant?: 'primary'|'ghost'|'danger'|'success'; size?: 'sm'|'md'; disabled?: boolean; onClick?: () => void; type?: 'button'|'submit'; className?: string }) {
  const base = 'font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-cyan-300/35 active:scale-[0.99]'
  const v = {
    primary: 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white shadow-[0_12px_26px_rgba(14,165,233,0.34)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_30px_rgba(14,165,233,0.45)]',
    ghost: 'border border-cyan-100/20 bg-slate-900/66 text-slate-200 hover:border-cyan-200/35 hover:bg-cyan-500/14 hover:text-white',
    danger: 'border border-red-700 bg-red-600 text-white shadow-[0_10px_22px_rgba(220,38,38,0.35)] hover:bg-red-700',
    success: 'border border-emerald-700 bg-emerald-600 text-white shadow-[0_10px_22px_rgba(5,150,105,0.35)] hover:bg-emerald-700',
  }
  const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' }
  return <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${v[variant]} ${s[size]} ${className}`}>{children}</button>
}

const STATUS_COLORS: Record<string, string> = {
  Pending:    'bg-amber-400/20 text-amber-300',
  Confirmed:  'bg-cyan-400/20 text-cyan-300',
  Processing: 'bg-blue-400/20 text-blue-300',
  Shipped:    'bg-violet-400/20 text-violet-300',
  'In Transit': 'bg-fuchsia-400/20 text-fuchsia-300',
  Delivered:  'bg-emerald-400/20 text-emerald-300',
  Returned:   'bg-orange-400/20 text-orange-300',
  Cancelled:  'bg-red-400/20 text-red-300',
}
const STATUS_BAR: Record<string, string> = {
  Pending: 'bg-amber-400', Confirmed: 'bg-cyan-400', Processing: 'bg-blue-400',
  Shipped: 'bg-violet-400', 'In Transit': 'bg-fuchsia-400', Delivered: 'bg-emerald-400', Returned: 'bg-orange-400', Cancelled: 'bg-red-400',
}

function formatAdminMoney(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatAdminDate(value?: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function titleizeAdmin(value: string) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

function parseImageUrls(value: string) {
  return String(value || '')
    .split(/\r?\n|,/) 
    .map((item) => item.trim())
    .filter(Boolean)
}

// ─── Dashboard section ───────────────────────────────────────────────────────
function DashboardSection({ token }: { token: string }) {
  const af = useAdminFetch(token)
  const [stats, setStats]   = useState<Stats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      af('/api/admin/stats').then(r => r.json()),
      af('/api/admin/orders').then(r => r.json()),
    ]).then(([s, o]) => { setStats(s); setOrders(o.orders || []) }).finally(() => setLoading(false))
  }, [af])

  if (loading) return <div className="py-20 text-center text-sm text-slate-400">Loading dashboard…</div>

  const completed  = orders.filter(o => o.status !== 'Cancelled')
  const totalRev   = completed.reduce((s, o) => s + (o.grandTotal ?? 0), 0)
  const aov        = completed.length ? Math.round(totalRev / completed.length) : 0
  const delivered  = orders.filter(o => o.status === 'Delivered')
  const fRate      = orders.length ? Math.round((delivered.length / orders.length) * 100) : 0

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const ds = d.toDateString()
    const rev = completed.filter(o => o.date && new Date(o.date).toDateString() === ds).reduce((s, o) => s + (o.grandTotal ?? 0), 0)
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }), rev }
  })
  const maxRev = Math.max(...last7.map(d => d.rev), 1)

  const statusData = ['Pending','Processing','Shipped','Delivered','Cancelled'].map(s => ({
    s, count: orders.filter(o => o.status === s).length,
    pct: orders.length ? Math.round((orders.filter(o => o.status === s).length / orders.length) * 100) : 0,
  }))

  const pm: Record<string, { name: string; units: number; revenue: number }> = {}
  completed.forEach(o => { try { JSON.parse(o.productsJSON || '[]').forEach((p: any) => { if (!pm[p.name]) pm[p.name] = { name: p.name, units: 0, revenue: 0 }; pm[p.name].units += p.qty; pm[p.name].revenue += p.price * p.qty }) } catch {} })
  const topProducts = Object.values(pm).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const recent = orders.slice(0, 5)

  return (
    <div className="space-y-6">
      <SectionHeader title="Dashboard" subtitle="Your store performance at a glance" />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Orders"    value={stats?.totalOrders ?? 0}    sub={`${stats?.todayOrders ?? 0} today`} />
        <StatCard label="Total Revenue"   value={`₹${totalRev.toLocaleString('en-IN')}`} sub="Excl. cancelled" accent="text-emerald-400" />
        <StatCard label="Avg Order Value" value={`₹${aov.toLocaleString('en-IN')}`} />
        <StatCard label="Fulfillment"     value={`${fRate}%`} sub={`${delivered.length} delivered`} accent="text-blue-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status boxes */}
        <Card className="p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Order Pipeline</p>
          <div className="space-y-2">
            {[
              { label: 'Pending',    v: stats?.pendingOrders ?? 0,    color: 'text-amber-300' },
              { label: 'Processing', v: stats?.processingOrders ?? 0, color: 'text-blue-300' },
              { label: 'Shipped',    v: stats?.shippedOrders ?? 0,    color: 'text-violet-300' },
              { label: 'Delivered',  v: stats?.deliveredOrders ?? 0,  color: 'text-emerald-300' },
            ].map(({ label, v, color }) => (
              <div key={label} className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/5">
                <span className="text-sm text-slate-400">{label}</span>
                <span className={`text-base font-extrabold ${color}`}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 7-day chart */}
        <Card className="col-span-1 p-5 lg:col-span-2">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Revenue — Last 7 Days</p>
          <div className="flex h-32 items-end gap-2">
            {last7.map(({ label, rev }) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] font-semibold text-slate-500 leading-none">{rev > 0 ? (rev >= 1000 ? `₹${(rev/1000).toFixed(1)}k` : `₹${rev}`) : ''}</span>
                <div className="w-full rounded-t-lg bg-accent/70 transition-all duration-700" style={{ height: `${Math.max((rev / maxRev) * 100, rev > 0 ? 5 : 0)}%` }} />
                <span className="text-[9px] text-slate-500 text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card className="p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Orders by Status</p>
          <div className="space-y-3">
            {statusData.map(({ s, count, pct }) => (
              <div key={s}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-300">{s}</span>
                  <span className="text-slate-500">{count} ({pct}%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full transition-all duration-700 ${STATUS_BAR[s] || 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top products */}
        <Card className="p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Top Products by Revenue</p>
          {topProducts.length === 0
            ? <p className="py-4 text-center text-xs text-slate-500">No sales data yet</p>
            : <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] font-mono text-slate-500">{i + 1}</span>
                      <span className="truncate text-sm text-slate-200">{p.name}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-accent">₹{p.revenue.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-500">{p.units} units</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Recent Orders</p>
        {recent.length === 0
          ? <p className="py-4 text-center text-xs text-slate-500">No orders yet</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-white/10">
                  <th className="pb-3 pr-4">Order</th><th className="pb-3 pr-4">Customer</th><th className="pb-3 pr-4">Amount</th><th className="pb-3 pr-4">Date</th><th className="pb-3">Status</th>
                </tr></thead>
                <tbody>
                  {recent.map(o => (
                    <tr key={o.orderId} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-300">{o.orderId}</td>
                      <td className="py-2.5 pr-4 text-slate-200">{o.customerName}</td>
                      <td className="py-2.5 pr-4 font-bold text-white">₹{(o.grandTotal ?? 0).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 pr-4 text-[11px] text-slate-500">{o.date ? new Date(o.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : ''}</td>
                      <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLORS[o.status] || 'bg-slate-700 text-slate-300'}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </Card>
    </div>
  )
}

// ─── Orders section ───────────────────────────────────────────────────────────
function OrdersSection({ token }: { token: string }) {
    const parseOrderItems = (raw: string) => {
      try {
        const parsed = JSON.parse(raw || '[]')
        if (!Array.isArray(parsed)) return [] as any[]
        return parsed
      } catch {
        return [] as any[]
      }
    }

  const af = useAdminFetch(token)
  const [orders, setOrders]   = useState<Order[]>([])
  const [stats, setStats]     = useState<Stats | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [filter, setFilter]   = useState('All')
  const [search, setSearch]   = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [loading, setLoading]  = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanTargetOrderId, setScanTargetOrderId] = useState<string | null>(null)
  const [scanValue, setScanValue] = useState('')
  const [scanSaving, setScanSaving] = useState(false)
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scanError, setScanError] = useState('')
  const [editForm, setEditForm]   = useState({
    customerName: '',
    customerPhone: '',
    address: '',
    doorNumber: '',
    city: '',
    pincode: '',
    paymentMethod: '',
    paymentStatus: '',
    trackingId: '',
    courierName: '',
    trackingBarcode: '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([
      af('/api/admin/orders').then(r => r.json()),
      af('/api/admin/stats').then(r => r.json()),
      af('/api/admin/settings').then(r => r.json()),
    ]).then(([o, s, st]) => {
      setOrders(o.orders || [])
      setStats(s)
      setSettings(st.settings || {})
    }).finally(() => setLoading(false))
  }, [af])

  const updateStatus = async (orderId: string, status: string) => {
    if (!await confirmAction(`Change order ${orderId} status to ${status}?`)) return
    setUpdating(orderId)
    try {
      await af('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ orderId, status }) })
      setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status } : o))
    } finally { setUpdating(null) }
  }

  const saveEdit = async (orderId: string) => {
    if (!await confirmAction('Save changes to this order?')) return
    setEditSaving(true)
    try {
      await af('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ orderId, updates: editForm }) })
      setOrders(prev => prev.map(o => o.orderId === orderId ? {
        ...o,
        ...editForm,
        address: [editForm.doorNumber, editForm.address, editForm.city, editForm.pincode].filter(Boolean).join(', '),
      } : o))
      setEditingId(null)
    } finally { setEditSaving(false) }
  }

  const filtered = orders.filter(o =>
    (filter === 'All' || o.status === filter) &&
    (!search || o.orderId.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase()) || o.customerPhone.includes(search))
  )

  const selectedOrders = filtered.filter((order) => selectedIds.includes(order.orderId))
  const allVisibleSelected = filtered.length > 0 && filtered.every((order) => selectedIds.includes(order.orderId))

  useEffect(() => {
    const visibleIds = new Set(filtered.map((order) => order.orderId))
    setSelectedIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [filter, search, orders])

  useEffect(() => {
    setCameraSupported(typeof window !== 'undefined' && 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices)
  }, [])

  useEffect(() => {
    if (!scanModalOpen) {
      if (scanTimerRef.current) {
        window.clearInterval(scanTimerRef.current)
        scanTimerRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      setCameraActive(false)
      setScanError('')
      return
    }

    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window
    if (!hasBarcodeDetector) return

    let cancelled = false
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        setCameraActive(true)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }

        const Detector = (window as any).BarcodeDetector
        const detector = new Detector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current) return
          try {
            const results = await detector.detect(videoRef.current)
            const raw = String(results?.[0]?.rawValue || '').trim()
            if (!raw) return
            setScanValue(raw)
          } catch {
          }
        }, 700)
      } catch {
        setScanError('Camera access failed. Allow camera permission or use manual input.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (scanTimerRef.current) {
        window.clearInterval(scanTimerRef.current)
        scanTimerRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      setCameraActive(false)
    }
  }, [scanModalOpen])

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId])
  }

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(filtered.map((order) => order.orderId))
  }

  const escapeHtml = (value: string) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const getFromAddress = () => {
    const normalized = Object.entries(settings).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key.replace(/[\s_-]/g, '').toLowerCase()] = String(value || '').trim()
      return acc
    }, {})

    const readSetting = (...aliases: string[]) => {
      for (const alias of aliases) {
        const value = normalized[alias.replace(/[\s_-]/g, '').toLowerCase()]
        if (value) return value
      }
      return ''
    }

    const business = readSetting('BusinessName', 'StoreName', 'CompanyName', 'ShopName')
    const phone = readSetting('WhatsAppNumber', 'PhoneNumber', 'Phone', 'Mobile', 'ContactNumber')
    const explicitAddress = readSetting('Address', 'BusinessAddress', 'StoreAddress', 'PickupAddress')
    const composedAddress = [
      readSetting('AddressLine1', 'Address1', 'DoorNumber'),
      readSetting('AddressLine2', 'Address2', 'Area', 'Locality'),
      readSetting('Landmark'),
      readSetting('City'),
      readSetting('State'),
      readSetting('Pincode', 'PinCode', 'PostalCode', 'ZipCode', 'ZIPCode'),
      readSetting('Country'),
    ].filter(Boolean).join(', ')
    const address = explicitAddress || composedAddress
    const addressLines = address
      ? address.split(/\r?\n|\s\|\s|\|/).map((line) => line.trim()).filter(Boolean)
      : []
    return {
      business: business || 'Store',
      lines: [...addressLines, phone ? `Phone: ${phone}` : ''].filter(Boolean),
    }
  }

  const downloadBills = async (targetOrders: Order[]) => {
    if (!targetOrders.length) return
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const from = getFromAddress()

      targetOrders.forEach((order, index) => {
        if (index > 0) doc.addPage()
        const items = parseOrderItems(order.productsJSON)

        let y = 14
        doc.setFontSize(14)
        doc.text('Tax Invoice / Receipt', 14, y)
        y += 8

        doc.setFontSize(10)
        doc.text(`Order: ${order.orderId}`, 14, y)
        doc.text(`Date: ${order.date ? new Date(order.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}`, 90, y)
        y += 5
        doc.text(`Status: ${order.status}`, 14, y)
        y += 8

        doc.setFontSize(11)
        doc.text('From', 14, y)
        doc.text('Bill To', 110, y)
        y += 5
        doc.setFontSize(10)
        const fromLines = [from.business, ...from.lines]
        const toLines = [order.customerName, order.customerPhone, order.address]
        fromLines.forEach((line) => {
          const wrapped = doc.splitTextToSize(String(line || ''), 85)
          wrapped.forEach((w: string) => { doc.text(w, 14, y); y += 4.5 })
        })

        let yTo = y - (fromLines.length * 4.5)
        toLines.forEach((line) => {
          const wrapped = doc.splitTextToSize(String(line || ''), 85)
          wrapped.forEach((w: string) => { doc.text(w, 110, yTo); yTo += 4.5 })
        })
        y = Math.max(y, yTo) + 3

        doc.setDrawColor(180)
        doc.line(14, y, 196, y)
        y += 5

        doc.setFontSize(10)
        doc.text('Item', 14, y)
        doc.text('Qty', 120, y)
        doc.text('Price', 140, y)
        doc.text('Total', 170, y)
        y += 4
        doc.line(14, y, 196, y)
        y += 4

        items.forEach((item: any) => {
          const qty = Number(item?.qty || 1)
          const price = Number(item?.price || 0)
          const lineTotal = qty * price
          const wrapped = doc.splitTextToSize(String(item?.name || 'Item'), 100)
          wrapped.forEach((w: string, wi: number) => {
            if (y > 272) {
              doc.addPage()
              y = 18
            }
            doc.text(w, 14, y)
            if (wi === 0) {
              doc.text(String(qty), 120, y)
              doc.text(`INR ${price.toLocaleString('en-IN')}`, 140, y)
              doc.text(`INR ${lineTotal.toLocaleString('en-IN')}`, 170, y)
            }
            y += 4.5
          })
        })

        y += 2
        doc.line(120, y, 196, y)
        y += 5
        doc.text(`Subtotal: INR ${Number(order.subtotal || 0).toLocaleString('en-IN')}`, 120, y)
        y += 5
        doc.text(`Delivery: INR ${Number(order.deliveryCharge || 0).toLocaleString('en-IN')}`, 120, y)
        y += 5
        doc.text(`Coupon: ${order.couponDiscount > 0 ? `- INR ${Number(order.couponDiscount).toLocaleString('en-IN')}` : 'INR 0'}`, 120, y)
        y += 6
        doc.setFontSize(12)
        doc.text(`Grand Total: INR ${Number(order.grandTotal || 0).toLocaleString('en-IN')}`, 120, y)
      })

      doc.save(`bills_${new Date().toISOString().slice(0,10)}.pdf`)
    } catch {
      alert('Failed to generate bill PDF. Please try again.')
    }
  }

  const downloadShippingLabels = async (targetOrders: Order[]) => {
    if (!targetOrders.length) return
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: [101.6, 152.4], orientation: 'portrait' })
      const from = getFromAddress()

      const labelWidth = 101.6
      const labelHeight = 152.4
      const margin = 6
      const contentWidth = labelWidth - (margin * 2)

      targetOrders.forEach((order, index) => {
        if (index > 0) doc.addPage()

        const trackingValue = order.trackingId || order.trackingBarcode || '-'

        doc.setDrawColor(40, 40, 40)
        doc.setLineWidth(0.35)
        doc.roundedRect(2.5, 2.5, labelWidth - 5, labelHeight - 5, 2, 2)

        doc.setFillColor(18, 34, 64)
        doc.rect(margin, margin, contentWidth, 13, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('SHIPPING LABEL', margin + 3, margin + 8.3)

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(`ORDER ${order.orderId}`, labelWidth - margin - 3, margin + 8.3, { align: 'right' })
        doc.setTextColor(20, 20, 20)

        const panelTop = margin + 17
        const panelHeight = 66
        const gap = 3
        const panelWidth = (contentWidth - gap) / 2
        const leftX = margin
        const rightX = margin + panelWidth + gap

        doc.setDrawColor(165, 165, 165)
        doc.setLineWidth(0.2)
        doc.roundedRect(leftX, panelTop, panelWidth, panelHeight, 1.5, 1.5)
        doc.roundedRect(rightX, panelTop, panelWidth, panelHeight, 1.5, 1.5)

        doc.setFillColor(241, 245, 249)
        doc.roundedRect(leftX + 1, panelTop + 1, panelWidth - 2, 7, 1, 1, 'F')
        doc.roundedRect(rightX + 1, panelTop + 1, panelWidth - 2, 7, 1, 1, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text('FROM', leftX + 3, panelTop + 5.7)
        doc.text('TO', rightX + 3, panelTop + 5.7)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        let yFrom = panelTop + 12
        ;[from.business, ...from.lines].forEach((line) => {
          const wrapped = doc.splitTextToSize(String(line || ''), panelWidth - 6)
          wrapped.forEach((w: string) => { doc.text(w, leftX + 3, yFrom); yFrom += 4.5 })
        })

        let yTo = panelTop + 12
        doc.setFont('helvetica', 'bold')
        const toName = doc.splitTextToSize(String(order.customerName || 'Customer'), panelWidth - 6)
        toName.forEach((line: string) => { doc.text(line, rightX + 3, yTo); yTo += 4.6 })

        doc.setFont('helvetica', 'normal')
        ;[order.customerPhone, order.address].forEach((line) => {
          const wrapped = doc.splitTextToSize(String(line || ''), panelWidth - 6)
          wrapped.forEach((w: string) => { doc.text(w, rightX + 3, yTo); yTo += 4.5 })
        })

        const metaTop = panelTop + panelHeight + 4
        doc.setDrawColor(180, 180, 180)
        doc.roundedRect(margin, metaTop, contentWidth, 20, 1.5, 1.5)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        doc.text('ORDER ID', margin + 3, metaTop + 6)
        doc.text('STATUS', margin + 48, metaTop + 6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(String(order.orderId || '-'), margin + 3, metaTop + 12)
        doc.text(String(order.status || '-'), margin + 48, metaTop + 12)

        const trackTop = metaTop + 25
        doc.setFillColor(250, 250, 250)
        doc.roundedRect(margin, trackTop, contentWidth, 24, 1.5, 1.5, 'F')
        doc.setDrawColor(35, 35, 35)
        doc.roundedRect(margin, trackTop, contentWidth, 24, 1.5, 1.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.text('TRACKING ID', margin + 3, trackTop + 6)
        doc.setFontSize(14)
        doc.text(String(trackingValue), margin + (contentWidth / 2), trackTop + 15, { align: 'center' })

        const footTop = trackTop + 29
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, margin, footTop)
        doc.text('Handle with care', labelWidth - margin, footTop, { align: 'right' })
      })

      doc.save(`shipping_labels_${new Date().toISOString().slice(0,10)}.pdf`)
    } catch {
      alert('Failed to generate shipping label PDF. Please try again.')
    }
  }

  const saveScannedTracking = async () => {
    const value = String(scanValue || '').trim()
    if (!scanTargetOrderId || !value) {
      alert('Scan or enter a tracking number first.')
      return
    }
    if (!await confirmAction(`Save tracking ID "${value}" for order ${scanTargetOrderId}?`)) return
    setScanSaving(true)
    try {
      await af('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({
          orderId: scanTargetOrderId,
          updates: {
            trackingId: value,
            trackingBarcode: value,
          },
        }),
      })
      setOrders((prev) => prev.map((order) => (
        order.orderId === scanTargetOrderId
          ? { ...order, trackingId: value, trackingBarcode: value }
          : order
      )))
      setScanModalOpen(false)
    } finally {
      setScanSaving(false)
    }
  }

  const downloadCSV = (target: Order[]) => {
    const headers = ['Order ID','Date','Customer','Phone','Address','Items','Subtotal','Delivery','Coupon','Total','Status']
    const rows = target.map(o => {
      const items = parseOrderItems(o.productsJSON).map((p: any) => `${String(p?.name || 'Item')} x${Number(p?.qty || 1)}`).join('; ')
      return [o.orderId, o.date, o.customerName, o.customerPhone, o.address, items, o.subtotal ?? 0, o.deliveryCharge, o.couponCode || '', o.grandTotal ?? 0, o.status]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `orders_${new Date().toISOString().slice(0,10)}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const deleteOrder = async (order: Order) => {
    if (!await confirmAction(`Delete order ${order.orderId}? This action cannot be undone.`, 'Delete order')) return
    setDeletingOrderId(order.orderId)
    try {
      const response = await af('/api/admin/orders', {
        method: 'DELETE',
        body: JSON.stringify({ orderId: order.orderId, orderDbId: order.dbId || '' }),
      })
      if (!response.ok) {
        let message = 'Failed to delete order'
        try {
          const data = await response.json()
          message = String(data?.error || message)
        } catch {}
        throw new Error(message)
      }

      setOrders((prev) => prev.filter((row) => row.orderId !== order.orderId))
      setSelectedIds((prev) => prev.filter((id) => id !== order.orderId))
      if (viewingOrderId === order.orderId) setViewingOrderId(null)
      if (editingId === order.orderId) setEditingId(null)
    } catch (err: any) {
      alert(err?.message || 'Failed to delete order. Please try again.')
    } finally {
      setDeletingOrderId(null)
    }
  }

  const deleteSelectedOrders = async () => {
    if (!selectedOrders.length) return
    if (!await confirmAction(`Delete ${selectedOrders.length} selected order(s)? This action cannot be undone.`, 'Delete selected orders')) return

    setDeletingBulk(true)
    try {
      const results = await Promise.all(selectedOrders.map(async (order) => {
        const response = await af('/api/admin/orders', {
          method: 'DELETE',
          body: JSON.stringify({ orderId: order.orderId, orderDbId: order.dbId || '' }),
        })

        if (response.ok) return { orderId: order.orderId, ok: true, error: '' }

        let message = 'Failed to delete order'
        try {
          const data = await response.json()
          message = String(data?.error || message)
        } catch {}
        return { orderId: order.orderId, ok: false, error: message }
      }))

      const successIds = results.filter((r) => r.ok).map((r) => r.orderId)
      const failures = results.filter((r) => !r.ok)

      if (successIds.length > 0) {
        const successSet = new Set(successIds)
        setOrders((prev) => prev.filter((row) => !successSet.has(row.orderId)))
        setSelectedIds((prev) => prev.filter((id) => !successSet.has(id)))
      }

      if (failures.length > 0) {
        const errorText = failures.map((f) => `${f.orderId}: ${f.error}`).join('\n')
        alert(`Some orders could not be deleted:\n${errorText}`)
      }
    } finally {
      setDeletingBulk(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-slate-400">Loading orders…</div>

  return (
    <div className="space-y-6">
      <SectionHeader title="Orders" subtitle={`${orders.length} total orders`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={() => downloadBills(selectedOrders)} variant="ghost" size="sm" disabled={selectedOrders.length === 0}><ReceiptText size={14} /> Download Bill ({selectedOrders.length})</Btn>
            <Btn onClick={() => downloadShippingLabels(selectedOrders)} variant="ghost" size="sm" disabled={selectedOrders.length === 0}><Truck size={14} /> Download Shipping Label ({selectedOrders.length})</Btn>
            <Btn onClick={() => downloadCSV(selectedOrders)} variant="ghost" size="sm" disabled={selectedOrders.length === 0}><Download size={14} /> Download Orders(csv) ({selectedOrders.length})</Btn>
            <Btn onClick={deleteSelectedOrders} variant="danger" size="sm" disabled={selectedOrders.length === 0 || deletingBulk}>{deletingBulk ? 'Deleting…' : <><Trash2 size={14} /> Delete Selected ({selectedOrders.length})</>}</Btn>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total"    value={stats.totalOrders}   sub={`${stats.todayOrders} today`} />
          <StatCard label="Pending"  value={stats.pendingOrders}  accent="text-amber-300" />
          <StatCard label="Today Revenue" value={`₹${(stats.todayRevenue ?? 0).toLocaleString('en-IN')}`} accent="text-emerald-400" />
          <StatCard label="Total Revenue" value={`₹${(stats.totalRevenue ?? 0).toLocaleString('en-IN')}`} accent="text-blue-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Inp placeholder="Search order ID, customer, phone…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex flex-wrap gap-2">
          {['All','Pending','Confirmed','Processing','Shipped','In Transit','Delivered','Returned','Cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === s ? 'bg-accent text-white' : 'border border-white/15 text-slate-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
        <Btn size="sm" variant="ghost" onClick={toggleSelectAllVisible}>{allVisibleSelected ? 'Unselect Visible' : 'Select Visible'}</Btn>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                </th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const isSelected = selectedIds.includes(order.orderId)
                return (
                  <tr key={order.orderId} className={`border-b border-white/5 transition hover:bg-white/5 ${isSelected ? 'bg-white/5' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.orderId)} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">{order.orderId}</td>
                    <td className="px-4 py-3 font-semibold text-white">{order.customerName}</td>
                    <td className="px-4 py-3 text-slate-300">{order.customerPhone}</td>
                    <td className="px-4 py-3 font-bold text-white">₹{(order.grandTotal || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        disabled={updating === order.orderId}
                        onChange={(event) => updateStatus(order.orderId, event.target.value)}
                        className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                      >
                        {['Pending','Confirmed','Processing','Shipped','In Transit','Delivered','Returned','Cancelled'].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">{order.date ? new Date(order.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
                          onClick={() => setViewingOrderId(order.orderId)}
                          aria-label="View order"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
                          onClick={() => {
                            setEditingId(order.orderId)
                            setEditForm({
                              customerName: order.customerName,
                              customerPhone: order.customerPhone,
                              address: order.address,
                              doorNumber: order.doorNumber || '',
                              city: order.city || '',
                              pincode: order.pincode || '',
                              paymentMethod: order.paymentMethod || '',
                              paymentStatus: order.paymentStatus || '',
                              trackingId: order.trackingId || '',
                              courierName: order.courierName || '',
                              trackingBarcode: order.trackingBarcode || '',
                            })
                          }}
                          aria-label="Edit order"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
                          onClick={() => {
                            setScanTargetOrderId(order.orderId)
                            setScanValue(order.trackingId || order.trackingBarcode || '')
                            setScanModalOpen(true)
                          }}
                          aria-label="Scan tracking"
                          title="Scan Tracking"
                        >
                          <ScanLine size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
                          onClick={() => {
                            try {
                              downloadBills([order])
                            } catch {
                              alert('Failed to generate bill file. Please try again.')
                            }
                          }}
                          aria-label="Download bill"
                          title="Download Bill"
                        >
                          <ReceiptText size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/8 px-2 py-1 text-xs text-slate-200 hover:bg-white/15"
                          onClick={() => {
                            try {
                              downloadShippingLabels([order])
                            } catch {
                              alert('Failed to generate shipping label file. Please try again.')
                            }
                          }}
                          aria-label="Download shipping label"
                          title="Download Shipping Label"
                        >
                          <Truck size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                          onClick={() => deleteOrder(order)}
                          disabled={deletingOrderId === order.orderId}
                          aria-label="Delete order"
                          title="Delete Order"
                        >
                          {deletingOrderId === order.orderId ? '…' : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No orders found.</p>}
        </div>
      </Card>

      {editingId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-2xl p-5">
            <p className="text-sm font-bold text-white">Edit Order {editingId}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ['customerName','Customer Name'],
                ['customerPhone','Phone'],
                ['doorNumber','Door Number'],
                ['address','Street Address'],
                ['city','City'],
                ['pincode','Pincode'],
                ['paymentMethod','Payment Mode'],
                ['paymentStatus','Payment Status'],
                ['trackingId','Tracking ID'],
                ['courierName','Courier Name'],
                ['trackingBarcode','Tracking Barcode'],
              ] as [keyof typeof editForm,string][]).map(([k,l]) => (
                <div key={k}><label className="mb-1 block text-[11px] font-semibold uppercase text-slate-400">{l}</label>
                  <Inp value={editForm[k]} onChange={e => setEditForm(f => ({...f, [k]: e.target.value}))} /></div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Btn type="button" onClick={() => saveEdit(editingId)} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</Btn>
              <Btn type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Btn>
            </div>
          </Card>
        </div>
      )}

      {viewingOrderId && (() => {
        const order = orders.find((o) => o.orderId === viewingOrderId)
        if (!order) return null
        const items = parseOrderItems(order.productsJSON)
        return (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
            <Card className="w-full max-w-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Order {order.orderId}</p>
                  <p className="mt-1 text-xs text-slate-400">{order.date ? new Date(order.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} · {order.status}</p>
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setViewingOrderId(null)}>Close</Btn>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase text-slate-500">Customer</p>
                  <p className="mt-1 font-semibold text-white">{order.customerName}</p>
                  <p className="text-slate-300">{order.customerPhone}</p>
                  <p className="mt-1 text-slate-400">{order.address}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase text-slate-500">Logistics</p>
                  <p className="mt-1 text-slate-300">Courier: {order.courierName || 'N/A'}</p>
                  <p className="text-slate-300">Tracking ID: {order.trackingId || 'N/A'}</p>
                  <p className="text-slate-300">Payment: {order.paymentMethod || 'N/A'} · {order.paymentStatus || 'N/A'}</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, index: number) => {
                      const qty = Number(item?.qty || 1)
                      const price = Number(item?.price || 0)
                      return (
                        <tr key={`${String(item?.name || 'item')}-${index}`} className="border-b border-white/5">
                          <td className="px-3 py-2 text-slate-200">{String(item?.name || 'Item')}</td>
                          <td className="px-3 py-2 text-slate-300">{qty}</td>
                          <td className="px-3 py-2 text-slate-300">₹{price.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 font-semibold text-white">₹{(qty * price).toLocaleString('en-IN')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      })()}

      {scanModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md p-5">
            <p className="text-sm font-bold text-white">Scan Tracking Number</p>
            <p className="mt-1 text-xs text-slate-400">Order: {scanTargetOrderId || '—'}. Scanned/entered value will be stored in Tracking ID.</p>

            {cameraSupported && (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
                <video ref={videoRef} className="h-52 w-full object-cover" autoPlay playsInline muted />
              </div>
            )}
            {!cameraSupported && <p className="mt-3 text-xs text-amber-300">Camera scanning is not supported on this browser. Use manual input below.</p>}
            {cameraActive && <p className="mt-2 text-xs text-emerald-300">Camera active. Point barcode to camera.</p>}
            {scanError && <p className="mt-2 text-xs text-red-300">{scanError}</p>}

            <Inp
              autoFocus
              className="mt-4"
              placeholder="Scan or enter tracking number"
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
            />

            <div className="mt-4 flex gap-2">
              <Btn onClick={saveScannedTracking} disabled={scanSaving}>{scanSaving ? 'Saving…' : 'Save to Tracking ID'}</Btn>
              <Btn variant="ghost" onClick={() => setScanModalOpen(false)}>Close</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Products section ─────────────────────────────────────────────────────────
function ProductsSection({ token }: { token: string }) {
  const af = useAdminFetch(token)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const empty = { name:'', category:'', brand:'', price:'', offerPrice:'', stock:'', image:'', imageUrlsText:'', description:'' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() =>
    af('/api/admin/products').then(r => r.json()).then(d => setProducts(d.products || [])).finally(() => setLoading(false)),
  [af])
  useEffect(() => { load() }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!await confirmAction('Save this new product?')) return
    setSaving(true)
    try {
      const imageUrls = parseImageUrls(form.imageUrlsText)
      await af('/api/admin/products', { method: 'POST', body: JSON.stringify({ product: { ...form, price: Number(form.price), offerPrice: Number(form.offerPrice), stock: Number(form.stock), imageUrls } }) })
      await load(); setForm(empty); setShowForm(false)
    } finally { setSaving(false) }
  }

  const startEdit = (product: Product) => {
    setEditingId(product.productId)
    setShowForm(true)
    setForm({
      name: product.name || '',
      category: product.category || '',
      brand: product.brand || '',
      price: String(product.price || ''),
      offerPrice: String(product.offerPrice || ''),
      stock: String(product.stock || ''),
      image: product.image || '',
      imageUrlsText: (product.images || []).join('\n'),
      description: product.description || '',
    })
  }

  const updateProduct = async (productId: string) => {
    if (!await confirmAction('Update this product?')) return
    setSaving(true)
    try {
      const imageUrls = parseImageUrls(form.imageUrlsText)
      await af('/api/admin/products', {
        method: 'PATCH',
        body: JSON.stringify({
          productId,
          updates: {
            name: form.name,
            category: form.category,
            brand: form.brand,
            description: form.description,
            price: Number(form.price || 0),
            offerPrice: Number(form.offerPrice || form.price || 0),
            stock: Number(form.stock || 0),
            imageUrls,
          },
        }),
      })
      await load()
      setForm(empty)
      setShowForm(false)
      setEditingId(null)
    } finally { setSaving(false) }
  }

  const deleteProduct = async (productId: string, productName: string) => {
    if (!await confirmAction(`Delete "${productName}"? This cannot be undone.`, 'Delete product')) return
    try {
      await af('/api/admin/products', { method: 'DELETE', body: JSON.stringify({ productId }) })
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete product')
    }
  }

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="py-20 text-center text-sm text-slate-400">Loading products…</div>

  return (
    <div className="space-y-6">
      <SectionHeader title="Products" subtitle={`${products.length} products in catalog`}
        action={<Btn onClick={() => setShowForm(!showForm)}>+ Add Product</Btn>}
      />

      {showForm && (
        <Card className="p-6">
          <p className="mb-4 font-bold text-white">{editingId ? 'Edit Product' : 'New Product'}</p>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (editingId) updateProduct(editingId)
            else save(e)
          }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {([['name','Product Name *'],['category','Category'],['brand','Brand']] as [string,string][]).map(([k,l]) => (
                <div key={k}><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">{l}</label>
                  <Inp required={k==='name'} value={(form as any)[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} /></div>
              ))}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Multiple Image URLs</label>
                <textarea rows={4} className="w-full resize-none rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  placeholder="One URL per line (or comma-separated)"
                  value={form.imageUrlsText}
                  onChange={e => setForm(f => ({...f, imageUrlsText: e.target.value}))} />
                {parseImageUrls(form.imageUrlsText).slice(0, 4).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {parseImageUrls(form.imageUrlsText).slice(0, 4).map((url, index) => (
                      <img
                        key={`${url}-${index}`}
                        src={toRenderableAssetUrl(url)}
                        alt={`preview ${index + 1}`}
                        className="h-20 w-full rounded-xl object-cover border border-white/10"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {([['price','Price ₹ *'],['offerPrice','Offer Price ₹'],['stock','Stock qty']] as [string,string][]).map(([k,l]) => (
                <div key={k}><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">{l}</label>
                  <Inp type="number" required={k==='price'} value={(form as any)[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} /></div>
              ))}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Description</label>
                <textarea rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Product' : 'Save Product'}</Btn>
              <Btn type="button" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(empty) }}>Cancel</Btn>
            </div>
          </form>
        </Card>
      )}

      <Inp placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">MRP</th><th className="px-4 py-3">Offer</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.productId} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {(p.images?.[0] || p.image)
                        ? <img src={toRenderableAssetUrl(p.images?.[0] || p.image)} alt={p.name} className="h-10 w-10 rounded-xl object-cover border border-white/10" />
                        : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xs text-slate-400">IMG</div>
                      }
                      <div>
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{p.category}</td>
                  <td className="px-4 py-3 text-slate-400">₹{p.price}</td>
                  <td className="px-4 py-3 font-semibold text-white">₹{p.offerPrice || p.price}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.stock > 5 ? 'bg-emerald-400/15 text-emerald-300' : p.stock > 0 ? 'bg-amber-400/15 text-amber-300' : 'bg-red-400/15 text-red-300'}`}>
                      {p.stock > 0 ? `${p.stock} left` : 'Out of stock'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => startEdit(p)}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => deleteProduct(p.productId, p.name)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No products found.</p>}
        </div>
      </Card>
    </div>
  )
}

// ─── Website Config section ───────────────────────────────────────────────────
function WebConfigSection({ token, onBusinessNameChange, features }: { token: string; onBusinessNameChange?: (name: string) => void; features: SubscriptionFeatureMap }) {
  const af = useAdminFetch(token)
  const canBanners = Boolean(features.banners)
  const canCoupons = Boolean(features.coupons)
  const tabs = (['store', 'marketing', ...(canBanners ? ['banners'] : []), ...(canCoupons ? ['coupons'] : [])] as Array<'store'|'banners'|'coupons'|'marketing'>)
  const [subTab, setSubTab] = useState<'store'|'banners'|'coupons'|'marketing'>(tabs[0] || 'store')

  const [banners, setBanners] = useState<Banner[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loadingB, setLoadingB] = useState(true)
  const [loadingC, setLoadingC] = useState(true)
  const [loadingM, setLoadingM] = useState(true)
  const [savingB, setSavingB]   = useState(false)
  const [savingC, setSavingC]   = useState(false)
  const [savingM, setSavingM] = useState<'store' | 'marketing' | null>(null)
  const [savedM, setSavedM] = useState<'store' | 'marketing' | null>(null)
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const emptyB = { title:'', subtitle:'', imageUrl:'', linkUrl:'', buttonText:'Shop now' }
  const emptyC = { code:'', type:'percent', value:'', minOrder:'', expiry:'' }
  const storeFields = STORE_SETTINGS_FIELDS.filter((field) => ['BusinessName', 'Address', 'WhatsAppNumber', 'DeliveryCharge', 'LogoURL'].includes(field.key))
  const marketingFields = STORE_SETTINGS_FIELDS.filter((field) => ['OfferLabel', 'OfferTitle', 'OfferSubtitle', 'AnnouncementBar'].includes(field.key))
  const [formB, setFormB] = useState(emptyB)
  const [formC, setFormC] = useState(emptyC)

  const loadB = useCallback(() => af('/api/admin/banners').then(r => r.json()).then(d => setBanners(d.banners || [])).finally(() => setLoadingB(false)), [af])
  const loadC = useCallback(() => af('/api/admin/coupons').then(r => r.json()).then(d => setCoupons(d.coupons || [])).finally(() => setLoadingC(false)), [af])
  const loadM = useCallback(async () => {
    try {
      const [adminSettingsRes, storefrontSettingsRes] = await Promise.all([
        af('/api/admin/settings').then((r) => r.json()).catch(() => ({ settings: {} })),
        fetch(withTenantPrefix('/api/settings'), { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ])

      const kv = (adminSettingsRes?.settings || {}) as Record<string, string>
      const merged: Record<string, string> = {
        ...kv,
        BusinessName: String(kv.BusinessName || storefrontSettingsRes?.businessName || '').trim(),
        WhatsAppNumber: String(kv.WhatsAppNumber || storefrontSettingsRes?.whatsappNumber || '').trim(),
        DeliveryCharge: String(kv.DeliveryCharge || storefrontSettingsRes?.deliveryCharge || '').trim(),
        LogoURL: String(kv.LogoURL || storefrontSettingsRes?.logoUrl || '').trim(),
      }

      setSettings(merged)
    } finally {
      setLoadingM(false)
    }
  }, [af])
  useEffect(() => {
    if (canBanners) {
      loadB()
    } else {
      setLoadingB(false)
      setBanners([])
    }

    if (canCoupons) {
      loadC()
    } else {
      setLoadingC(false)
      setCoupons([])
    }

    loadM()
  }, [canBanners, canCoupons, loadB, loadC, loadM])

  useEffect(() => {
    if (!tabs.includes(subTab)) {
      setSubTab(tabs[0] || 'store')
    }
  }, [subTab, tabs])

  const saveB = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingB) return
    if (editingBannerId) {
      if (!await confirmAction('Update this banner?')) return
      setSavingB(true)
      try {
        await af('/api/admin/banners', { method: 'PATCH', body: JSON.stringify({ bannerId: editingBannerId, banner: formB }) })
        await loadB()
        setFormB(emptyB)
        setEditingBannerId(null)
        await showSavedPopup('Banner updated successfully.')
      } finally { setSavingB(false) }
      return
    }
    if (!await confirmAction('Save this banner?')) return
    setSavingB(true)
    try {
      await af('/api/admin/banners', { method:'POST', body: JSON.stringify({ banner: formB }) })
      await loadB()
      setFormB(emptyB)
      await showSavedPopup('Banner saved successfully.')
    } finally {
      setSavingB(false)
    }
  }

  const saveC = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingC) return
    if (!await confirmAction('Create this coupon?')) return
    setSavingC(true)
    try {
      await af('/api/admin/coupons', { method:'POST', body: JSON.stringify({ coupon: { ...formC, value: Number(formC.value), minOrder: Number(formC.minOrder) } }) })
      await loadC()
      setFormC(emptyC)
      await showSavedPopup('Coupon created successfully.')
    } finally {
      setSavingC(false)
    }
  }

  const saveM = async (tab: 'store' | 'marketing', keys: string[]) => {
    if (savingM) return
    if (!await confirmAction(`Save ${tab === 'store' ? 'Store' : 'Marketing'} settings?`)) return
    setSavingM(tab)
    try {
      const responses = await Promise.all(keys.map((key) =>
        af('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value: settings[key] ?? '' }) })
      ))

      for (const response of responses) {
        if (!response.ok) {
          let message = 'Failed to save settings'
          try {
            const data = await response.json()
            message = String(data?.error || message)
          } catch {}
          throw new Error(message)
        }
      }

      await loadM()
      if (tab === 'store') {
        const refreshed = await fetch(withTenantPrefix('/api/settings'), { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
        const latestBusinessName = String(refreshed?.businessName || settings.BusinessName || '').trim()
        if (latestBusinessName) onBusinessNameChange?.(latestBusinessName)
      }
      setSavedM(tab)
      setTimeout(() => setSavedM(null), 2500)
      await showSavedPopup(`${tab === 'store' ? 'Store' : 'Marketing'} settings saved successfully.`)
    } catch (err: any) {
      alert(err?.message || 'Failed to save settings. Please try again.')
    } finally {
      setSavingM(null)
    }
  }
  const delB  = async (id: string) => {
    if (!await confirmAction('Delete this banner?')) return
    try {
      const res = await af('/api/admin/banners', { method:'DELETE', body: JSON.stringify({ bannerId: id }) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Failed to delete banner')
        return
      }
      await loadB()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete banner')
    }
  }

  const delC  = async (code: string) => {
    if (!await confirmAction(`Delete coupon ${code}?`)) return
    await af('/api/admin/coupons', { method:'DELETE', body: JSON.stringify({ code }) })
    await loadC()
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Website Configuration" subtitle="Manage banners, coupons, and marketing settings" />
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition capitalize ${subTab === t ? 'bg-accent text-white' : 'border border-white/15 text-slate-400 hover:text-white'}`}>
            {t === 'store' ? '🏪 Store' : t === 'banners' ? '🖼️ Banners' : t === 'coupons' ? '🎟️ Coupons' : '📣 Marketing'}
          </button>
        ))}
      </div>

      {subTab === 'store' && (
        <div className="space-y-5">
          {loadingM
            ? <p className="text-center text-sm text-slate-400">Loading store settings…</p>
            : (
              <Card className="p-5">
                <p className="mb-4 font-bold text-white">Storefront Identity & Commerce</p>
                <div className="space-y-4">
                  {storeFields.map((f) => (
                    <div key={f.key}>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">{f.label}</label>
                      <Inp
                        type={f.type}
                        placeholder={f.placeholder}
                        value={settings[f.key] ?? ''}
                        onChange={(e) => setSettings((state) => ({ ...state, [f.key]: e.target.value }))}
                      />
                      {f.key === 'LogoURL' && settings.LogoURL && (
                        <img src={toRenderableAssetUrl(settings.LogoURL)} alt="logo preview" className="mt-2 h-12 w-12 rounded-xl object-contain border border-white/10 bg-white/5" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <Btn
                    type="button"
                    variant={savedM === 'store' ? 'success' : 'primary'}
                    disabled={savingM === 'store'}
                    onClick={() => saveM('store', storeFields.map((f) => f.key))}
                  >
                    {savingM === 'store' ? 'Saving…' : savedM === 'store' ? '✓ Saved Store Settings' : 'Save Store Settings'}
                  </Btn>
                </div>
              </Card>
            )}
        </div>
      )}

      {subTab === 'marketing' && (
        <div className="space-y-5">
          {loadingM
            ? <p className="text-center text-sm text-slate-400">Loading marketing settings…</p>
            : (
              <Card className="p-5">
                <p className="mb-4 font-bold text-white">Marketing Controls</p>
                <div className="space-y-4">
                  {marketingFields.map((f) => (
                    <div key={f.key}>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">{f.label}</label>
                      <Inp
                        type={f.type}
                        placeholder={f.placeholder}
                        value={settings[f.key] ?? ''}
                        onChange={(e) => setSettings((state) => ({ ...state, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <Btn
                    type="button"
                    variant={savedM === 'marketing' ? 'success' : 'primary'}
                    disabled={savingM === 'marketing'}
                    onClick={() => saveM('marketing', marketingFields.map((f) => f.key))}
                  >
                    {savingM === 'marketing' ? 'Saving…' : savedM === 'marketing' ? '✓ Saved Marketing Settings' : 'Save Marketing Settings'}
                  </Btn>
                </div>
              </Card>
            )}
        </div>
      )}

      {subTab === 'banners' && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold text-white">{editingBannerId ? '✏️ Edit Banner' : 'Add Banner'}</p>
              {editingBannerId && (
                <button type="button" onClick={() => { setEditingBannerId(null); setFormB(emptyB) }} className="text-xs font-semibold text-slate-400 hover:text-white transition">
                  ✕ Cancel edit
                </button>
              )}
            </div>
            <form onSubmit={saveB} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Title *</label><Inp required value={formB.title} onChange={e => setFormB(f => ({...f, title: e.target.value}))} /></div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Image URL <span className="normal-case font-normal text-slate-500">(Public image link / Google Drive share link)</span></label>
                  <Inp required placeholder="https://..." value={formB.imageUrl} onChange={e => setFormB(f => ({...f, imageUrl: e.target.value}))} />
                  {formB.imageUrl && <img src={toRenderableAssetUrl(formB.imageUrl)} alt="preview" className="mt-2 h-24 w-48 rounded-xl object-cover border border-white/10" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />}
                </div>
                <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Link URL</label><Inp value={formB.linkUrl} onChange={e => setFormB(f => ({...f, linkUrl: e.target.value}))} /></div>
                <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Button Text</label><Inp value={formB.buttonText} onChange={e => setFormB(f => ({...f, buttonText: e.target.value}))} /></div>
                <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Subtitle</label><Inp value={formB.subtitle} onChange={e => setFormB(f => ({...f, subtitle: e.target.value}))} /></div>
              </div>
              <Btn type="submit" disabled={savingB}>{savingB ? 'Saving…' : editingBannerId ? 'Update Banner' : 'Add Banner'}</Btn>
            </form>
          </Card>
          {loadingB
            ? <p className="text-center text-sm text-slate-400">Loading banners…</p>
            : <div className="space-y-3">
                {banners.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No banners yet.</p>}
                {banners.map(b => (
                  <Card key={b.bannerId} className="flex items-center gap-4 p-4">
                    {b.imageUrl && <img src={toRenderableAssetUrl(b.imageUrl)} alt={b.title} className="h-16 w-28 shrink-0 rounded-xl object-cover border border-white/10" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white">{b.title}</p>
                      {b.subtitle && <p className="text-xs text-slate-400 truncate">{b.subtitle}</p>}
                      {b.linkUrl && <p className="text-xs text-accent truncate">{b.linkUrl}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => { setEditingBannerId(b.bannerId); setFormB({ title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, linkUrl: b.linkUrl, buttonText: b.buttonText }) }}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => delB(b.bannerId)}>Delete</Btn>
                    </div>
                  </Card>
                ))}
              </div>
          }
        </div>
      )}

      {subTab === 'coupons' && (
        <div className="space-y-5">
          <Card className="p-5">
            <p className="mb-4 font-bold text-white">Create Coupon</p>
            <form onSubmit={saveC} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Code *</label><Inp required placeholder="SAVE20" value={formC.code} onChange={e => setFormC(f => ({...f, code: e.target.value.toUpperCase()}))} /></div>
                <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Type</label><Sel value={formC.type} onChange={e => setFormC(f => ({...f, type: e.target.value}))}><option value="percent">Percent (%)</option><option value="flat">Flat (₹)</option></Sel></div>
                <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Value *</label><Inp required type="number" value={formC.value} onChange={e => setFormC(f => ({...f, value: e.target.value}))} /></div>
                <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Min Order ₹</label><Inp type="number" placeholder="0" value={formC.minOrder} onChange={e => setFormC(f => ({...f, minOrder: e.target.value}))} /></div>
                <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Expiry Date</label><Inp type="date" value={formC.expiry} onChange={e => setFormC(f => ({...f, expiry: e.target.value}))} /></div>
              </div>
              <Btn type="submit" disabled={savingC}>{savingC ? 'Creating…' : 'Create Coupon'}</Btn>
            </form>
          </Card>
          {loadingC
            ? <p className="text-center text-sm text-slate-400">Loading coupons…</p>
            : <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/10 text-left text-[11px] font-bold uppercase text-slate-500">
                      <th className="px-4 py-3">Code</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Min</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
                    </tr></thead>
                    <tbody>
                      {coupons.map(c => (
                        <tr key={c.code} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="px-4 py-3 font-mono font-bold text-white">{c.code}</td>
                          <td className="px-4 py-3 font-semibold text-accent">{c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`}</td>
                          <td className="px-4 py-3 text-slate-400">{c.minOrder > 0 ? `₹${c.minOrder}` : '—'}</td>
                          <td className="px-4 py-3 text-slate-400">{c.expiry || '—'}</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${c.active === 'false' ? 'bg-red-400/20 text-red-300' : 'bg-emerald-400/20 text-emerald-300'}`}>{c.active === 'false' ? 'Inactive' : 'Active'}</span></td>
                          <td className="px-4 py-3"><Btn size="sm" variant="danger" onClick={() => delC(c.code)}>Delete</Btn></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {coupons.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No coupons yet.</p>}
                </div>
              </Card>
          }
        </div>
      )}
    </div>
  )
}

// ─── Leads section ────────────────────────────────────────────────────────────
type Lead = { id: string; sid?: string; name: string; whatsapp: string; source: string; created_at: string; browser_id?: string }

function LeadsSection({ token }: { token: string }) {
  const af = useAdminFetch(token)
  const [leads, setLeads]   = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await af('/api/leads')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load leads')
      }
      setLeads(data.leads || [])
    } catch (err: any) {
      setLeads([])
      setError(String(err?.message || 'Failed to load leads'))
    } finally {
      setLoading(false)
    }
  }, [af])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const downloadCSV = () => {
    const headers = ['Name','WhatsApp','Source','Date']
    const rows = filtered.map(l => [l.name, l.whatsapp, l.source, l.created_at ? new Date(l.created_at).toLocaleString('en-IN') : ''])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `leads_${new Date().toISOString().slice(0,10)}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const filtered = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.whatsapp.includes(search))

  if (loading) return <div className="py-20 text-center text-sm text-slate-400">Loading leads…</div>

  return (
    <div className="space-y-6">
      <SectionHeader title="Leads" subtitle={`${leads.length} captured leads`}
        action={
          <div className="flex items-center gap-2">
            <Btn onClick={loadLeads} variant="ghost" size="sm" className="border-cyan-700 bg-cyan-600 text-white shadow-[0_6px_14px_rgba(8,145,178,0.28)] hover:bg-cyan-700 hover:text-white">Refresh</Btn>
            <Btn onClick={downloadCSV} variant="ghost" size="sm"><Download size={14} /> Download CSV</Btn>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total Leads" value={leads.length} />
        <StatCard label="WhatsApp Leads" value={leads.filter(l => l.source === 'popup').length} />
        <StatCard label="Platform Enquiries" value={leads.filter(l => l.source === 'platform_enquiry').length} />
      </div>

      <Inp placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10 text-left text-[11px] font-bold uppercase text-slate-500">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">WhatsApp</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Action</th>
            </tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3 font-semibold text-white">{l.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{l.whatsapp}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-bold text-accent">{l.source}</span></td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">{l.created_at ? new Date(l.created_at).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) : '—'}</td>
                  <td className="px-4 py-3">
                    <a href={`https://wa.me/${l.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition">
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No leads found.</p>}
        </div>
      </Card>
    </div>
  )
}

// ─── Settings section ─────────────────────────────────────────────────────────
const STORE_SETTINGS_FIELDS = [
  { key: 'BusinessName',    label: 'Business Name',          type: 'text',     placeholder: 'My Store', group: 'store', help: 'Primary storefront brand name' },
  { key: 'Address',         label: 'Business Address',       type: 'text',     placeholder: '123 Main St, City', group: 'store', help: 'Display address shown on public pages' },
  { key: 'WhatsAppNumber',  label: 'WhatsApp Number',        type: 'tel',      placeholder: '9191234567890', group: 'store', help: 'Customer support / order WhatsApp number' },
  { key: 'SupportPhone',    label: 'Support Phone',          type: 'tel',      placeholder: '919876543210', group: 'store', help: 'Optional secondary contact number' },
  { key: 'SupportEmail',    label: 'Support Email',          type: 'email',    placeholder: 'support@yourstore.com', group: 'store', help: 'Optional support email for footer/help pages' },
  { key: 'DeliveryCharge',  label: 'Delivery Charge (₹)',    type: 'number',   placeholder: '40', group: 'store', help: 'Default charge used in checkout totals' },
  { key: 'CurrencyCode',    label: 'Currency Code',          type: 'text',     placeholder: 'INR', group: 'store', help: 'Display currency code (example: INR, USD)' },
  { key: 'TaxLabel',        label: 'Tax Label',              type: 'text',     placeholder: 'GST', group: 'store', help: 'Label for tax shown in billing summaries' },
  { key: 'TaxPercent',      label: 'Tax Percent',            type: 'number',   placeholder: '18', group: 'store', help: 'Optional tax percentage for display/calculation use' },
  { key: 'LogoURL',         label: 'Logo URL',               type: 'url',      placeholder: 'https://... (Public image / Drive link)', group: 'store', help: 'Brand logo used in storefront header' },
  { key: 'ThemePreset',     label: 'Storefront Theme',       type: 'select',   placeholder: '', group: 'store', help: 'Choose the storefront theme preset' },

  { key: 'OfferLabel',      label: 'Offer Popup Label',      type: 'text',     placeholder: 'Exclusive offer', group: 'marketing', help: 'Small badge text at top of lead popup' },
  { key: 'OfferTitle',      label: 'Offer Popup Title',      type: 'text',     placeholder: 'Get 10% off', group: 'marketing', help: 'Main heading in lead popup' },
  { key: 'OfferSubtitle',   label: 'Offer Popup Subtitle',   type: 'text',     placeholder: 'For first-time buyers', group: 'marketing', help: 'Supporting text in lead popup' },
  { key: 'AnnouncementBar', label: 'Announcement Ticker',    type: 'text',     placeholder: 'Message 1 | Message 2 | Message 3', group: 'marketing', help: 'Separate multiple ticker messages using |' },
  { key: 'ReturnPolicy',    label: 'Return Policy',          type: 'text',     placeholder: '7-day easy return on eligible items', group: 'marketing', help: 'Short policy message for trust sections' },
  { key: 'ShippingPolicy',  label: 'Shipping Policy',        type: 'text',     placeholder: 'Dispatch in 24 hours, delivery in 1-3 days', group: 'marketing', help: 'Short shipping promise for storefront messaging' },

  { key: 'InstagramURL',    label: 'Instagram URL',          type: 'url',      placeholder: 'https://instagram.com/yourstore', group: 'social', help: 'Optional public social link' },
  { key: 'FacebookURL',     label: 'Facebook URL',           type: 'url',      placeholder: 'https://facebook.com/yourstore', group: 'social', help: 'Optional public social link' },
  { key: 'YouTubeURL',      label: 'YouTube URL',            type: 'url',      placeholder: 'https://youtube.com/@yourstore', group: 'social', help: 'Optional public social link' },

  { key: 'AdminPassword',   label: 'Admin Password',         type: 'password', placeholder: '••••••••', group: 'admin', help: 'Update store admin password' },
]

function SettingsSection({ token }: { token: string }) {
  const af = useAdminFetch(token)
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [saved, setSaved]       = useState<string | null>(null)
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  useEffect(() => {
    af('/api/admin/settings').then(r => r.json()).then(d => setSettings(d.settings || {})).finally(() => setLoading(false))
  }, [af])

  const save = async (key: string) => {
    if (saving) return
    if (!await confirmAction(`Save ${key} setting?`)) return
    setSaving(key)
    try {
      const response = await af('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value: settings[key] ?? '' }) })
      if (!response.ok) {
        let message = 'Failed to save setting'
        try {
          const data = await response.json()
          message = String(data?.error || message)
        } catch {}
        throw new Error(message)
      }
      setSaved(key); setTimeout(() => setSaved(null), 2500)
      await showSavedPopup(`${key} saved successfully.`)
    } catch (err: any) {
      alert(err?.message || 'Failed to save setting. Please try again.')
    } finally { setSaving(null) }
  }

  if (loading) return <div className="py-20 text-center text-sm text-slate-400">Loading settings…</div>

  const groups = [
    {
      key: 'operations',
      label: 'Business Ops & Billing',
      keys: ['SupportPhone', 'SupportEmail', 'CurrencyCode', 'TaxLabel', 'TaxPercent', 'ThemePreset', 'ReturnPolicy', 'ShippingPolicy'],
    },
    {
      key: 'social',
      label: 'Social Links',
      keys: ['InstagramURL', 'FacebookURL', 'YouTubeURL'],
    },
    {
      key: 'admin',
      label: 'Admin Access',
      keys: ['AdminPassword'],
    },
  ]

  return (
    <div className="space-y-8">
      <SectionHeader title="Settings" subtitle="Configure advanced business, social, and admin preferences" />
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-amber-300">
        💡 For images (Logo, Banners, Products), paste a public image URL or a <strong>Google Drive share link</strong>. Drive link format: <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">https://drive.google.com/uc?export=view&id=FILE_ID</code>
      </div>
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-4 text-sm text-cyan-200">
        Primary storefront identity and marketing content are managed in <strong>Website Configuration</strong> (Store + Marketing tabs).
      </div>
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/8 p-4 text-sm text-sky-200">
        Admin Login ID can only be changed by platform admin. You can only update Admin Password here.
      </div>

      {groups.map(g => (
        <div key={g.key} className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.label}</p>
          {STORE_SETTINGS_FIELDS.filter((field) => g.keys.includes(field.key)).map(f => (
            <Card key={f.key} className="p-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">{f.label}</label>
              {f.help ? <p className="mb-2 text-xs text-slate-500">{f.help}</p> : null}
              <div className="flex gap-2">
                {f.type === 'select' ? (
                  <Sel
                    value={settings[f.key] ?? 'classic'}
                    onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                  >
                    <option value="classic">Classic Blue</option>
                    <option value="ocean">Ocean Blue</option>
                    <option value="forest">Forest Green</option>
                    <option value="sunset">Sunset Orange</option>
                    <option value="midnight">Midnight Purple</option>
                  </Sel>
                ) : (
                  f.type === 'password' ? (
                    <div className="relative w-full">
                      <Inp
                        type={showAdminPassword ? 'text' : 'password'}
                        placeholder={f.placeholder}
                        className="pr-10"
                        value={settings[f.key] ?? ''}
                        onChange={e => setSettings(s => ({...s, [f.key]: e.target.value}))}
                      />
                      <button
                        type="button"
                        aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowAdminPassword((state) => !state)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-200"
                      >
                        {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  ) : (
                    <Inp type={f.type} placeholder={f.placeholder}
                      value={settings[f.key] ?? ''}
                      onChange={e => setSettings(s => ({...s, [f.key]: e.target.value}))}
                    />
                  )
                )}
                <Btn type="button" size="sm" variant={saved === f.key ? 'success' : 'primary'} disabled={saving === f.key}
                  onClick={() => save(f.key)}>
                  {saving === f.key ? '…' : saved === f.key ? '✓ Saved' : 'Save'}
                </Btn>
              </div>
              {f.key === 'LogoURL' && settings.LogoURL && (
                <img src={toRenderableAssetUrl(settings.LogoURL)} alt="logo preview" className="mt-2 h-12 w-12 rounded-xl object-contain border border-white/10 bg-white/5" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
              )}
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Support section ──────────────────────────────────────────────────────────
function SupportSection({ token }: { token: string }) {
  const af = useAdminFetch(token)
  const [cat, setCat] = useState('')
  const [subject, setSubject] = useState('')
  const [msg, setMsg] = useState('')
  const [priority, setPriority] = useState('medium')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('all')

  const loadTickets = useCallback(() => {
    setLoading(true)
    af('/api/admin/support').then((res) => res.json()).then((data) => setTickets(data.tickets || [])).finally(() => setLoading(false))
  }, [af])

  useEffect(() => { loadTickets() }, [loadTickets])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      await af('/api/admin/support', {
        method: 'POST',
        body: JSON.stringify({
          category: cat,
          subject,
          description: msg,
          priority,
        }),
      })
      setCat('')
      setSubject('')
      setMsg('')
      setPriority('medium')
      loadTickets()
    } finally { setSending(false) }
  }

  const addComment = async (ticketId: string) => {
    const comment = String(commentDrafts[ticketId] || '').trim()
    if (!comment) return
    await af('/api/admin/support', {
      method: 'POST',
      body: JSON.stringify({ mode: 'comment', ticketId, comment }),
    })
    setCommentDrafts((state) => ({ ...state, [ticketId]: '' }))
    loadTickets()
  }

  const faqs = [
    { q: 'How do I add a new product?', a: 'Go to Products section → Click "Add Product" → Fill in the details and save.' },
    { q: 'How do I update product images?', a: 'Paste a public image URL or a Google Drive share link in the Image URL field.' },
    { q: 'How do I change my admin password?', a: 'Go to Settings → Admin Access → Update AdminPassword and click Save.' },
    { q: 'How do I set up WhatsApp order notifications?', a: 'Go to Website Config → Store → set WhatsApp Number, then orders will include your number in checkout links.' },
    { q: 'How can I add an announcement ticker?', a: 'Go to Website Config → Marketing → Announcement Ticker. Separate messages with | (pipe).' },
    { q: 'How do I export my order list?', a: 'Go to Orders section → click "Download CSV" to export all filtered orders.' },
  ]

  return (
    <div className="space-y-8">
      <SectionHeader title="Support & Help" subtitle="Raise support tickets, track responses, and collaborate with platform support." />

      {/* Quick help cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: <BookOpen size={28} />, title: 'Documentation', desc: 'Setup guides and feature docs', action: 'View Docs' },
          { icon: <MessageCircle size={28} />, title: 'WhatsApp Support', desc: 'Chat with the ImiqX team', action: 'Open Chat' },
          { icon: <Ticket size={28} />, title: 'Ticket Desk', desc: 'Structured ticket and comments workflow', action: 'Open Tickets' },
        ].map(({ icon, title, desc, action }) => (
          <Card key={title} className="p-5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-accent">{icon}</div>
            <p className="font-bold text-white">{title}</p>
            <p className="mt-1 text-xs text-slate-400">{desc}</p>
            <button className="mt-4 text-xs font-semibold text-accent hover:underline">{action} →</button>
          </Card>
        ))}
      </div>

      {/* FAQ */}
      <Card className="p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Frequently Asked Questions</p>
        <div className="space-y-3">
          {faqs.map(({ q, a }) => (
            <details key={q} className="rounded-xl bg-white/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-white">{q}</summary>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </Card>

      {/* Ticket form */}
      <Card className="p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Raise a Support Ticket</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Category *</label>
              <Sel required value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">Select a category…</option>
                <option value="Order issue">Order issue</option>
                <option value="Product catalog">Product catalog</option>
                <option value="Payment issue">Payment issue</option>
                <option value="Admin access">Admin access</option>
                <option value="Performance / bug">Performance / bug</option>
                <option value="Feature request">Feature request</option>
                <option value="Subscription & billing">Subscription & billing</option>
                <option value="Delivery / courier">Delivery / courier</option>
                <option value="Integrations">Integrations</option>
                <option value="Data mismatch">Data mismatch</option>
                <option value="Other">Other</option>
              </Sel>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Priority</label>
              <Sel value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Sel>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Subject *</label>
            <Inp required value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief title for your issue" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Describe your issue *</label>
            <textarea required rows={5} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Please describe the issue in detail…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
          <Btn type="submit" disabled={sending}>{sending ? 'Submitting…' : 'Create Ticket'}</Btn>
        </form>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">My Tickets</p>
          <Sel value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-[180px]">
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </Sel>
        </div>

        {loading && <p className="py-6 text-sm text-slate-400">Loading tickets…</p>}
        {!loading && tickets.filter((t) => filter === 'all' || t.status === filter).length === 0 && <p className="py-6 text-sm text-slate-500">No tickets found.</p>}

        <div className="space-y-4">
          {tickets.filter((t) => filter === 'all' || t.status === filter).map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{ticket.subject}</p>
                  <p className="mt-1 text-xs text-slate-400">{ticket.description}</p>
                  <p className="mt-1 text-xs text-slate-500">{ticket.sid || ticket.id} · {titleizeAdmin(ticket.priority)} priority · {formatAdminDate(ticket.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{titleizeAdmin(ticket.status)}</span>
                </div>
              </div>

              {ticket.comments_unavailable && (
                <p className="mt-3 text-xs text-amber-300">Comments table not available. Run latest schema migration for support comments.</p>
              )}

              <div className="mt-3 space-y-2">
                {(ticket.comments || []).slice(0, 5).map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">
                    <span className="font-semibold text-white">{comment.author_type === 'platform' ? 'Platform' : 'You'}:</span> {comment.comment}
                    <span className="ml-2 text-slate-500">{formatAdminDate(comment.created_at)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <Inp placeholder="Add follow-up comment" value={commentDrafts[ticket.id] || ''} onChange={(e) => setCommentDrafts((state) => ({ ...state, [ticket.id]: e.target.value }))} />
                <Btn size="sm" onClick={() => addComment(ticket.id)}>Send</Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function MyPlanSection({ token }: { token: string }) {
  const af = useAdminFetch(token)
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null)
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')

    af('/api/admin/plan')
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!mounted) return
        if (!ok) throw new Error(data?.error || 'Failed to load plan details')
        setSubscription(data.subscription || null)
        setPlans(data.plans || [])
      })
      .catch((err: any) => {
        if (mounted) setError(err.message || 'Failed to load plan details')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [af])

  const currentPlan = subscription?.plan || null
  const upgradeOptions = plans.filter((plan) => plan.id !== currentPlan?.id)

  return (
    <div>
      <SectionHeader title="My Plan" subtitle="Current subscription details and upgrade-ready plan catalog." />

      {loading && <Card className="p-6 text-sm text-slate-400">Loading plan details…</Card>}
      {!loading && error && <Card className="p-6 text-sm text-red-400">{error}</Card>}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard label="Current Plan" value={currentPlan?.name || 'No active plan'} sub={currentPlan ? `${currentPlan.plan_code} · ${titleizeAdmin(currentPlan.billing_cycle)}` : 'Contact platform admin to assign one'} />
            <StatCard label="Plan Status" value={subscription ? titleizeAdmin(subscription.status) : 'Unassigned'} sub={subscription?.trial_ends_at ? `Trial ends ${formatAdminDate(subscription.trial_ends_at)}` : 'Subscription status from billing records'} />
            <StatCard label="Renewal / Expiry" value={subscription?.current_period_end ? formatAdminDate(subscription.current_period_end) : 'Not set'} sub="Based on current subscription end date" />
            <StatCard label="Current Price" value={currentPlan ? formatAdminMoney(Number(currentPlan.price || 0), currentPlan.currency || 'INR') : 'N/A'} sub={currentPlan ? currentPlan.currency : 'No billing profile'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="p-5">
              <SectionHeader title="Subscription Snapshot" subtitle="Live values from the subscription tables." />
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <span className="text-slate-400">Current plan</span>
                  <span className="font-semibold text-white">{currentPlan?.name || 'No active plan'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <span className="text-slate-400">Billing cycle</span>
                  <span className="font-semibold text-white">{currentPlan ? titleizeAdmin(currentPlan.billing_cycle) : 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <span className="text-slate-400">Plan status</span>
                  <span className="font-semibold text-white">{subscription ? titleizeAdmin(subscription.status) : 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <span className="text-slate-400">Current period start</span>
                  <span className="font-semibold text-white">{formatAdminDate(subscription?.current_period_start)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <span className="text-slate-400">Expiry date</span>
                  <span className="font-semibold text-white">{formatAdminDate(subscription?.current_period_end)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="Upgrade Plans" subtitle="Available active plans from subscription_plans." />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {upgradeOptions.map((plan) => {
                  const featureEntries = Object.entries(plan.features || {}).slice(0, 4)
                  const limitEntries = Object.entries(plan.limits || {}).slice(0, 3)
                  return (
                    <div key={plan.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-white">{plan.name}</p>
                          <p className="text-xs text-slate-500">{plan.plan_code} · {titleizeAdmin(plan.billing_cycle)}</p>
                        </div>
                        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">{formatAdminMoney(Number(plan.price || 0), plan.currency || 'INR')}</span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {featureEntries.map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">{titleizeAdmin(key)}</span>
                            <span className="text-slate-200">{String(value)}</span>
                          </div>
                        ))}
                        {featureEntries.length === 0 && <p className="text-xs text-slate-500">No feature summary configured.</p>}
                      </div>

                      <div className="mt-4 border-t border-white/10 pt-3 space-y-1.5 text-xs text-slate-400">
                        {limitEntries.map(([key, value]) => (
                          <p key={key}>{titleizeAdmin(key)}: <span className="text-slate-200">{String(value)}</span></p>
                        ))}
                        {limitEntries.length === 0 && <p>No plan limits configured.</p>}
                      </div>
                    </div>
                  )
                })}
                {upgradeOptions.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                    No additional active upgrade plans are currently configured.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
type Section = 'dashboard' | 'orders' | 'products' | 'webconfig' | 'leads' | 'myplan' | 'settings' | 'support'

const NAV: { id: Section; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard',     icon: <LayoutDashboard size={16} />, desc: 'Metrics & overview' },
  { id: 'orders',    label: 'Orders',         icon: <Package size={16} />, desc: 'Manage all orders' },
  { id: 'products',  label: 'Products',       icon: <Tags size={16} />, desc: 'Catalog management' },
  { id: 'webconfig', label: 'Website Config', icon: <Palette size={16} />, desc: 'Banners & coupons' },
  { id: 'leads',     label: 'Leads',          icon: <Users size={16} />, desc: 'Captured contacts' },
  { id: 'myplan',    label: 'My Plan',        icon: <CreditCard size={16} />, desc: 'Subscription & expiry' },
  { id: 'settings',  label: 'Settings',       icon: <SettingsIcon size={16} />, desc: 'Store preferences' },
  { id: 'support',   label: 'Support',        icon: <LifeBuoy size={16} />, desc: 'Help & tickets' },
]

const SECTION_FEATURE_RULES: Partial<Record<Section, SubscriptionFeatureKey[]>> = {
  dashboard: ['analytics_dashboard'],
  orders: ['sales_reports'],
  products: ['inventory_management'],
  webconfig: ['banners', 'coupons', 'custom_domain'],
  support: ['priority_support'],
}

export default function AdminPage() {
  const [token, setToken]         = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [section, setSection]     = useState<Section>('dashboard')
  const [sideOpen, setSideOpen]   = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [featureMap, setFeatureMap] = useState<SubscriptionFeatureMap>({ ...DEFAULT_FEATURES })
  const [lockedSectionNotice, setLockedSectionNotice] = useState<Section | null>(null)
  const shownCommsRef = useRef<Set<string>>(new Set())
  const tenantPrefix = getTenantPrefix()

  const isSectionLocked = useCallback((target: Section) => {
    const needed = SECTION_FEATURE_RULES[target]
    if (!needed || !needed.length) return false
    return needed.every((key) => !featureMap[key])
  }, [featureMap])

  useEffect(() => {
    let cancelled = false
    // Always require fresh login on each page load/refresh.
    sessionStorage.removeItem(getAdminSessionKey())
    sessionStorage.removeItem('admin_token')
    if (!cancelled) {
      setToken(null)
      setAuthReady(true)
    }

    fetch(withTenantPrefix('/api/settings')).then(r => r.json()).then(d => {
      setBusinessName(d.businessName || (d.tenantId ? d.tenantId.replace(/[-_]/g,' ').replace(/\b\w/g,(c:string) => c.toUpperCase()) : ''))
      const features = d?.subscription?.features
      if (features && typeof features === 'object') {
        setFeatureMap((prev) => ({ ...prev, ...(features as Partial<SubscriptionFeatureMap>) }))
      } else {
        setFeatureMap({ ...DEFAULT_FEATURES })
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [tenantPrefix])

  const handleAuth = (t: string) => {
    sessionStorage.removeItem(getAdminSessionKey())
    sessionStorage.removeItem('admin_token')
    setToken(t)
    setAuthReady(true)
  }
  const logout = async () => {
    if (!await confirmAction('Are you sure you want to logout?')) return
    sessionStorage.removeItem(getAdminSessionKey())
    sessionStorage.removeItem('admin_token')
    shownCommsRef.current.clear()
    setToken(null)
    setAuthReady(true)
  }

  useEffect(() => {
    if (!token) return
    const sessionKey = `${getAdminSessionKey()}:comms`
    const seen = new Set<string>(JSON.parse(window.sessionStorage.getItem(sessionKey) || '[]'))

    fetch(withTenantPrefix('/api/platform/comms'), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        const comms = Array.isArray(data.comms) ? data.comms : []
        for (const comm of comms as PlatformComm[]) {
          if (!comm?.id || seen.has(comm.id) || shownCommsRef.current.has(comm.id)) continue
          shownCommsRef.current.add(comm.id)
          seen.add(comm.id)
          showPlatformComm(comm)
        }
        window.sessionStorage.setItem(sessionKey, JSON.stringify(Array.from(seen)))
      })
      .catch(() => {})
  }, [token])

  if (!authReady) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 text-sm text-slate-400">
        Verifying secure session...
      </div>
    )
  }

  if (!token) return <LoginScreen onAuth={handleAuth} />

  const initials = businessName ? businessName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : 'IX'
  const sectionLocked = isSectionLocked(section)

  return (
    <div className="admin-light fixed inset-0 z-[9999] overflow-hidden bg-[radial-gradient(circle_at_12%_14%,rgba(6,182,212,0.10),transparent_42%),radial-gradient(circle_at_88%_20%,rgba(14,116,255,0.09),transparent_40%),linear-gradient(145deg,#f8fbff,#eef5ff_50%,#f8fafc)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-6 h-[26rem] w-[26rem] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[24rem] w-[24rem] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] rounded-full bg-teal-400/10 blur-[120px]" />
      </div>

      <div className="relative flex h-full">

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand */}
        <div className="m-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-blue-600 text-sm font-extrabold text-white shadow-md shadow-accent/30">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{businessName || 'Admin Panel'}</p>
            <p className="text-[10px] text-slate-500">Store Dashboard</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => {
              if (isSectionLocked(n.id)) {
                setLockedSectionNotice(n.id)
                return
              }
              setSection(n.id)
              setSideOpen(false)
            }}
              className={`card-3d w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${section === n.id ? 'border border-cyan-300/45 bg-gradient-to-r from-cyan-50 to-sky-50 text-slate-900 shadow-sm' : isSectionLocked(n.id) ? 'border border-amber-300/45 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}>
              <span className="text-lg w-6 text-center shrink-0">{n.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">{n.label}</p>
                <p className={`mt-0.5 text-[10px] ${section === n.id ? 'text-cyan-700/90' : isSectionLocked(n.id) ? 'text-amber-700' : 'text-slate-500'}`}>{isSectionLocked(n.id) ? 'Upgrade required' : n.desc}</p>
              </div>
              {section === n.id && <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />}
              {isSectionLocked(n.id) && <span className="ml-auto text-xs font-bold text-amber-700">LOCK</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="space-y-2 border-t border-slate-200 px-4 py-4">
          <a href={`${tenantPrefix}/`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900">
            <ExternalLink size={15} /> View Store
          </a>
          <button onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl border border-red-700 bg-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(220,38,38,0.28)] transition hover:bg-red-700">
            <LogOut size={15} /> Logout
          </button>
          <p className="pt-1 text-center text-[10px] text-slate-500">Powered by ImiqX</p>
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sideOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSideOpen(false)} />}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="mx-3 mt-3 flex h-14 shrink-0 items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-4 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <button className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:text-slate-900" onClick={() => setSideOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div>
              <p className="text-sm font-bold text-slate-900">{NAV.find(n => n.id === section)?.label}</p>
              <p className="text-[10px] text-slate-500 hidden sm:block">{NAV.find(n => n.id === section)?.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`${tenantPrefix}/`} target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition">
              View Store ↗
            </a>
            <button onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-red-700 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_14px_rgba(220,38,38,0.25)] transition hover:bg-red-700">
              Logout
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
            {sectionLocked ? (
              <Card className="p-8 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Feature locked</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Upgrade required to unlock this section</h3>
                <p className="mt-2 text-sm text-slate-600">This section is disabled in your current subscription plan.</p>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <Btn onClick={() => setSection('myplan')}>View My Plan</Btn>
                  <Btn variant="ghost" onClick={() => setSection('dashboard')}>Back to Dashboard</Btn>
                </div>
              </Card>
            ) : (
              <>
                {section === 'dashboard' && <DashboardSection token={token} />}
                {section === 'orders'    && <OrdersSection    token={token} />}
                {section === 'products'  && <ProductsSection  token={token} />}
                {section === 'webconfig' && <WebConfigSection token={token} onBusinessNameChange={setBusinessName} features={featureMap} />}
                {section === 'leads'     && <LeadsSection     token={token} />}
                {section === 'myplan'    && <MyPlanSection    token={token} />}
                {section === 'settings'  && <SettingsSection  token={token} />}
                {section === 'support'   && <SupportSection token={token} />}
              </>
            )}
          </div>
        </main>

        <footer className="mx-3 mb-3 flex shrink-0 flex-col items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-[11px] text-slate-600 backdrop-blur-2xl sm:flex-row">
          <p>
            {businessName || 'Store'} Admin Dashboard · Powered by <span className="font-semibold text-accent">ImiqX</span>
          </p>
          <div className="flex items-center gap-3">
            <a href={`${tenantPrefix}/`} target="_blank" rel="noopener noreferrer" className="text-slate-700 transition hover:text-slate-900">
              Open Storefront
            </a>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">Secure admin session</span>
          </div>
        </footer>
      </div>
      </div>

      {lockedSectionNotice && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Upgrade needed</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">{NAV.find((item) => item.id === lockedSectionNotice)?.label} is locked for this plan</h3>
            <p className="mt-2 text-sm text-slate-600">Upgrade your subscription to enable this feature set for your store.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Btn variant="ghost" onClick={() => setLockedSectionNotice(null)}>Close</Btn>
              <Btn onClick={() => { setLockedSectionNotice(null); setSection('myplan') }}>Upgrade</Btn>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
