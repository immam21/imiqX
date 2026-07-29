'use client'

import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { FEATURE_DEFINITIONS, normalizeStrictOverrideMap, parseJsonObject } from '../../lib/subscriptionFeatures'

type BillingCycle = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly'
type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
type PlatformSection = 'dashboard' | 'clients' | 'clientSettings' | 'plans' | 'subscriptions' | 'paymentHistory' | 'support' | 'comms'

type TenantRow = {
  id: string
  sid?: string
  tenant_code?: string
  business_name?: string
  email?: string
  whatsapp_number?: string
  currency?: string
  logo_url?: string
  default_delivery_charge?: number
  is_active?: boolean
  created_at?: string
  admin_login_id?: string
  client_status?: 'active' | 'inactive' | 'expired' | 'deleted'
  custom_domain?: string
  custom_domain_type?: 'custom' | 'subdomain'
  custom_domain_is_primary?: boolean
  custom_domain_is_verified?: boolean
  custom_domain_ssl_status?: string
  payment_gateway?: string
  payment_modes?: string[]
  razorpay_key_id?: string
  razorpay_enabled?: boolean
  business_type?: 'ecommerce_product' | 'ecommerce_services'
}

type PlanRow = {
  id: string
  sid?: string
  plan_code: string
  name: string
  billing_cycle: BillingCycle
  price: number
  currency: string
  features?: Record<string, unknown>
  limits?: Record<string, unknown>
  is_active: boolean
  created_at?: string
}

type SubscriptionRow = {
  id: string
  tenant_id: string
  plan_id: string
  status: SubscriptionStatus | 'hold' | 'deactivate'
  provider?: string | null
  provider_customer_id?: string | null
  provider_subscription_id?: string | null
  canceled_at?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  trial_ends_at?: string | null
  created_at?: string
  updated_at?: string | null
  tenant?: {
    id: string
    tenant_code?: string
    business_name?: string
    whatsapp_number?: string
    currency?: string
    is_active?: boolean
  } | null
  store_access_mode?: string
  dashboard_access?: string
  feature_overrides?: Record<string, unknown>
  limit_overrides?: Record<string, unknown>
  plan?: {
    id: string
    name: string
    plan_code: string
    billing_cycle?: string | null
  } | null
}

type SubscriptionDraft = {
  tenantId: string
  planId: string
  status: SubscriptionStatus | 'hold' | 'deactivate'
  provider: string
  providerCustomerId: string
  providerSubscriptionId: string
  canceledAt: string
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEndsAt: string
  dashboardLock: boolean
  featureOverridesText: string
  limitOverridesText: string
}

type StaffRow = {
  id: string
  tenant_id?: string | null
  user_type: 'platform' | 'tenant'
  username: string
  email?: string | null
  display_name?: string | null
  phone?: string | null
  is_active: boolean
  last_login_at?: string | null
  created_at?: string
}

type RevenueTenantRow = {
  tenantId: string
  tenantCode: string
  businessName: string
  isActive: boolean
  totalOrders: number
  totalRevenue: number
  paidRevenue?: number
  paidCount?: number
  pendingAmount?: number
  lastPaidAt?: string | null
  lastOrderAt: string | null
  planName: string | null
  planCode: string | null
  planStatus: string | null
  currentPeriodEnd: string | null
}

type PlatformPaymentRow = {
  id: string
  tenant_id: string
  subscription_id?: string | null
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'overdue'
  method?: string | null
  reference?: string | null
  payment_date?: string | null
  due_date?: string | null
  notes?: string | null
  receipt_number?: string | null
  created_at?: string | null
  updated_at?: string | null
  tenant?: {
    id: string
    tenant_code?: string
    business_name?: string
  } | null
  subscription?: {
    id: string
    plan_id?: string
    status?: string
  } | null
}

type PlatformStats = {
  totalRevenue: number
  totalOrders: number
  totalPaidRevenue?: number
  totalPaymentRecords?: number
  totalPaidRecords?: number
  totalPendingAmount?: number
  clientsWithPaidRevenue?: number
  paymentTableMissing?: boolean
  activeSubscriptions: number
  monthlyRecurringRevenue: number
  totalClients: number
  todayClients: number
  activeClients: number
  clientMetrics?: {
    clientsWithOrders: number
    averageRevenuePerClient: number
    averageRevenuePerActiveClient: number
    averageOrdersPerClient: number
    averageOrderValue: number
    activeClientRevenue: number
    activeClientOrders: number
    topClientRevenue: number
  }
  statusCounts: {
    pending: number
    processing: number
    shipped: number
    delivered: number
    cancelled: number
  }
  revenueByTenant: RevenueTenantRow[]
}

type PlatformSupportTicket = {
  id: string
  sid?: string
  tenant_id: string
  created_by_user_id?: string | null
  subject: string
  description: string
  status: string
  priority: string
  assigned_to_user_id?: string | null
  created_at?: string
  updated_at?: string
  tenant?: { id: string; tenant_code?: string; business_name?: string } | null
  comments?: Array<{ id: string; author_type: 'tenant' | 'platform'; comment: string; created_at?: string }>
  comments_unavailable?: boolean
}

type PlatformCommRow = {
  id: string
  title: string
  body: string
  image_url?: string | null
  target_tenant_id?: string | null
  status: 'draft' | 'active' | 'scheduled' | 'expired' | 'deleted'
  start_at?: string | null
  end_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const NAV: { id: PlatformSection; label: string; icon: string; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⚡', desc: 'Admin and client metrics' },
  { id: 'clients', label: 'Clients', icon: '🏬', desc: 'Create, edit and manage stores' },
  { id: 'clientSettings', label: 'Client Settings', icon: '⚙️', desc: 'Payment options and Razorpay keys' },
  { id: 'plans', label: 'Plans', icon: '📋', desc: 'Pricing, features and limits' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '💳', desc: 'Renewals, upgrades and expiry' },
  { id: 'paymentHistory', label: 'Payment History', icon: '🧾', desc: 'Client payments and receipts' },
  { id: 'support', label: 'Support Tickets', icon: '🎫', desc: 'Tickets, status flow and comments' },
  { id: 'comms', label: 'Send Comms', icon: '📣', desc: 'Broadcast login popups to clients' },
]

const PREFERRED_PLAN_CODES = ['trial_plan_7days', 'growth_plan_399_monthly', 'starter_plan_999_quarterly', 'advanced_plan_1499_quarterly', 'free_7day_trial', 'basic_monthly_399', 'basic_plus_pg_quarterly_999']

function formatMoney(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTimeInput(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function addDaysInput(startInput: string, days: number) {
  const base = startInput ? new Date(startInput) : new Date()
  const d = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
  return formatDateTimeInput(d.toISOString())
}

function showSavedPopup(message: string, title = 'Saved') {
  if (typeof window === 'undefined') return Promise.resolve()

  return new Promise<void>((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[10001] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm'

    const panel = document.createElement('div')
    panel.className = 'w-full max-w-md rounded-2xl border border-cyan-300/35 bg-slate-900/95 p-5 shadow-2xl shadow-black/50'

    const titleEl = document.createElement('h3')
    titleEl.className = 'text-base font-bold text-white'
    titleEl.textContent = title

    const msgEl = document.createElement('p')
    msgEl.className = 'mt-2 text-sm leading-6 text-slate-300'
    msgEl.textContent = message

    const actionWrap = document.createElement('div')
    actionWrap.className = 'mt-5 flex justify-end'

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

    actionWrap.appendChild(okBtn)
    panel.appendChild(titleEl)
    panel.appendChild(msgEl)
    panel.appendChild(actionWrap)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)
    window.addEventListener('keydown', onKeyDown)
    okBtn.focus()
  })
}

function inferPlanDays(plan?: PlanRow | null) {
  if (!plan) return 30
  const trialDays = Number((plan.features as any)?.trial_days || 0)
  if (trialDays > 0) return trialDays
  if (plan.billing_cycle === 'quarterly') return 90
  if (plan.billing_cycle === 'half_yearly') return 180
  if (plan.billing_cycle === 'yearly') return 365
  return 30
}

function inferBillingCycleDays(cycle?: string | null) {
  if (cycle === 'quarterly') return 90
  if (cycle === 'half_yearly') return 180
  if (cycle === 'yearly') return 365
  return 30
}

function resolveSubscriptionRenewalDate(subscription: SubscriptionRow, plan?: PlanRow | null) {
  if (subscription.current_period_end) return subscription.current_period_end
  if (subscription.trial_ends_at) return subscription.trial_ends_at
  const start = subscription.current_period_start || subscription.created_at
  if (!start) return null
  const base = new Date(start)
  if (Number.isNaN(base.getTime())) return null
  const days = plan ? inferPlanDays(plan) : inferBillingCycleDays(subscription.plan?.billing_cycle)
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

function buildSubscriptionDraft(subscription: SubscriptionRow): SubscriptionDraft {
  return {
    tenantId: subscription.tenant_id,
    planId: subscription.plan_id,
    status: subscription.status,
    provider: subscription.provider || '',
    providerCustomerId: subscription.provider_customer_id || '',
    providerSubscriptionId: subscription.provider_subscription_id || '',
    canceledAt: formatDateTimeInput(subscription.canceled_at),
    currentPeriodStart: formatDateTimeInput(subscription.current_period_start),
    currentPeriodEnd: formatDateTimeInput(subscription.current_period_end),
    trialEndsAt: formatDateTimeInput(subscription.trial_ends_at),
    dashboardLock: String(subscription.dashboard_access || '').toUpperCase() === 'LOCK_DASHBOARD',
    featureOverridesText: JSON.stringify(subscription.feature_overrides || {}, null, 2),
    limitOverridesText: JSON.stringify(subscription.limit_overrides || {}, null, 2),
  }
}

function titleize(value: string) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function friendlyFetchError(err: any, area: string) {
  const message = String(err?.message || '')
  if (/fetch failed|failed to fetch|networkerror/i.test(message)) {
    return `${area}: network request failed. Check server connectivity and try again.`
  }
  return `${area}: ${message || 'request failed'}`
}

function statusBadgeClass(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) return 'bg-slate-500/25 text-slate-100 ring-1 ring-slate-300/30'

  if (['active', 'resolved', 'delivered', 'enabled', 'verified', 'open'].includes(normalized)) {
    return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
  }

  if (['inactive', 'pending', 'processing', 'scheduled', 'trialing', 'draft'].includes(normalized)) {
    return 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
  }

  if (['past_due', 'hold', 'expired', 'need_more_info', 'review_with_user', 'shipped'].includes(normalized)) {
    return 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
  }

  if (['canceled', 'cancelled', 'deleted', 'deactivate', 'disabled', 'closed', 'urgent'].includes(normalized)) {
    return 'bg-rose-100 text-rose-800 ring-1 ring-rose-300'
  }

  if (['high'].includes(normalized)) {
    return 'bg-fuchsia-500/28 text-fuchsia-100 ring-1 ring-fuchsia-300/45'
  }

  if (['medium'].includes(normalized)) {
    return 'bg-cyan-500/28 text-cyan-100 ring-1 ring-cyan-300/45'
  }

  if (['low'].includes(normalized)) {
    return 'bg-sky-500/28 text-sky-100 ring-1 ring-sky-300/45'
  }

  return 'bg-slate-500/25 text-slate-100 ring-1 ring-slate-300/30'
}

function hoursBetween(from?: string, to?: string) {
  if (!from || !to) return null
  const a = new Date(from)
  const b = new Date(to)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60)))
}

function ticketSla(ticket: PlatformSupportTicket) {
  const nowIso = new Date().toISOString()
  const ageHrs = hoursBetween(ticket.created_at, nowIso)
  const latestCommentAt = (ticket.comments || [])[0]?.created_at || null
  const lastResponseHrs = hoursBetween(latestCommentAt || ticket.created_at, nowIso)
  const status = String(ticket.status || '').toLowerCase()
  const overdue = ['open', 'in_progress'].includes(status) && (ageHrs || 0) > 24
  return {
    ageHrs,
    lastResponseHrs,
    overdue,
  }
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[linear-gradient(120deg,#ffffff,#f8fbff)] px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.78)]" />
          <h2 className="display-heading text-[1.35rem] font-bold text-slate-900">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f8fbff)] shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur-md ${className}`}>{children}</div>
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(165deg,#ffffff,#f1f5f9)] p-5 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  )
}

function Inp({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/25 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    />
  )
}

function Sel({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/25 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    />
  )
}

function Txt({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/25 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    />
  )
}

function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'success'; size?: 'sm' | 'md' }) {
  const variants = {
    primary: 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white shadow-[0_12px_26px_rgba(14,165,233,0.34)] hover:-translate-y-0.5 hover:brightness-110',
    ghost: 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900',
    danger: 'border border-red-700 bg-red-600 text-white hover:bg-red-700 shadow-[0_10px_22px_rgba(220,38,38,0.35)]',
    success: 'border border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_10px_22px_rgba(5,150,105,0.35)]',
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' }
  return <button {...props} className={`flex items-center justify-center gap-1.5 rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-300/35 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}>{children}</button>
}

function LoginScreen({
  usernameOrEmail,
  password,
  error,
  loading,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  usernameOrEmail: string
  password: string
  error: string
  loading: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-stretch overflow-auto bg-[radial-gradient(circle_at_15%_18%,rgba(14,165,233,0.18),transparent_38%),radial-gradient(circle_at_88%_10%,rgba(37,99,235,0.17),transparent_34%),linear-gradient(145deg,#ecf6ff,#dfeeff_52%,#f2f8ff)]">
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between border-r border-white/10 bg-gradient-to-br from-cyan-600/28 via-blue-800/45 to-slate-950 p-12 text-white backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/20 text-lg font-extrabold backdrop-blur">PX</div>
            <span className="text-lg font-bold tracking-tight">ImiqX Platform</span>
          </div>
          <div className="mt-16">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-cyan-100/80">Global Control Center</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight">
              Control every<br />store, plan<br />and revenue flow.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cyan-50/92">
              Run the full SaaS estate from one console: store onboarding, subscription operations, staff management, and revenue visibility.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { icon: '🏬', label: 'Stores', desc: 'Create, edit, suspend or remove stores' },
            { icon: '💳', label: 'Plans', desc: 'Manage subscription catalog and renewals' },
            { icon: '📈', label: 'Revenue', desc: 'Track sales across all stores' },
            { icon: '👥', label: 'Staff', desc: 'Control platform and store access' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-cyan-100/25 bg-slate-900/58 px-4 py-3 backdrop-blur">
              <span className="text-2xl drop-shadow-[0_0_8px_rgba(103,232,249,0.35)]">{item.icon}</span>
              <div>
                <p className="text-sm font-bold text-white">{item.label}</p>
                <p className="text-xs text-slate-200/95">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-xl lg:max-w-md">
          <div className="mb-4 flex items-center justify-center lg:hidden">
            <span className="rounded-full border border-cyan-300/55 bg-white/75 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 shadow-sm backdrop-blur">
              ImiqX Control Center
            </span>
          </div>

          <div className="rounded-[2rem] border border-cyan-200/55 bg-gradient-to-br from-white/96 via-white/94 to-cyan-50/88 p-6 shadow-[0_30px_80px_rgba(30,64,175,0.20)] backdrop-blur-xl sm:p-8">
            <div className="mb-7">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600 ring-1 ring-cyan-300/40">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Platform Admin</h1>
              <p className="mt-1 text-base leading-7 text-slate-600">Sign in to manage stores, plans, subscriptions, and operations.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Username or Email</label>
                <input
                  value={usernameOrEmail}
                  onChange={(event) => onUsernameChange(event.target.value)}
                  required
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Password</label>
                <input
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  type="password"
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5">
                  <p className="text-xs font-semibold text-rose-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 text-lg font-bold text-white shadow-[0_14px_32px_rgba(14,116,255,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {loading ? 'Signing in...' : 'Sign in to Console'}
              </button>

              <p className="pt-1 text-center text-xs font-medium text-slate-500">Protected access for authorized platform users only</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlatformAdminPage() {
  const [section, setSection] = useState<PlatformSection>('dashboard')
  const [runtimeOrigin, setRuntimeOrigin] = useState('')
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [csrfToken, setCsrfToken] = useState('')
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [supportTickets, setSupportTickets] = useState<PlatformSupportTicket[]>([])
  const [supportCommentDrafts, setSupportCommentDrafts] = useState<Record<string, string>>({})
  const [supportFilterStatus, setSupportFilterStatus] = useState('all')
  const [supportFilterPriority, setSupportFilterPriority] = useState('all')
  const [supportFilterTenant, setSupportFilterTenant] = useState('all')
  const [supportSearch, setSupportSearch] = useState('')
  const [flash, setFlash] = useState('')
  const [comms, setComms] = useState<PlatformCommRow[]>([])
  const [payments, setPayments] = useState<PlatformPaymentRow[]>([])
  const [paymentTableMissing, setPaymentTableMissing] = useState(false)
  const [paymentModalId, setPaymentModalId] = useState<string | null>(null)
  const [paymentModalMode, setPaymentModalMode] = useState<'view' | 'edit'>('view')
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false)
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, {
    tenantId: string
    subscriptionId: string
    amount: number
    currency: string
    status: PlatformPaymentRow['status']
    method: string
    reference: string
    paidAt: string
    dueDate: string
    notes: string
    receiptNumber: string
  }>>({})
  const [newPayment, setNewPayment] = useState({
    tenantId: '',
    subscriptionId: '',
    amount: 0,
    currency: 'INR',
    status: 'pending' as PlatformPaymentRow['status'],
    method: '',
    reference: '',
    paidAt: '',
    dueDate: '',
    notes: '',
    receiptNumber: '',
  })
  const [newComm, setNewComm] = useState({
    title: '',
    body: '',
    imageUrl: '',
    targetTenantId: '',
    status: 'active' as PlatformCommRow['status'],
    startAt: '',
    endAt: '',
  })
  const [commModalMode, setCommModalMode] = useState<'view' | 'edit'>('view')
  const [commDrafts, setCommDrafts] = useState<Record<string, {
    title: string
    body: string
    imageUrl: string
    targetTenantId: string
    status: PlatformCommRow['status']
    startAt: string
    endAt: string
  }>>({})

  const [newTenant, setNewTenant] = useState({
    tenantCode: '',
    businessName: '',
    email: '',
    whatsappNumber: '',
    currency: 'INR',
    logoUrl: '',
    customDomain: '',
    customDomainType: 'custom' as 'custom' | 'subdomain',
    customDomainIsPrimary: true,
    customDomainIsVerified: true,
    customDomainSslStatus: '',
    useCustomDomain: false,
    planId: '',
    expiryDate: '',
    adminLoginId: '',
    adminPassword: '',
    paymentGateway: 'razorpay',
    paymentModes: 'UPI,Card,NetBanking,Wallet',
    razorpayKeyId: '',
    razorpayEnabled: true,
    businessType: 'ecommerce_product' as 'ecommerce_product' | 'ecommerce_services',
    clientStatus: 'active' as 'active' | 'inactive' | 'expired' | 'deleted',
    isActive: true,
  })
  const [showNewTenantPassword, setShowNewTenantPassword] = useState(false)
  const [tenantDrafts, setTenantDrafts] = useState<Record<string, typeof newTenant>>({})
  const [tenantModalId, setTenantModalId] = useState<string | null>(null)
  const [tenantModalMode, setTenantModalMode] = useState<'view' | 'edit'>('view')
  const [createTenantOpen, setCreateTenantOpen] = useState(false)
  const [planModalId, setPlanModalId] = useState<string | null>(null)
  const [planModalMode, setPlanModalMode] = useState<'view' | 'edit'>('view')
  const [createPlanOpen, setCreatePlanOpen] = useState(false)
  const [subscriptionModalId, setSubscriptionModalId] = useState<string | null>(null)
  const [subscriptionModalMode, setSubscriptionModalMode] = useState<'view' | 'edit'>('view')
  const [createSubscriptionOpen, setCreateSubscriptionOpen] = useState(false)
  const [commModalId, setCommModalId] = useState<string | null>(null)
  const [createCommOpen, setCreateCommOpen] = useState(false)
  const [supportModalId, setSupportModalId] = useState<string | null>(null)
  const [paymentSettingsModalId, setPaymentSettingsModalId] = useState<string | null>(null)
  const [paymentSettingsModalMode, setPaymentSettingsModalMode] = useState<'view' | 'edit'>('view')
  const [deleteConfirm, setDeleteConfirm] = useState<null | {
    entityLabel: string
    successMessage: string
    action: () => Promise<void>
  }>(null)
  const [createdTenantSummary, setCreatedTenantSummary] = useState<null | {
    tenantCode: string
    businessName: string
    loginId: string
    password: string
    storefrontUrl: string
  }>(null)

  const [newPlan, setNewPlan] = useState({
    sid: '',
    planCode: '',
    name: '',
    billingCycle: 'monthly' as BillingCycle,
    price: 0,
    currency: 'INR',
    featuresText: '{\n  "support": "standard"\n}',
    limitsText: '{\n  "products": 500\n}',
    isActive: true,
  })
  const [planDrafts, setPlanDrafts] = useState<Record<string, typeof newPlan>>({})

  const [newAssignment, setNewAssignment] = useState({
    tenantId: '',
    planId: '',
    status: 'active' as SubscriptionStatus,
    provider: '',
    providerCustomerId: '',
    providerSubscriptionId: '',
    canceledAt: '',
    currentPeriodStart: '',
    currentPeriodEnd: '',
    trialEndsAt: '',
    dashboardLock: false,
    featureOverridesText: '{}',
    limitOverridesText: '{}',
  })
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<string, SubscriptionDraft>>({})
  const [newStaff, setNewStaff] = useState({
    scope: 'platform' as 'platform' | 'tenant',
    tenantId: '',
    username: '',
    email: '',
    password: '',
    displayName: '',
    roleKeys: 'admin',
  })
  const [staffDrafts, setStaffDrafts] = useState<Record<string, { displayName: string; phone: string; isActive: boolean }>>({})

  async function ensureCsrfToken() {
    return csrfToken || (await bootstrapCsrf())
  }

  async function secureFetch(input: string, init?: RequestInit) {
    const execute = async (token: string) => {
      const headers = new Headers(init?.headers || {})
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
      headers.set('x-csrf-token', token)
      return fetch(input, {
        ...init,
          credentials: 'same-origin',
        headers,
      })
    }

    let token = await ensureCsrfToken()
    let response = await execute(token)
    if (response.status !== 403 && response.status !== 401) return response

    const body = await response.clone().json().catch(() => null)
    const message = String(body?.error || '')
    if (!/csrf/i.test(message)) {
      // 401 = session expired — try to refresh the token and retry once
      if (response.status === 401) {
        const refresh = await fetch('/api/platform/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          body: JSON.stringify({}),
        })
        if (refresh.ok) {
          token = await ensureCsrfToken()
          response = await execute(token)
        }
      }
      return response
    }

    token = await bootstrapCsrf()
    response = await execute(token)
    return response
  }

  async function platformFetch(input: string, init?: RequestInit) {
    const execute = async () => {
      return fetch(input, {
        ...init,
        credentials: 'same-origin',
      })
    }

    let response = await execute()
    if (response.status !== 401) return response

    const refresh = await secureFetch('/api/platform/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    if (!refresh.ok) return response

    response = await execute()
    return response
  }

  async function bootstrapCsrf() {
    const res = await fetch('/api/platform/security/csrf', { credentials: 'same-origin' })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to initialize security token')
    setCsrfToken(data.csrfToken)
    return data.csrfToken as string
  }

  async function loadTenants() {
    try {
      const res = await platformFetch('/api/platform/tenants', { method: 'GET' })
      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        throw new Error(raw?.trim() ? 'Failed to parse clients response' : 'Empty response from clients API')
      }
      if (!res.ok) throw new Error(data?.error || 'Failed to load clients')
      const rows = data.tenants || []
      setTenants(rows)
      setTenantDrafts(Object.fromEntries(rows.map((tenant: TenantRow) => [tenant.id, {
        tenantCode: tenant.tenant_code || '',
        businessName: tenant.business_name || '',
        email: tenant.email || '',
        whatsappNumber: tenant.whatsapp_number || '',
        currency: tenant.currency || 'INR',
        logoUrl: tenant.logo_url || '',
        customDomain: tenant.custom_domain || '',
        customDomainType: tenant.custom_domain_type || 'custom',
        customDomainIsPrimary: tenant.custom_domain_is_primary !== false,
        customDomainIsVerified: tenant.custom_domain_is_verified !== false,
        customDomainSslStatus: tenant.custom_domain_ssl_status || '',
        useCustomDomain: Boolean(String(tenant.custom_domain || '').trim()),
        planId: '',
        expiryDate: '',
        adminLoginId: tenant.admin_login_id || '',
        adminPassword: '',
        paymentGateway: tenant.payment_gateway || 'razorpay',
        paymentModes: Array.isArray(tenant.payment_modes) ? tenant.payment_modes.join(',') : 'UPI,Card,NetBanking,Wallet',
        razorpayKeyId: tenant.razorpay_key_id || '',
        razorpayEnabled: Boolean(tenant.razorpay_enabled),
        businessType: (String((tenant as any).business_type || '').trim().toLowerCase() === 'ecommerce_services' ? 'ecommerce_services' : 'ecommerce_product') as 'ecommerce_product' | 'ecommerce_services',
        clientStatus: tenant.client_status || (tenant.is_active ? 'active' : 'inactive'),
        isActive: Boolean(tenant.is_active),
      }])))
    } catch (err: any) {
      throw new Error(friendlyFetchError(err, 'clients'))
    }
  }

  async function loadSubscriptions() {
    try {
      const res = await platformFetch('/api/platform/subscriptions', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load subscriptions')
      const planRows = data.plans || []
      const subscriptionRows = data.subscriptions || []
      setPlans(planRows)
      setSubscriptions(subscriptionRows)
      setPlanDrafts(Object.fromEntries(planRows.map((plan: PlanRow) => [plan.id, {
        sid: plan.sid || '',
        planCode: plan.plan_code || '',
        name: plan.name || '',
        billingCycle: plan.billing_cycle,
        price: Number(plan.price || 0),
        currency: plan.currency || 'INR',
        featuresText: JSON.stringify(plan.features || {}, null, 2),
        limitsText: JSON.stringify(plan.limits || {}, null, 2),
        isActive: Boolean(plan.is_active),
      }])))
      setSubscriptionDrafts(Object.fromEntries(subscriptionRows.map((subscription: SubscriptionRow) => [subscription.id, buildSubscriptionDraft(subscription)])))
    } catch (err: any) {
      throw new Error(friendlyFetchError(err, 'subscriptions'))
    }
  }

  async function loadStaff() {
    try {
      const res = await platformFetch('/api/platform/staff', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load staff')
      const rows = data.users || []
      setStaff(rows)
      setStaffDrafts(Object.fromEntries(rows.map((user: StaffRow) => [user.id, {
        displayName: user.display_name || '',
        phone: user.phone || '',
        isActive: Boolean(user.is_active),
      }])))
    } catch (err: any) {
      throw new Error(friendlyFetchError(err, 'staff'))
    }
  }

  async function loadStats() {
    try {
      const res = await platformFetch('/api/platform/stats', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load platform stats')
      setPlatformStats(data)
    } catch (err: any) {
      throw new Error(friendlyFetchError(err, 'stats'))
    }
  }

  async function loadSupport() {
    try {
      const res = await platformFetch('/api/platform/support', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load support tickets')
      setSupportTickets(data.tickets || [])
    } catch (err: any) {
      throw new Error(friendlyFetchError(err, 'support'))
    }
  }

  async function loadComms() {
    try {
      const res = await platformFetch('/api/platform/comms', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load communications')
      const rows = data.comms || []
      setComms(rows)
      setCommDrafts(Object.fromEntries(rows.map((comm: PlatformCommRow) => [comm.id, {
        title: comm.title || '',
        body: comm.body || '',
        imageUrl: comm.image_url || '',
        targetTenantId: comm.target_tenant_id || '',
        status: comm.status || 'active',
        startAt: comm.start_at ? String(comm.start_at).slice(0, 16) : '',
        endAt: comm.end_at ? String(comm.end_at).slice(0, 16) : '',
      }])))
    } catch (err: any) {
      throw new Error(friendlyFetchError(err, 'communications'))
    }
  }

  async function loadPayments() {
    try {
      const res = await platformFetch('/api/platform/payments', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load payment history')
      const rows = data.payments || []
      setPayments(rows)
      setPaymentTableMissing(Boolean(data.paymentTableMissing))
      setPaymentDrafts(Object.fromEntries(rows.map((payment: PlatformPaymentRow) => [payment.id, {
        tenantId: payment.tenant_id,
        subscriptionId: payment.subscription_id || '',
        amount: Number(payment.amount || 0),
        currency: payment.currency || 'INR',
        status: payment.status || 'pending',
        method: payment.method || '',
        reference: payment.reference || '',
        paidAt: payment.payment_date ? String(payment.payment_date).slice(0, 16) : '',
        dueDate: payment.due_date ? String(payment.due_date).slice(0, 16) : '',
        notes: payment.notes || '',
        receiptNumber: payment.receipt_number || '',
      }])))
    } catch (err: any) {
      throw new Error(friendlyFetchError(err, 'payments'))
    }
  }

  function normalizeHostInput(value: string) {
    const raw = String(value || '').trim()
    if (!raw) return ''
    const withoutProtocol = raw.replace(/^https?:\/\//i, '')
    const host = withoutProtocol.split('/')[0] || ''
    return host.replace(/:\d+$/, '').trim().toLowerCase()
  }

  function buildStorefrontUrl(tenantCode?: string, customDomain?: string) {
    const domainHost = normalizeHostInput(String(customDomain || ''))
    if (domainHost) {
      const httpLocal = domainHost.includes('localhost') || domainHost.endsWith('.local')
      return `${httpLocal ? 'http' : 'https'}://${domainHost}`
    }

    const code = String(tenantCode || '').trim()
    if (!runtimeOrigin || !code) return ''
    return `${runtimeOrigin.replace(/\/$/, '')}/${encodeURIComponent(code)}`
  }

  async function copyToClipboard(value: string, label = 'Value') {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setFlash(`${label} copied to clipboard.`)
      setError('')
    } catch {
      setError(`Failed to copy ${label.toLowerCase()}.`)
    }
  }

  async function refreshAll() {
    const jobs: Array<[string, () => Promise<void>]> = [
      ['tenants', loadTenants],
      ['subscriptions', loadSubscriptions],
      ['staff', loadStaff],
      ['stats', loadStats],
      ['support', loadSupport],
      ['communications', loadComms],
      ['payments', loadPayments],
    ]

    const results = await Promise.allSettled(
      jobs.map(async ([label, task]) => {
        try {
          await task()
        } catch (err: any) {
          const message = String(err?.message || 'Request failed')
          throw new Error(`${label}: ${message}`)
        }
      })
    )

    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => String(result.reason?.message || 'unknown error'))

    if (failures.length) {
      throw new Error(`Refresh partially failed: ${failures.join(' | ')}`)
    }
  }

  async function validatePlatformSession() {
    const res = await platformFetch('/api/platform/stats', { method: 'GET' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error || 'Platform session not active')
    }
  }

  const derivedStats = useMemo(() => {
    const total = tenants.length
    const active = tenants.filter((tenant) => tenant.is_active).length
    const suspended = Math.max(0, total - active)
    return { total, active, suspended }
  }, [tenants])

  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans])
  const tenantById = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant])), [tenants])

  useEffect(() => {
    if (!plans.length) return
    setNewTenant((state) => {
      if (state.planId) return state
      const preferred = plans.find((p) => PREFERRED_PLAN_CODES.includes(p.plan_code)) || plans[0]
      if (!preferred) return state
      const start = formatDateTimeInput(new Date().toISOString())
      return {
        ...state,
        planId: preferred.id,
        expiryDate: addDaysInput(start, inferPlanDays(preferred)),
      }
    })
  }, [plans])

  useEffect(() => {
    if (!loggedIn) return
    refreshAll().catch((err) => setError(err.message || 'Failed to load platform data'))
  }, [loggedIn])

  useEffect(() => {
    // If a valid access-token cookie already exists, skip manual login screen.
    validatePlatformSession()
      .then(() => setLoggedIn(true))
      .catch(() => {
        // Keep login screen for explicit sign-in.
      })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setRuntimeOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (csrfToken) return
    bootstrapCsrf().catch(() => {
      // Login flow will surface precise error when submit is attempted.
    })
  }, [csrfToken])

  async function runAction(action: () => Promise<void>, successMessage: string) {
    if (saving) return
    setSaving(true)
    setError('')
    setFlash('')
    try {
      await action()
      setFlash(successMessage)
      await refreshAll()
      await showSavedPopup(successMessage)
    } catch (err: any) {
      setError(err.message || 'Request failed')
    } finally {
      setSaving(false)
    }
  }

  function runDeleteAction(action: () => Promise<void>, successMessage: string, entityLabel: string) {
    setDeleteConfirm({
      action,
      successMessage,
      entityLabel,
    })
  }

  async function confirmDeleteAction() {
    if (!deleteConfirm) return
    const pending = deleteConfirm
    setDeleteConfirm(null)
    await runAction(pending.action, pending.successMessage)
  }

  async function onLogin(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await secureFetch('/api/platform/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usernameOrEmail, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      try {
        await validatePlatformSession()
        setLoggedIn(true)
        setFlash('Platform session ready.')
      } catch (sessionError: any) {
        setLoggedIn(false)
        setError(sessionError?.message || 'Login succeeded but session verification failed')
      }
    } catch {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function onLogout() {
    if (csrfToken) {
      await fetch('/api/platform/auth/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      })
    }

    setLoggedIn(false)
    setTenants([])
    setPlans([])
    setSubscriptions([])
    setStaff([])
    setPlatformStats(null)
    setUsernameOrEmail('')
    setPassword('')
    setFlash('')
    setError('')
  }

  function parseJsonField(value: string, fieldName: string) {
    try {
      return JSON.parse(value || '{}')
    } catch {
      throw new Error(`${fieldName} must be valid JSON`)
    }
  }

  function isFeatureEnabled(jsonText: string, key: string) {
    const map = parseJsonObject(jsonText)
    return Boolean(map[key])
  }

  function setFeatureEnabled(jsonText: string, key: string, enabled: boolean) {
    const map = parseJsonObject(jsonText)
    map[key] = enabled
    return JSON.stringify(map, null, 2)
  }

  async function createTenant() {
    if (!newTenant.tenantCode.trim()) throw new Error('Store code is required')
    if (!newTenant.businessName.trim()) throw new Error('Business name is required')

    const confirmMessage = [
      `Create client ${newTenant.businessName} (${newTenant.tenantCode})?`,
      `Storefront: ${buildStorefrontUrl(newTenant.tenantCode, newTenant.customDomain) || 'will be generated after save'}`,
      `Login ID: ${newTenant.adminLoginId || '(not set)'}`,
    ].join('\n\n')

    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return

    const res = await secureFetch('/api/platform/tenants', {
      method: 'POST',
      body: JSON.stringify({
        tenantCode: newTenant.tenantCode,
        businessName: newTenant.businessName,
        email: newTenant.email || undefined,
        whatsappNumber: newTenant.whatsappNumber || undefined,
        currency: newTenant.currency,
        logoUrl: newTenant.logoUrl || undefined,
        customDomain: newTenant.useCustomDomain ? (newTenant.customDomain || undefined) : undefined,
        customDomainType: newTenant.useCustomDomain ? newTenant.customDomainType : undefined,
        customDomainIsPrimary: newTenant.useCustomDomain ? newTenant.customDomainIsPrimary : undefined,
        customDomainIsVerified: newTenant.useCustomDomain ? newTenant.customDomainIsVerified : undefined,
        customDomainSslStatus: newTenant.useCustomDomain ? (newTenant.customDomainSslStatus || undefined) : undefined,
        planId: newTenant.planId || undefined,
        expiryDate: newTenant.expiryDate ? new Date(newTenant.expiryDate).toISOString() : undefined,
        adminLoginId: newTenant.adminLoginId || undefined,
        adminPassword: newTenant.adminPassword || undefined,
        businessType: newTenant.businessType,
        clientStatus: newTenant.clientStatus || undefined,
        isActive: newTenant.isActive,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to create client')
    const storefrontUrl = buildStorefrontUrl(newTenant.tenantCode, newTenant.useCustomDomain ? newTenant.customDomain : '')
    setCreatedTenantSummary({
      tenantCode: newTenant.tenantCode,
      businessName: newTenant.businessName,
      loginId: newTenant.adminLoginId || '',
      password: newTenant.adminPassword || '',
      storefrontUrl,
    })
    setCreateTenantOpen(false)
    setNewTenant({ tenantCode: '', businessName: '', email: '', whatsappNumber: '', currency: 'INR', logoUrl: '', customDomain: '', customDomainType: 'custom', customDomainIsPrimary: true, customDomainIsVerified: true, customDomainSslStatus: '', useCustomDomain: false, planId: '', expiryDate: '', adminLoginId: '', adminPassword: '', paymentGateway: 'razorpay', paymentModes: 'UPI,Card,NetBanking,Wallet', razorpayKeyId: '', razorpayEnabled: false, businessType: 'ecommerce_product', clientStatus: 'active', isActive: true })
  }

  async function updateTenant(id: string) {
    const draft = tenantDrafts[id]
    const res = await secureFetch('/api/platform/tenants', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        businessName: draft.businessName,
        email: draft.email || undefined,
        whatsappNumber: draft.whatsappNumber || undefined,
        currency: draft.currency,
        logoUrl: draft.logoUrl || undefined,
        customDomain: draft.useCustomDomain ? (draft.customDomain || undefined) : undefined,
        customDomainType: draft.useCustomDomain ? draft.customDomainType : undefined,
        customDomainIsPrimary: draft.useCustomDomain ? draft.customDomainIsPrimary : undefined,
        customDomainIsVerified: draft.useCustomDomain ? draft.customDomainIsVerified : undefined,
        customDomainSslStatus: draft.useCustomDomain ? (draft.customDomainSslStatus || undefined) : undefined,
        planId: draft.planId || undefined,
        expiryDate: draft.expiryDate ? new Date(draft.expiryDate).toISOString() : undefined,
        adminLoginId: draft.adminLoginId || undefined,
        adminPassword: draft.adminPassword || undefined,
        businessType: draft.businessType,
        clientStatus: draft.clientStatus || undefined,
        isActive: draft.isActive,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update client')
  }

  async function resetTenantPassword(id: string) {
    const tenant = tenants.find((row) => row.id === id)
    if (!tenant) throw new Error('Client not found')
    const password = window.prompt(`Reset password for ${tenant.business_name || tenant.tenant_code || 'client'}`, '')
    if (!password) return
    await runAction(async () => {
      const res = await secureFetch('/api/platform/tenants', {
        method: 'PATCH',
        body: JSON.stringify({
          id,
          adminPassword: password,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to reset password')
    }, 'Client password reset successfully.')
  }

  async function deleteTenant(id: string) {
    const res = await secureFetch('/api/platform/tenants', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to delete client')
  }

  async function createPlan() {
    const res = await secureFetch('/api/platform/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        sid: newPlan.sid || undefined,
        planCode: newPlan.planCode,
        name: newPlan.name,
        billingCycle: newPlan.billingCycle,
        price: Number(newPlan.price || 0),
        currency: newPlan.currency,
        features: parseJsonField(newPlan.featuresText, 'Features'),
        limits: parseJsonField(newPlan.limitsText, 'Limits'),
        isActive: newPlan.isActive,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to create plan')
    setNewPlan({
      sid: '',
      planCode: '',
      name: '',
      billingCycle: 'monthly',
      price: 0,
      currency: 'INR',
      featuresText: '{\n  "support": "standard"\n}',
      limitsText: '{\n  "products": 500\n}',
      isActive: true,
    })
  }

  async function updatePlan(id: string) {
    const draft = planDrafts[id]
    const res = await secureFetch('/api/platform/subscriptions', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        sid: draft.sid || undefined,
        planCode: draft.planCode,
        name: draft.name,
        billingCycle: draft.billingCycle,
        price: Number(draft.price || 0),
        currency: draft.currency,
        features: parseJsonField(draft.featuresText, 'Features'),
        limits: parseJsonField(draft.limitsText, 'Limits'),
        isActive: draft.isActive,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update plan')
  }

  async function deletePlan(id: string) {
    const res = await secureFetch('/api/platform/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ id, mode: 'plan' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to delete plan')
  }

  function toIsoFromLocal(value: string) {
    return value ? new Date(value).toISOString() : undefined
  }

  async function createSubscription() {
    const res = await secureFetch('/api/platform/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'assign',
        tenantId: newAssignment.tenantId,
        planId: newAssignment.planId,
        status: newAssignment.status,
        provider: newAssignment.provider || undefined,
        providerCustomerId: newAssignment.providerCustomerId || undefined,
        providerSubscriptionId: newAssignment.providerSubscriptionId || undefined,
        canceledAt: toIsoFromLocal(newAssignment.canceledAt),
        currentPeriodStart: toIsoFromLocal(newAssignment.currentPeriodStart),
        currentPeriodEnd: toIsoFromLocal(newAssignment.currentPeriodEnd),
        trialEndsAt: toIsoFromLocal(newAssignment.trialEndsAt),
        dashboardLock: newAssignment.dashboardLock,
        featureOverrides: normalizeStrictOverrideMap(parseJsonField(newAssignment.featureOverridesText, 'Feature overrides')),
        limitOverrides: parseJsonField(newAssignment.limitOverridesText, 'Limit overrides'),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to assign subscription')
    setNewAssignment({ tenantId: '', planId: '', status: 'active', provider: '', providerCustomerId: '', providerSubscriptionId: '', canceledAt: '', currentPeriodStart: '', currentPeriodEnd: '', trialEndsAt: '', dashboardLock: false, featureOverridesText: '{}', limitOverridesText: '{}' })
  }

  async function updateSubscription(id: string) {
    const draft = subscriptionDrafts[id]
    const res = await secureFetch('/api/platform/subscriptions', {
      method: 'PATCH',
      body: JSON.stringify({
        mode: 'subscription',
        id,
        planId: draft.planId,
        status: draft.status,
        provider: draft.provider || null,
        providerCustomerId: draft.providerCustomerId || null,
        providerSubscriptionId: draft.providerSubscriptionId || null,
        canceledAt: draft.canceledAt ? new Date(draft.canceledAt).toISOString() : null,
        currentPeriodStart: draft.currentPeriodStart ? new Date(draft.currentPeriodStart).toISOString() : null,
        currentPeriodEnd: draft.currentPeriodEnd ? new Date(draft.currentPeriodEnd).toISOString() : null,
        trialEndsAt: draft.trialEndsAt ? new Date(draft.trialEndsAt).toISOString() : null,
        dashboardLock: draft.dashboardLock,
        featureOverrides: normalizeStrictOverrideMap(parseJsonField(draft.featureOverridesText, 'Feature overrides')),
        limitOverrides: parseJsonField(draft.limitOverridesText, 'Limit overrides'),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update subscription')
  }

  async function deleteSubscription(id: string) {
    const res = await secureFetch('/api/platform/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ id, mode: 'subscription' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to delete subscription')
  }

  function openSubscriptionModal(subscription: SubscriptionRow, mode: 'view' | 'edit') {
    setSubscriptionDrafts((state) => {
      if (state[subscription.id]) return state
      return {
        ...state,
        [subscription.id]: buildSubscriptionDraft(subscription),
      }
    })
    setSubscriptionModalMode(mode)
    setSubscriptionModalId(subscription.id)
  }

  async function createStaffUser() {
    const roleKeys = newStaff.roleKeys.split(',').map((value) => value.trim()).filter(Boolean)
    const res = await secureFetch('/api/platform/staff', {
      method: 'POST',
      body: JSON.stringify({
        scope: newStaff.scope,
        tenantId: newStaff.scope === 'tenant' ? newStaff.tenantId : undefined,
        username: newStaff.username,
        email: newStaff.email || undefined,
        password: newStaff.password,
        displayName: newStaff.displayName || undefined,
        roleKeys,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to create staff user')
    setNewStaff({ scope: 'platform', tenantId: '', username: '', email: '', password: '', displayName: '', roleKeys: 'admin' })
  }

  async function updateStaffUser(id: string) {
    const draft = staffDrafts[id]
    const res = await secureFetch('/api/platform/staff', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        displayName: draft.displayName || undefined,
        phone: draft.phone || undefined,
        isActive: draft.isActive,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update staff user')
  }

  async function deleteStaffUser(id: string) {
    const res = await secureFetch('/api/platform/staff', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to delete staff user')
  }

  async function updateSupportTicket(id: string, status: string, assignedToUserId?: string | null) {
    const res = await secureFetch('/api/platform/support', {
      method: 'PATCH',
      body: JSON.stringify({ id, status, assignedToUserId: assignedToUserId || null }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update support ticket')
  }

  async function addSupportComment(ticketId: string) {
    const comment = String(supportCommentDrafts[ticketId] || '').trim()
    if (!comment) return
    const res = await secureFetch('/api/platform/support', {
      method: 'POST',
      body: JSON.stringify({ ticketId, comment }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to add support comment')
    setSupportCommentDrafts((state) => ({ ...state, [ticketId]: '' }))
  }

  async function createComm() {
    const res = await secureFetch('/api/platform/comms', {
      method: 'POST',
      body: JSON.stringify({
        title: newComm.title,
        body: newComm.body,
        imageUrl: newComm.imageUrl || undefined,
        targetTenantId: newComm.targetTenantId || undefined,
        status: newComm.status,
        startAt: newComm.startAt ? new Date(newComm.startAt).toISOString() : undefined,
        endAt: newComm.endAt ? new Date(newComm.endAt).toISOString() : undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to create communication')
    setNewComm({ title: '', body: '', imageUrl: '', targetTenantId: '', status: 'active', startAt: '', endAt: '' })
  }

  async function updateComm(id: string, payload: Partial<PlatformCommRow>) {
    const res = await secureFetch('/api/platform/comms', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...payload }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update communication')
  }

  async function updateCommFromDraft(id: string) {
    const draft = commDrafts[id]
    if (!draft) throw new Error('Communication draft not found')
    await updateComm(id, {
      title: draft.title,
      body: draft.body,
      imageUrl: draft.imageUrl,
      targetTenantId: draft.targetTenantId || null,
      status: draft.status,
      startAt: draft.startAt ? new Date(draft.startAt).toISOString() : null,
      endAt: draft.endAt ? new Date(draft.endAt).toISOString() : null,
    } as any)
  }

  async function deleteComm(id: string) {
    const res = await secureFetch('/api/platform/comms', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to delete communication')
  }

  async function updateTenantPaymentSettings(id: string) {
    const draft = tenantDrafts[id]
    if (!draft) throw new Error('Client settings draft not found')
    const hasRazorpayKey = Boolean(String(draft.razorpayKeyId || '').trim())
    const paymentModes = String(draft.paymentModes || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    const effectiveModes = hasRazorpayKey
      ? Array.from(new Set(['UPI', 'Card', 'NetBanking', ...paymentModes]))
      : ['whatsapp_confirmation']

    const res = await secureFetch('/api/platform/tenants', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        paymentGateway: hasRazorpayKey ? 'razorpay' : 'whatsapp_confirmation',
        paymentModes: effectiveModes,
        razorpayKeyId: hasRazorpayKey ? draft.razorpayKeyId : '',
        razorpayEnabled: hasRazorpayKey,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update payment settings')
  }

  async function createPaymentRecord() {
    if (!newPayment.tenantId) throw new Error('Client is required')
    if (!Number(newPayment.amount || 0)) throw new Error('Amount is required')

    const res = await secureFetch('/api/platform/payments', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: newPayment.tenantId,
        subscriptionId: newPayment.subscriptionId || undefined,
        amount: Number(newPayment.amount || 0),
        currency: newPayment.currency || 'INR',
        status: newPayment.status,
        method: newPayment.method || undefined,
        reference: newPayment.reference || undefined,
        paidAt: newPayment.paidAt ? new Date(newPayment.paidAt).toISOString() : undefined,
        dueDate: newPayment.dueDate ? new Date(newPayment.dueDate).toISOString() : undefined,
        notes: newPayment.notes || undefined,
        receiptNumber: newPayment.receiptNumber || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to create payment record')

    setNewPayment({ tenantId: '', subscriptionId: '', amount: 0, currency: 'INR', status: 'pending', method: '', reference: '', paidAt: '', dueDate: '', notes: '', receiptNumber: '' })
  }

  async function updatePaymentRecord(id: string) {
    const draft = paymentDrafts[id]
    if (!draft) throw new Error('Payment record not found')

    const res = await secureFetch('/api/platform/payments', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        tenantId: draft.tenantId,
        subscriptionId: draft.subscriptionId || undefined,
        amount: Number(draft.amount || 0),
        currency: draft.currency || 'INR',
        status: draft.status,
        method: draft.method || undefined,
        reference: draft.reference || undefined,
        paidAt: draft.paidAt ? new Date(draft.paidAt).toISOString() : undefined,
        dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : undefined,
        notes: draft.notes || undefined,
        receiptNumber: draft.receiptNumber || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to update payment record')
  }

  async function deletePaymentRecord(id: string) {
    const res = await secureFetch('/api/platform/payments', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to delete payment record')
  }

  function downloadPaymentReceipt(payment: PlatformPaymentRow) {
    if (typeof window === 'undefined') return
    const tenantName = payment.tenant?.business_name || payment.tenant?.tenant_code || payment.tenant_id
    const receiptNo = payment.receipt_number || `RCPT-${payment.id.slice(0, 8).toUpperCase()}`
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })

    pdf.setFillColor(15, 23, 42)
    pdf.rect(0, 0, 595, 110, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(20)
    pdf.text('ImiqX Platform', 40, 50)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Payment Receipt', 40, 72)

    pdf.setTextColor(17, 24, 39)
    pdf.setFontSize(11)

    const rows: Array<[string, string]> = [
      ['Receipt Number', receiptNo],
      ['Client', tenantName],
      ['Client ID', payment.tenant_id],
      ['Amount', formatMoney(payment.amount || 0, payment.currency || 'INR')],
      ['Status', titleize(payment.status || '')],
      ['Method', payment.method || '-'],
      ['Reference', payment.reference || '-'],
      ['Paid On', formatDate(payment.payment_date)],
      ['Due Date', formatDate(payment.due_date)],
      ['Notes', payment.notes || '-'],
      ['Generated', new Date().toLocaleString('en-IN')],
    ]

    let y = 140
    for (const [label, value] of rows) {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, 40, y)
      pdf.setFont('helvetica', 'normal')
      const wrapped = pdf.splitTextToSize(String(value || '-'), 360)
      pdf.text(wrapped, 170, y)
      y += Math.max(22, wrapped.length * 14)
    }

    pdf.setDrawColor(203, 213, 225)
    pdf.line(40, y + 10, 555, y + 10)
    pdf.setTextColor(100, 116, 139)
    pdf.setFontSize(10)
    pdf.text('System-generated receipt for customer communication.', 40, y + 30)

    pdf.save(`${receiptNo}.pdf`)
  }

  if (!loggedIn) {
    return (
      <LoginScreen
        usernameOrEmail={usernameOrEmail}
        password={password}
        error={error}
        loading={loading}
        onUsernameChange={setUsernameOrEmail}
        onPasswordChange={setPassword}
        onSubmit={onLogin}
      />
    )
  }

  const sectionMeta = NAV.find((item) => item.id === section)

  return (
    <div className="platform-light fixed inset-0 z-[9999] flex overflow-hidden bg-[radial-gradient(circle_at_12%_14%,rgba(6,182,212,0.10),transparent_42%),radial-gradient(circle_at_88%_20%,rgba(14,116,255,0.09),transparent_40%),linear-gradient(145deg,#f8fbff,#eef5ff_50%,#f8fafc)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-6 h-[26rem] w-[26rem] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[24rem] w-[24rem] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] rounded-full bg-teal-400/10 blur-[120px]" />
      </div>
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-68 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0 ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="m-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 text-sm font-extrabold text-white shadow-md shadow-cyan-500/30">PX</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">ImiqX Platform</p>
            <p className="text-[10px] text-slate-500">Global Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => { setSection(item.id); setSideOpen(false) }}
              className={`card-3d w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                section === item.id
                  ? 'border border-cyan-300/45 bg-gradient-to-r from-cyan-50 to-sky-50 text-slate-900 shadow-sm'
                  : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="w-6 shrink-0 text-center text-lg">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">{item.label}</p>
                <p className={`mt-0.5 text-[10px] ${section === item.id ? 'text-cyan-700/90' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
              {section === item.id && <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />}
            </button>
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-200 px-4 py-4">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live Snapshot</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{derivedStats.total} tenants</p>
            <p className="mt-1 text-xs text-slate-600">{formatMoney(platformStats?.totalPaidRevenue || 0)} in paid client revenue</p>
          </div>
          <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl border border-red-700 bg-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(220,38,38,0.28)] transition hover:bg-red-700">
            <span>🚪</span> Logout
          </button>
          <p className="pt-1 text-center text-[10px] text-slate-500">Powered by ImiqX</p>
        </div>
      </aside>

      {sideOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSideOpen(false)} />}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="mx-3 mt-3 flex h-14 shrink-0 items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-4 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-1.5 text-slate-500 hover:text-slate-900 lg:hidden" onClick={() => setSideOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div>
              <p className="text-sm font-bold text-slate-900">{sectionMeta?.label}</p>
              <p className="hidden text-[10px] text-slate-500 sm:block">{sectionMeta?.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="hidden text-xs font-semibold text-slate-500 sm:block">Saving...</span>}
            <button onClick={() => refreshAll().catch((err) => setError(err.message || 'Refresh failed'))} className="hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 sm:flex">Refresh</button>
            <button onClick={onLogout} className="flex items-center gap-1.5 rounded-xl border border-red-700 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_14px_rgba(220,38,38,0.25)] transition hover:bg-red-700">Logout</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
            {flash && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{flash}</div>}
            {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

            {section === 'dashboard' && (
              <div className="space-y-6">
                <SectionHeader title="Dashboard" subtitle="Operational metrics focused on client payments and subscription health." />

                <Card className="p-5">
                  <SectionHeader title="Admin Dashboard" subtitle="Platform-wide control metrics: clients, paid revenue, and active account health." />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total Clients" value={platformStats?.totalClients || 0} sub={`${platformStats?.todayClients || 0} added today`} />
                    <StatCard label="Overall Active Clients" value={platformStats?.activeClients || 0} sub={`${derivedStats.suspended} inactive / suspended`} />
                    <StatCard label="Paid Client Revenue" value={formatMoney(platformStats?.totalPaidRevenue || 0)} sub={`${platformStats?.totalPaidRecords || 0} paid records`} />
                    <StatCard label="Pending Collection" value={formatMoney(platformStats?.totalPendingAmount || 0)} sub="Unsettled client payments" />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Clients With Paid Revenue" value={platformStats?.clientsWithPaidRevenue || 0} sub="Revenue-generating clients" />
                    <StatCard label="Payment Records" value={platformStats?.totalPaymentRecords || 0} sub="Ledger entries" />
                    <StatCard label="Active Subscriptions" value={platformStats?.activeSubscriptions || 0} sub="Active, trialing and past due" />
                    <StatCard label="Plan Book Value" value={formatMoney(platformStats?.monthlyRecurringRevenue || 0)} sub="Current subscription MRR" />
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionHeader title="Client Dashboard" subtitle="Per-client payment and subscription concentration from the platform payment ledger." />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Top Client Paid Revenue" value={formatMoney((platformStats?.revenueByTenant || []).reduce((max, row) => Math.max(max, Number(row.paidRevenue || 0)), 0))} sub="Highest single-client payment" />
                    <StatCard label="Paid Records" value={platformStats?.totalPaidRecords || 0} sub="Successful payment entries" />
                    <StatCard label="Pending Amount" value={formatMoney(platformStats?.totalPendingAmount || 0)} sub="Awaiting collection" />
                    <StatCard label="Payment Ledger" value={paymentTableMissing ? 'Missing' : 'Ready'} sub={paymentTableMissing ? 'Run migration to enable' : 'Synced with platform DB'} />
                  </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <Card className="p-5">
                    <SectionHeader title="Client Revenue Board" subtitle="All clients ranked by paid revenue, payment counts, and renewal status." />
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-3">Client</th>
                            <th className="px-3 py-3">Plan</th>
                            <th className="px-3 py-3">Paid Records</th>
                            <th className="px-3 py-3">Paid Revenue</th>
                            <th className="px-3 py-3">Renewal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(platformStats?.revenueByTenant || []).map((row) => (
                            <tr key={row.tenantId} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-3 py-3">
                                <p className="font-semibold text-slate-900">{row.businessName || row.tenantCode || row.tenantId}</p>
                                <p className="text-xs text-slate-500">{row.tenantCode || row.tenantId}</p>
                              </td>
                              <td className="px-3 py-3">
                                <p className="text-slate-700">{row.planName || 'Unassigned'}</p>
                                <p className="text-xs text-slate-500">{row.planStatus ? titleize(row.planStatus) : 'No subscription'}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-700">{row.paidCount || 0}</td>
                              <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(row.paidRevenue || 0)}</td>
                              <td className="px-3 py-3 text-slate-400">{formatDate(row.currentPeriodEnd)}</td>
                            </tr>
                          ))}
                          {(platformStats?.revenueByTenant || []).length === 0 && (
                            <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No client metrics available yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <div className="space-y-6">
                    <Card className="p-5">
                      <SectionHeader title="Order Pipeline" subtitle="All client orders combined." />
                      <div className="space-y-3">
                        {[
                          ['Pending', platformStats?.statusCounts.pending || 0, 'bg-amber-400'],
                          ['Processing', platformStats?.statusCounts.processing || 0, 'bg-blue-400'],
                          ['Shipped', platformStats?.statusCounts.shipped || 0, 'bg-violet-400'],
                          ['Delivered', platformStats?.statusCounts.delivered || 0, 'bg-emerald-400'],
                          ['Cancelled', platformStats?.statusCounts.cancelled || 0, 'bg-red-400'],
                        ].map(([label, value, color]) => (
                          <div key={String(label)}>
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>{label}</span><span>{value}</span></div>
                            <div className="h-2 rounded-full bg-white/5"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, (Number(value) / Math.max(1, platformStats?.totalOrders || 1)) * 100)}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-5">
                      <SectionHeader title="Plan Mix" subtitle="Current platform package distribution." />
                      <div className="space-y-3">
                        {plans.map((plan) => {
                          const count = subscriptions.filter((subscription) => subscription.plan_id === plan.id).length
                          return (
                            <div key={plan.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{plan.name}</p>
                                <p className="text-xs text-slate-500">{plan.plan_code} · {titleize(plan.billing_cycle)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-white">{count}</p>
                                <p className="text-xs text-slate-500">{formatMoney(Number(plan.price || 0), plan.currency || 'INR')}</p>
                              </div>
                            </div>
                          )
                        })}
                        {plans.length === 0 && <p className="text-sm text-slate-500">No plans configured yet.</p>}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {section === 'clients' && (
              <div>
                <SectionHeader title="Client Control" subtitle="Create, edit, suspend and delete client storefronts." action={<Btn onClick={() => setCreateTenantOpen(true)}>Create Client</Btn>} />

                {createdTenantSummary && (
                  <Card className="mb-4 p-5">
                    <SectionHeader title="Client Created" subtitle="Copy these details into your records or send them to the client." />
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Business</p>
                        <p className="mt-1 text-sm text-white">{createdTenantSummary.businessName}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Login ID</p>
                        <p className="mt-1 text-sm text-white">{createdTenantSummary.loginId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Password</p>
                        <p className="mt-1 text-sm text-white">{createdTenantSummary.password || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Storefront URL</p>
                        <p className="mt-1 break-all text-sm text-white">{createdTenantSummary.storefrontUrl || '-'}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Btn size="sm" onClick={() => copyToClipboard(`Login ID: ${createdTenantSummary.loginId}\nPassword: ${createdTenantSummary.password}\nStorefront URL: ${createdTenantSummary.storefrontUrl}`, 'Client access details')}>Copy Login Summary</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setCreatedTenantSummary(null)}>Dismiss</Btn>
                    </div>
                  </Card>
                )}

                {createTenantOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <Card className="max-h-[90vh] w-full max-w-6xl overflow-y-auto p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-white">Create Client</h3>
                          <p className="text-sm text-slate-400">Add all client details before saving.</p>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => setCreateTenantOpen(false)}>Close</Btn>
                      </div>

                      {newTenant.tenantCode.trim() && (
                        <Card className="mb-4 p-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Storefront URL Preview</p>
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <Inp value={buildStorefrontUrl(newTenant.tenantCode, newTenant.useCustomDomain ? newTenant.customDomain : '')} readOnly placeholder="Storefront URL" className="font-medium" />
                            <Btn size="sm" variant="ghost" onClick={() => copyToClipboard(buildStorefrontUrl(newTenant.tenantCode, newTenant.useCustomDomain ? newTenant.customDomain : ''), 'Storefront URL')}>
                              Copy URL
                            </Btn>
                          </div>
                        </Card>
                      )}

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Store Code</label>
                      <Inp value={newTenant.tenantCode} onChange={(event) => setNewTenant((state) => ({ ...state, tenantCode: event.target.value }))} placeholder="store-code" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Business Name</label>
                      <Inp value={newTenant.businessName} onChange={(event) => setNewTenant((state) => ({ ...state, businessName: event.target.value }))} placeholder="Business name" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Email</label>
                      <Inp value={newTenant.email} onChange={(event) => setNewTenant((state) => ({ ...state, email: event.target.value }))} placeholder="client@example.com" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">WhatsApp Number</label>
                      <Inp value={newTenant.whatsappNumber} onChange={(event) => setNewTenant((state) => ({ ...state, whatsappNumber: event.target.value }))} placeholder="WhatsApp number" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Currency</label>
                      <Inp value={newTenant.currency} onChange={(event) => setNewTenant((state) => ({ ...state, currency: event.target.value }))} placeholder="INR" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Logo URL (optional)</label>
                      <Inp value={newTenant.logoUrl} onChange={(event) => setNewTenant((state) => ({ ...state, logoUrl: event.target.value }))} placeholder="https://..." />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                        <input type="checkbox" checked={newTenant.useCustomDomain} onChange={(event) => setNewTenant((state) => ({
                          ...state,
                          useCustomDomain: event.target.checked,
                          customDomain: event.target.checked ? state.customDomain : '',
                          customDomainSslStatus: event.target.checked ? state.customDomainSslStatus : '',
                        }))} />
                        Use Custom Domain
                      </label>
                    </div>
                    {newTenant.useCustomDomain && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Custom Domain</label>
                          <Inp value={newTenant.customDomain} onChange={(event) => setNewTenant((state) => ({ ...state, customDomain: event.target.value }))} placeholder="shop.clientdomain.com" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Domain Type</label>
                          <Sel value={newTenant.customDomainType} onChange={(event) => setNewTenant((state) => ({ ...state, customDomainType: event.target.value as 'custom' | 'subdomain' }))}>
                            <option value="custom">Custom</option>
                            <option value="subdomain">Subdomain</option>
                          </Sel>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">SSL Status (optional)</label>
                          <Inp value={newTenant.customDomainSslStatus} onChange={(event) => setNewTenant((state) => ({ ...state, customDomainSslStatus: event.target.value }))} placeholder="active / pending" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Plan Type</label>
                      <Sel value={newTenant.planId} onChange={(event) => {
                        const selectedPlan = planById.get(event.target.value)
                        const start = formatDateTimeInput(new Date().toISOString())
                        setNewTenant((state) => ({
                          ...state,
                          planId: event.target.value,
                          expiryDate: addDaysInput(start, inferPlanDays(selectedPlan)),
                        }))
                      }}>
                        <option value="">Select plan</option>
                        {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.plan_code})</option>)}
                      </Sel>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Expiry Date (auto)</label>
                      <Inp value={newTenant.expiryDate} onChange={(event) => setNewTenant((state) => ({ ...state, expiryDate: event.target.value }))} type="datetime-local" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Admin Login ID</label>
                      <Inp value={newTenant.adminLoginId} onChange={(event) => setNewTenant((state) => ({ ...state, adminLoginId: event.target.value }))} placeholder="store_admin" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Admin Password</label>
                      <div className="relative">
                        <Inp value={newTenant.adminPassword} onChange={(event) => setNewTenant((state) => ({ ...state, adminPassword: event.target.value }))} type={showNewTenantPassword ? 'text' : 'password'} placeholder="Set temporary password" className="pr-10" />
                        <button
                          type="button"
                          aria-label={showNewTenantPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowNewTenantPassword((state) => !state)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-cyan-200"
                        >
                          {showNewTenantPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Business Type</label>
                      <Sel value={newTenant.businessType} onChange={(event) => setNewTenant((state) => ({ ...state, businessType: event.target.value as 'ecommerce_product' | 'ecommerce_services' }))}>
                        <option value="ecommerce_product">ecommerce_product (Buy Now)</option>
                        <option value="ecommerce_services">ecommerce_services (Enquire Now)</option>
                      </Sel>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Client Status</label>
                      <Sel value={newTenant.clientStatus} onChange={(event) => setNewTenant((state) => ({ ...state, clientStatus: event.target.value as 'active' | 'inactive' | 'expired' | 'deleted', isActive: event.target.value === 'active' }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="expired">Expired</option>
                        <option value="deleted">Deleted</option>
                      </Sel>
                    </div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={newTenant.isActive} onChange={(event) => setNewTenant((state) => ({ ...state, isActive: event.target.checked }))} />
                    Active on creation
                  </label>
                  {newTenant.useCustomDomain && (
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-300">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={newTenant.customDomainIsPrimary} onChange={(event) => setNewTenant((state) => ({ ...state, customDomainIsPrimary: event.target.checked }))} />
                        Domain is primary
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={newTenant.customDomainIsVerified} onChange={(event) => setNewTenant((state) => ({ ...state, customDomainIsVerified: event.target.checked }))} />
                        Domain verified
                      </label>
                    </div>
                  )}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Btn onClick={() => runAction(createTenant, 'Client created successfully.')}>Create Client</Btn>
                        <Btn variant="ghost" onClick={() => setCreateTenantOpen(false)}>Cancel</Btn>
                      </div>
                    </Card>
                  </div>
                )}

                <Card className="mt-6 p-5">
                  <SectionHeader title="Client Records" subtitle="List view by default. Open details only when you click View." />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-3">Client</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Subscription</th>
                          <th className="px-3 py-3">Storefront</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map((tenant) => {
                          const draft = tenantDrafts[tenant.id]
                          const tenantStats = platformStats?.revenueByTenant.find((row) => row.tenantId === tenant.id)
                          const storefrontUrl = buildStorefrontUrl(
                            draft?.tenantCode || tenant.tenant_code || '',
                            draft?.customDomain || tenant.custom_domain || ''
                          )
                          const status = tenant.client_status || (tenant.is_active ? 'active' : 'inactive')
                          return (
                            <tr key={tenant.id} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-3 py-3">
                                <p className="font-semibold text-slate-900">{tenant.business_name || tenant.tenant_code || tenant.id}</p>
                                <p className="text-xs text-slate-500">{tenant.tenant_code || tenant.id} · {tenant.email || 'No email'}</p>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(status)}`}>{titleize(status)}</span>
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                <p>{tenantStats?.planName || 'Unassigned'}</p>
                                <p className="text-xs text-slate-500">{tenantStats?.planStatus ? titleize(tenantStats.planStatus) : 'No subscription'}</p>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <p className="max-w-[280px] truncate text-xs text-slate-300" title={storefrontUrl || ''}>{storefrontUrl || '-'}</p>
                                  <Btn size="sm" variant="ghost" disabled={!storefrontUrl} onClick={() => copyToClipboard(storefrontUrl, 'Storefront URL')}>Copy</Btn>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <Btn size="sm" variant="ghost" onClick={() => { setTenantModalMode('view'); setTenantModalId(tenant.id) }}>View</Btn>
                                  <Btn size="sm" onClick={() => { setTenantModalMode('edit'); setTenantModalId(tenant.id) }}>Edit</Btn>
                                  <Btn size="sm" variant="danger" onClick={() => runDeleteAction(() => deleteTenant(tenant.id), `Deleted ${tenant.business_name || tenant.tenant_code || 'client'}.`, tenant.business_name || tenant.tenant_code || 'this client')}>Delete</Btn>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {tenants.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No clients found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {tenantModalId && (() => {
                  const tenant = tenants.find((row) => row.id === tenantModalId)
                  if (!tenant) return null
                  const draft = tenantDrafts[tenant.id]
                  const isEditMode = tenantModalMode === 'edit'
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                      <Card className="max-h-[90vh] w-full max-w-4xl overflow-y-auto p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-white">{isEditMode ? 'Edit Client' : 'View Client'}</h3>
                            <p className="text-sm text-slate-400">{tenant.business_name || tenant.tenant_code || tenant.id}</p>
                          </div>
                          <Btn size="sm" variant="ghost" onClick={() => setTenantModalId(null)}>Close</Btn>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <Inp value={draft?.tenantCode || ''} readOnly className="opacity-70" />
                          <Inp readOnly={!isEditMode} value={draft?.businessName || ''} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], businessName: event.target.value } }))} placeholder="Business name" />
                          <Inp readOnly={!isEditMode} value={draft?.email || ''} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], email: event.target.value } }))} placeholder="client@example.com" />
                          <Inp readOnly={!isEditMode} value={draft?.whatsappNumber || ''} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], whatsappNumber: event.target.value } }))} placeholder="WhatsApp" />
                          <Sel disabled={!isEditMode} value={draft?.businessType || 'ecommerce_product'} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], businessType: event.target.value as 'ecommerce_product' | 'ecommerce_services' } }))}>
                            <option value="ecommerce_product">ecommerce_product (Buy Now)</option>
                            <option value="ecommerce_services">ecommerce_services (Enquire Now)</option>
                          </Sel>
                          <Sel disabled={!isEditMode} value={draft?.customDomainType || 'custom'} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], customDomainType: event.target.value as 'custom' | 'subdomain' } }))}>
                            <option value="custom">Custom</option>
                            <option value="subdomain">Subdomain</option>
                          </Sel>
                          <Inp readOnly={!isEditMode} value={draft?.customDomain || ''} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], customDomain: event.target.value } }))} placeholder="Custom domain" />
                          <Sel disabled={!isEditMode} value={draft?.clientStatus || (tenant.is_active ? 'active' : 'inactive')} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], clientStatus: event.target.value as any, isActive: event.target.value === 'active' } }))}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="expired">Expired</option>
                            <option value="deleted">Deleted</option>
                          </Sel>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {isEditMode && <Btn size="sm" onClick={() => runAction(() => updateTenant(tenant.id), `Updated ${tenant.business_name || tenant.tenant_code || 'client'}.`)}>Save Changes</Btn>}
                          {!isEditMode && <Btn size="sm" onClick={() => setTenantModalMode('edit')}>Edit</Btn>}
                          <Btn size="sm" variant="ghost" onClick={() => resetTenantPassword(tenant.id).catch((err) => setError(err.message || 'Password reset failed'))}>Reset Password</Btn>
                          <Btn size="sm" variant="danger" onClick={() => runDeleteAction(() => deleteTenant(tenant.id), `Deleted ${tenant.business_name || tenant.tenant_code || 'client'}.`, tenant.business_name || tenant.tenant_code || 'this client')}>Delete Client</Btn>
                        </div>
                        <div className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-500/8 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-200">Storefront URL</p>
                          <p className="break-all text-sm text-white">{buildStorefrontUrl(draft?.tenantCode || tenant.tenant_code || '', draft?.customDomain || tenant.custom_domain || '')}</p>
                        </div>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            )}

            {section === 'clientSettings' && (
              <div>
                <SectionHeader title="Client Settings" subtitle="Payment Options managed separately from client onboarding." />
                <Card className="p-5">
                  <SectionHeader title="Payment Options" subtitle="Online payment is enabled only when Razorpay key is provided." />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-3">Client</th>
                          <th className="px-3 py-3">Gateway</th>
                          <th className="px-3 py-3">Online Payment</th>
                          <th className="px-3 py-3">Fallback</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map((tenant) => {
                          const draft = tenantDrafts[tenant.id]
                          const hasKey = Boolean(String(draft?.razorpayKeyId || '').trim())
                          return (
                            <tr key={tenant.id} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-3 py-3">
                                <p className="font-semibold text-slate-900">{tenant.business_name || tenant.tenant_code || tenant.id}</p>
                                <p className="text-xs text-slate-500">{tenant.tenant_code || tenant.id}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-700">{hasKey ? 'Razorpay' : 'Not configured'}</td>
                              <td className="px-3 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(hasKey ? 'enabled' : 'disabled')}`}>{hasKey ? 'Enabled' : 'Disabled'}</span>
                              </td>
                              <td className="px-3 py-3 text-slate-700">WhatsApp confirmation</td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <Btn size="sm" variant="ghost" onClick={() => { setPaymentSettingsModalMode('view'); setPaymentSettingsModalId(tenant.id) }}>View</Btn>
                                  <Btn size="sm" onClick={() => { setPaymentSettingsModalMode('edit'); setPaymentSettingsModalId(tenant.id) }}>Edit</Btn>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {tenants.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No clients found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {paymentSettingsModalId && (() => {
                  const tenant = tenants.find((row) => row.id === paymentSettingsModalId)
                  if (!tenant) return null
                  const draft = tenantDrafts[tenant.id]
                  const isEditMode = paymentSettingsModalMode === 'edit'
                  const hasRazorpayKey = Boolean(String(draft?.razorpayKeyId || '').trim())
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-white">{isEditMode ? 'Edit Payment Options' : 'View Payment Options'}</h3>
                            <p className="text-sm text-slate-400">{tenant.business_name || tenant.tenant_code || tenant.id}</p>
                          </div>
                          <Btn size="sm" variant="ghost" onClick={() => setPaymentSettingsModalId(null)}>Close</Btn>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <Inp value={draft?.tenantCode || ''} readOnly className="opacity-70" />
                          <Inp value={draft?.businessName || ''} readOnly className="opacity-70" />
                          <Inp readOnly={!isEditMode} value={draft?.razorpayKeyId || ''} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], razorpayKeyId: event.target.value } }))} placeholder="rzp_live_xxxxx" />
                          <Inp readOnly={!isEditMode} value={draft?.paymentModes || ''} onChange={(event) => setTenantDrafts((state) => ({ ...state, [tenant.id]: { ...state[tenant.id], paymentModes: event.target.value } }))} placeholder="UPI,Card,NetBanking" />
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Effective Payment Behavior</p>
                          <p className="mt-1 text-sm text-slate-200">Online payment: {hasRazorpayKey ? 'Enabled (Razorpay)' : 'Disabled'}</p>
                          <p className="text-sm text-slate-300">Fallback: WhatsApp confirmation checkout</p>
                        </div>

                        <div className="mt-4 flex gap-2">
                          {isEditMode && <Btn onClick={() => runAction(async () => { await updateTenantPaymentSettings(tenant.id); setPaymentSettingsModalId(null) }, 'Client payment options updated.')}>Save</Btn>}
                          {!isEditMode && <Btn onClick={() => setPaymentSettingsModalMode('edit')}>Edit</Btn>}
                        </div>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            )}

            {section === 'plans' && (
              <div>
                <SectionHeader title="Subscription Plans" subtitle="List first. Use actions to open view and edit popups." action={<Btn onClick={() => setCreatePlanOpen(true)}>Create Plan</Btn>} />

                <Card className="p-5">
                  <SectionHeader title="Plan Records" subtitle="Compact records with nearby actions." />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-3">Plan</th>
                          <th className="px-3 py-3">Billing</th>
                          <th className="px-3 py-3">Price</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.map((plan) => (
                          <tr key={plan.id} className="border-b border-slate-50 last:border-b-0">
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-900">{plan.name}</p>
                              <p className="text-xs text-slate-500">{plan.plan_code}</p>
                            </td>
                            <td className="px-3 py-3 text-slate-700">{titleize(plan.billing_cycle)}</td>
                            <td className="px-3 py-3 text-slate-700">{formatMoney(Number(plan.price || 0), plan.currency || 'INR')}</td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(plan.is_active ? 'active' : 'inactive')}`}>{plan.is_active ? 'Active' : 'Inactive'}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Btn size="sm" variant="ghost" onClick={() => { setPlanModalMode('view'); setPlanModalId(plan.id) }}>View</Btn>
                                <Btn size="sm" onClick={() => { setPlanModalMode('edit'); setPlanModalId(plan.id) }}>Edit</Btn>
                                <Btn size="sm" variant="danger" onClick={() => runDeleteAction(() => deletePlan(plan.id), `Deleted ${plan.name}.`, plan.name || 'this plan')}>Delete</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {plans.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No plans found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {createPlanOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-white">Create Plan</h3>
                          <p className="text-sm text-slate-400">Define pricing, limits and feature bundle.</p>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => setCreatePlanOpen(false)}>Close</Btn>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <Inp value={newPlan.sid} onChange={(event) => setNewPlan((state) => ({ ...state, sid: event.target.value }))} placeholder="SID (optional)" />
                        <Inp value={newPlan.planCode} onChange={(event) => setNewPlan((state) => ({ ...state, planCode: event.target.value }))} placeholder="plan_code" />
                        <Inp value={newPlan.name} onChange={(event) => setNewPlan((state) => ({ ...state, name: event.target.value }))} placeholder="Plan name" />
                        <Sel value={newPlan.billingCycle} onChange={(event) => setNewPlan((state) => ({ ...state, billingCycle: event.target.value as BillingCycle }))}>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="half_yearly">Half-Yearly</option>
                          <option value="yearly">Yearly</option>
                        </Sel>
                        <Inp value={newPlan.price} onChange={(event) => setNewPlan((state) => ({ ...state, price: Number(event.target.value || 0) }))} type="number" placeholder="Price" />
                        <Inp value={newPlan.currency} onChange={(event) => setNewPlan((state) => ({ ...state, currency: event.target.value }))} placeholder="Currency" />
                      </div>
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        <Txt rows={6} value={newPlan.featuresText} onChange={(event) => setNewPlan((state) => ({ ...state, featuresText: event.target.value }))} placeholder="Features JSON" />
                        <Txt rows={6} value={newPlan.limitsText} onChange={(event) => setNewPlan((state) => ({ ...state, limitsText: event.target.value }))} placeholder="Limits JSON" />
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Feature toggles</p>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {FEATURE_DEFINITIONS.map((feature) => (
                            <label key={feature.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={isFeatureEnabled(newPlan.featuresText, feature.key)}
                                onChange={(event) => setNewPlan((state) => ({
                                  ...state,
                                  featuresText: setFeatureEnabled(state.featuresText, feature.key, event.target.checked),
                                }))}
                              />
                              {feature.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={newPlan.isActive} onChange={(event) => setNewPlan((state) => ({ ...state, isActive: event.target.checked }))} />
                        Active plan
                      </label>
                      <div className="mt-4 flex gap-2">
                        <Btn onClick={() => runAction(async () => { await createPlan(); setCreatePlanOpen(false) }, 'Plan created successfully.')}>Create Plan</Btn>
                        <Btn variant="ghost" onClick={() => setCreatePlanOpen(false)}>Cancel</Btn>
                      </div>
                    </Card>
                  </div>
                )}

                {planModalId && (() => {
                  const plan = plans.find((row) => row.id === planModalId)
                  if (!plan) return null
                  const draft = planDrafts[plan.id]
                  const isEditMode = planModalMode === 'edit'
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                      <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-white">{isEditMode ? 'Edit Plan' : 'View Plan'}</h3>
                            <p className="text-sm text-slate-400">{plan.name}</p>
                          </div>
                          <Btn size="sm" variant="ghost" onClick={() => setPlanModalId(null)}>Close</Btn>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                          <Inp readOnly={!isEditMode} value={draft?.sid || ''} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], sid: event.target.value } }))} placeholder="SID" />
                          <Inp readOnly={!isEditMode} value={draft?.planCode || ''} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], planCode: event.target.value } }))} placeholder="Plan code" />
                          <Inp readOnly={!isEditMode} value={draft?.name || ''} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], name: event.target.value } }))} placeholder="Plan name" />
                          <Sel disabled={!isEditMode} value={draft?.billingCycle || 'monthly'} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], billingCycle: event.target.value as BillingCycle } }))}>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="half_yearly">Half-Yearly</option>
                            <option value="yearly">Yearly</option>
                          </Sel>
                          <Inp readOnly={!isEditMode} value={draft?.price || 0} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], price: Number(event.target.value || 0) } }))} type="number" placeholder="Price" />
                          <Inp readOnly={!isEditMode} value={draft?.currency || ''} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], currency: event.target.value } }))} placeholder="Currency" />
                        </div>
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          <Txt disabled={!isEditMode} rows={6} value={draft?.featuresText || '{}'} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], featuresText: event.target.value } }))} />
                          <Txt disabled={!isEditMode} rows={6} value={draft?.limitsText || '{}'} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], limitsText: event.target.value } }))} />
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Feature toggles</p>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {FEATURE_DEFINITIONS.map((feature) => (
                              <label key={feature.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700">
                                <input
                                  disabled={!isEditMode}
                                  type="checkbox"
                                  checked={isFeatureEnabled(draft?.featuresText || '{}', feature.key)}
                                  onChange={(event) => setPlanDrafts((state) => ({
                                    ...state,
                                    [plan.id]: {
                                      ...state[plan.id],
                                      featuresText: setFeatureEnabled(state[plan.id]?.featuresText || '{}', feature.key, event.target.checked),
                                    },
                                  }))}
                                />
                                {feature.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                          <input disabled={!isEditMode} type="checkbox" checked={Boolean(draft?.isActive)} onChange={(event) => setPlanDrafts((state) => ({ ...state, [plan.id]: { ...state[plan.id], isActive: event.target.checked } }))} />
                          Active plan
                        </label>
                        <div className="mt-4 flex gap-2">
                          {isEditMode && <Btn onClick={() => runAction(async () => { await updatePlan(plan.id); setPlanModalId(null) }, `Updated ${plan.name}.`)}>Save Changes</Btn>}
                          {!isEditMode && <Btn onClick={() => setPlanModalMode('edit')}>Edit</Btn>}
                          <Btn variant="danger" onClick={() => runDeleteAction(async () => { await deletePlan(plan.id); setPlanModalId(null) }, `Deleted ${plan.name}.`, plan.name || 'this plan')}>Delete</Btn>
                        </div>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            )}

            {section === 'subscriptions' && (
              <div>
                <SectionHeader title="Client Subscriptions" subtitle="List first. Open records via actions to view or edit." action={<Btn onClick={() => setCreateSubscriptionOpen(true)}>Assign Plan</Btn>} />

                <div className="mb-6 grid gap-4 lg:grid-cols-2">
                  <Card className="p-5">
                    <SectionHeader title="Subscribers Per Plan" subtitle="Total clients mapped to each plan." />
                    <div className="space-y-2">
                      {plans.map((plan) => {
                        const count = subscriptions.filter((s) => s.plan_id === plan.id).length
                        return (
                          <div key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                            <span className="text-sm text-slate-200">{plan.name}</span>
                            <span className="rounded-full border border-cyan-300 bg-cyan-100 px-2.5 py-1 text-xs font-extrabold text-cyan-900 shadow-[0_0_0_1px_rgba(8,145,178,0.12)]">{count} subscribers</span>
                          </div>
                        )
                      })}
                    </div>
                  </Card>

                  <Card className="p-5">
                    <SectionHeader title="Follow-up Queue" subtitle="Expiring within 7 days and expired subscriptions." />
                    <div className="space-y-2">
                      {subscriptions
                        .filter((s) => {
                          const plan = planById.get(s.plan_id)
                          const renewalDate = resolveSubscriptionRenewalDate(s, plan)
                          const end = renewalDate ? new Date(renewalDate) : null
                          if (!end || Number.isNaN(end.getTime())) return false
                          const diffDays = Math.floor((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                          return diffDays <= 7
                        })
                        .sort((a, b) => {
                          const aDate = resolveSubscriptionRenewalDate(a, planById.get(a.plan_id))
                          const bDate = resolveSubscriptionRenewalDate(b, planById.get(b.plan_id))
                          return new Date(aDate || 0).getTime() - new Date(bDate || 0).getTime()
                        })
                        .slice(0, 10)
                        .map((s) => {
                          const tenantName = s.tenant?.business_name || tenantById.get(s.tenant_id)?.business_name || s.tenant_id
                          const plan = planById.get(s.plan_id)
                          const renewalDate = resolveSubscriptionRenewalDate(s, plan)
                          const end = renewalDate ? new Date(renewalDate) : null
                          const diffDays = end ? Math.floor((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 0
                          const severity = diffDays < 0 ? 'Expired' : diffDays === 0 ? 'Expires today' : `Expires in ${diffDays}d`
                          return (
                            <div key={s.id} className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-white">{tenantName}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadgeClass(diffDays < 0 ? 'expired' : 'pending')}`}>{severity}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-400">Plan: {s.plan?.name || plan?.name || s.plan_id}</p>
                            </div>
                          )
                        })}
                    </div>
                  </Card>
                </div>

                {createSubscriptionOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <Card className="max-h-[90vh] w-full max-w-6xl overflow-y-auto p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-white">Assign Plan</h3>
                          <p className="text-sm text-slate-400">Create a new tenant subscription assignment.</p>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => setCreateSubscriptionOpen(false)}>Close</Btn>
                      </div>
                      <Card className="p-5">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Assign Plan</p>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Tenant</label>
                      <Sel value={newAssignment.tenantId} onChange={(event) => setNewAssignment((state) => ({ ...state, tenantId: event.target.value }))}>
                        <option value="">Select tenant</option>
                        {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.business_name || tenant.tenant_code || tenant.id}</option>)}
                      </Sel>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Plan Type</label>
                      <Sel value={newAssignment.planId} onChange={(event) => {
                        const selectedPlan = planById.get(event.target.value)
                        const start = formatDateTimeInput(new Date().toISOString())
                        setNewAssignment((state) => ({
                          ...state,
                          planId: event.target.value,
                          currentPeriodStart: start,
                          currentPeriodEnd: addDaysInput(start, inferPlanDays(selectedPlan)),
                          trialEndsAt: inferPlanDays(selectedPlan) <= 7 ? addDaysInput(start, inferPlanDays(selectedPlan)) : '',
                          status: inferPlanDays(selectedPlan) <= 7 ? 'trialing' : 'active',
                        }))
                      }}>
                        <option value="">Select plan</option>
                        {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.plan_code})</option>)}
                      </Sel>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Status</label>
                      <Sel value={newAssignment.status} onChange={(event) => setNewAssignment((state) => ({ ...state, status: event.target.value as SubscriptionStatus }))}>
                        <option value="trialing">Trialing</option>
                        <option value="active">Active</option>
                        <option value="past_due">Past Due</option>
                        <option value="canceled">Canceled</option>
                        <option value="expired">Expired</option>
                        <option value="hold">Hold (disable storefront)</option>
                        <option value="deactivate">Deactivate</option>
                      </Sel>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Start Date</label>
                      <Inp value={newAssignment.currentPeriodStart} onChange={(event) => setNewAssignment((state) => ({ ...state, currentPeriodStart: event.target.value }))} type="datetime-local" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Expiry Date</label>
                      <Inp value={newAssignment.currentPeriodEnd} onChange={(event) => setNewAssignment((state) => ({ ...state, currentPeriodEnd: event.target.value }))} type="datetime-local" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Trial Ends (optional)</label>
                      <Inp value={newAssignment.trialEndsAt} onChange={(event) => setNewAssignment((state) => ({ ...state, trialEndsAt: event.target.value }))} type="datetime-local" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Canceled At (optional)</label>
                      <Inp value={newAssignment.canceledAt} onChange={(event) => setNewAssignment((state) => ({ ...state, canceledAt: event.target.value }))} type="datetime-local" />
                    </div>
                          <label className="mt-2 flex items-center gap-2 text-sm text-slate-300 md:col-span-2 xl:col-span-3">
                            <input type="checkbox" checked={newAssignment.dashboardLock} onChange={(event) => setNewAssignment((state) => ({ ...state, dashboardLock: event.target.checked }))} />
                            LOCK_DASHBOARD (store admin login disabled)
                          </label>
                        </div>
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          <Txt rows={7} value={newAssignment.featureOverridesText} onChange={(event) => setNewAssignment((state) => ({ ...state, featureOverridesText: event.target.value }))} placeholder="Feature overrides JSON (store-specific)" />
                          <Txt rows={7} value={newAssignment.limitOverridesText} onChange={(event) => setNewAssignment((state) => ({ ...state, limitOverridesText: event.target.value }))} placeholder="Limit overrides JSON (store-specific)" />
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Tenant feature overrides</p>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {FEATURE_DEFINITIONS.map((feature) => (
                              <label key={feature.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={isFeatureEnabled(newAssignment.featureOverridesText, feature.key)}
                                  onChange={(event) => setNewAssignment((state) => ({
                                    ...state,
                                    featureOverridesText: setFeatureEnabled(state.featureOverridesText, feature.key, event.target.checked),
                                  }))}
                                />
                                {feature.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      </Card>
                      <div className="mt-4 flex gap-2">
                        <Btn onClick={() => runAction(async () => { await createSubscription(); setCreateSubscriptionOpen(false) }, 'Subscription assigned successfully.')}>Assign Plan</Btn>
                        <Btn variant="ghost" onClick={() => setCreateSubscriptionOpen(false)}>Cancel</Btn>
                      </div>
                    </Card>
                  </div>
                )}

                <Card className="mt-6 p-5">
                  <SectionHeader title="Subscription Records" subtitle="Compact record list with row actions." />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-3">Tenant</th>
                          <th className="px-3 py-3">Plan</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Renewal</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((subscription) => {
                          const tenant = tenantById.get(subscription.tenant_id)
                          const plan = planById.get(subscription.plan_id)
                          const resolvedPlanName = subscription.plan?.name || plan?.name || subscription.plan_id
                          const renewalDate = resolveSubscriptionRenewalDate(subscription, plan)
                          return (
                            <tr key={subscription.id} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-3 py-3">
                                <p className="font-semibold text-slate-900">{subscription.tenant?.business_name || tenant?.business_name || tenant?.tenant_code || subscription.tenant_id}</p>
                                <p className="text-xs text-slate-500">{subscription.tenant?.whatsapp_number || tenant?.whatsapp_number || 'No phone'}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-700">{resolvedPlanName}</td>
                              <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(String(subscription.status || 'active'))}`}>{titleize(String(subscription.status || 'active'))}</span></td>
                              <td className="px-3 py-3 text-slate-700">{formatDate(renewalDate)}</td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <Btn size="sm" variant="ghost" onClick={() => openSubscriptionModal(subscription, 'view')}>View</Btn>
                                  <Btn size="sm" onClick={() => openSubscriptionModal(subscription, 'edit')}>Edit</Btn>
                                  <Btn size="sm" variant="danger" onClick={() => runDeleteAction(() => deleteSubscription(subscription.id), 'Subscription deleted successfully.', `subscription ${subscription.id}`)}>Delete</Btn>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {subscriptions.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No subscriptions assigned yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {subscriptionModalId && (() => {
                  const subscription = subscriptions.find((row) => row.id === subscriptionModalId)
                  if (!subscription) return null
                    const draft = subscriptionDrafts[subscription.id] || buildSubscriptionDraft(subscription)
                    const featureOverridesText = draft.featureOverridesText || JSON.stringify(subscription.feature_overrides || {}, null, 2)
                    const limitOverridesText = draft.limitOverridesText || JSON.stringify(subscription.limit_overrides || {}, null, 2)
                    const selectedPlanValue = draft.planId || subscription.plan_id || ''
                    const selectedPlanExists = selectedPlanValue ? plans.some((planRow) => planRow.id === selectedPlanValue) : false
                    const startDateValue = draft.currentPeriodStart || formatDateTimeInput(subscription.current_period_start || subscription.created_at || null)
                    const endDateValue = draft.currentPeriodEnd || formatDateTimeInput(subscription.current_period_end || subscription.trial_ends_at || null)
                    const tenant = tenantById.get(subscription.tenant_id)
                    const plan = planById.get(subscription.plan_id)
                    const resolvedPlanName = subscription.plan?.name || plan?.name || subscription.plan_id
                    const resolvedPlanCode = subscription.plan?.plan_code || plan?.plan_code || ''
                    const fallbackPlanDays = inferPlanDays(plan) || inferBillingCycleDays(subscription.plan?.billing_cycle)
                    const renewalDateValue = draft.currentPeriodEnd || resolveSubscriptionRenewalDate(subscription, plan)
                    const derivedEndDateValue = startDateValue ? addDaysInput(startDateValue, fallbackPlanDays) : ''
                    const tenantStats = platformStats?.revenueByTenant.find((row) => row.tenantId === subscription.tenant_id)
                  const isEditMode = subscriptionModalMode === 'edit'
                    return (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <Card className="max-h-[90vh] w-full max-w-6xl overflow-y-auto p-5">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-white">{subscription.tenant?.business_name || tenant?.business_name || tenant?.tenant_code || subscription.tenant_id}</h3>
                            <p className="text-xs text-slate-500">{resolvedPlanName}{resolvedPlanCode ? ` (${resolvedPlanCode})` : ''}</p>
                            <p className="mt-1 text-xs text-slate-500">{subscription.tenant?.whatsapp_number || tenant?.whatsapp_number || 'No phone'} · {subscription.tenant?.currency || tenant?.currency || 'INR'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {isEditMode && <Btn size="sm" onClick={() => runAction(async () => { await updateSubscription(subscription.id); setSubscriptionModalId(null) }, 'Subscription updated successfully.')}>Save</Btn>}
                            {!isEditMode && <Btn size="sm" onClick={() => setSubscriptionModalMode('edit')}>Edit</Btn>}
                            <Btn size="sm" variant="ghost" onClick={() => setSubscriptionModalId(null)}>Close</Btn>
                            <Btn size="sm" variant="danger" onClick={() => runDeleteAction(async () => { await deleteSubscription(subscription.id); setSubscriptionModalId(null) }, 'Subscription deleted successfully.', `subscription ${subscription.id}`)}>Delete</Btn>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Plan Type</label>
                            <Sel disabled={!isEditMode} value={selectedPlanValue} onChange={(event) => {
                              const selectedPlan = planById.get(event.target.value)
                              const start = draft?.currentPeriodStart || formatDateTimeInput(new Date().toISOString())
                              setSubscriptionDrafts((state) => ({
                                ...state,
                                [subscription.id]: {
                                  ...state[subscription.id],
                                  planId: event.target.value,
                                  currentPeriodStart: start,
                                  currentPeriodEnd: addDaysInput(start, inferPlanDays(selectedPlan)),
                                  trialEndsAt: inferPlanDays(selectedPlan) <= 7 ? addDaysInput(start, inferPlanDays(selectedPlan)) : state[subscription.id]?.trialEndsAt || '',
                                },
                              }))
                            }}>
                              <option value="">Select plan</option>
                              {!selectedPlanExists && selectedPlanValue && <option value={selectedPlanValue}>Current plan ({selectedPlanValue})</option>}
                              {plans.map((planRow) => <option key={planRow.id} value={planRow.id}>{planRow.name} ({planRow.plan_code})</option>)}
                            </Sel>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Status</label>
                            <Sel disabled={!isEditMode} value={draft?.status || subscription.status || 'active'} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], status: event.target.value as SubscriptionStatus | 'hold' | 'deactivate' } }))}>
                              <option value="trialing">Trialing</option>
                              <option value="active">Active</option>
                              <option value="past_due">Past Due</option>
                              <option value="canceled">Canceled</option>
                              <option value="expired">Expired</option>
                              <option value="hold">Hold (disable storefront)</option>
                              <option value="deactivate">Deactivate</option>
                            </Sel>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Start Date</label>
                            <Inp readOnly={!isEditMode} value={startDateValue} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], currentPeriodStart: event.target.value } }))} type="datetime-local" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Expiry Date</label>
                            <Inp readOnly={!isEditMode} value={endDateValue || derivedEndDateValue} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], currentPeriodEnd: event.target.value } }))} type="datetime-local" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Trial Ends</label>
                            <Inp readOnly={!isEditMode} value={draft.trialEndsAt || formatDateTimeInput(subscription.trial_ends_at)} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], trialEndsAt: event.target.value } }))} type="datetime-local" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Canceled At</label>
                            <Inp readOnly={!isEditMode} value={draft.canceledAt || formatDateTimeInput(subscription.canceled_at)} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], canceledAt: event.target.value } }))} type="datetime-local" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Provider</label>
                            <Inp readOnly={!isEditMode} value={draft.provider || ''} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], provider: event.target.value } }))} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Provider Customer ID</label>
                            <Inp readOnly={!isEditMode} value={draft.providerCustomerId || ''} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], providerCustomerId: event.target.value } }))} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Provider Subscription ID</label>
                            <Inp readOnly={!isEditMode} value={draft.providerSubscriptionId || ''} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], providerSubscriptionId: event.target.value } }))} />
                          </div>
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                          <input disabled={!isEditMode} type="checkbox" checked={Boolean(draft.dashboardLock)} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], dashboardLock: event.target.checked } }))} />
                          LOCK_DASHBOARD (disable tenant dashboard login)
                        </label>
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          <Txt disabled={!isEditMode} rows={7} value={featureOverridesText} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], featureOverridesText: event.target.value } }))} placeholder="Feature overrides JSON" />
                          <Txt disabled={!isEditMode} rows={7} value={limitOverridesText} onChange={(event) => setSubscriptionDrafts((state) => ({ ...state, [subscription.id]: { ...state[subscription.id], limitOverridesText: event.target.value } }))} placeholder="Limit overrides JSON" />
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Tenant feature overrides</p>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {FEATURE_DEFINITIONS.map((feature) => (
                              <label key={feature.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700">
                                <input
                                  disabled={!isEditMode}
                                  type="checkbox"
                                  checked={isFeatureEnabled(featureOverridesText, feature.key)}
                                  onChange={(event) => setSubscriptionDrafts((state) => ({
                                    ...state,
                                    [subscription.id]: {
                                      ...state[subscription.id],
                                      featureOverridesText: setFeatureEnabled(state[subscription.id]?.featureOverridesText || featureOverridesText, feature.key, event.target.checked),
                                    },
                                  }))}
                                />
                                {feature.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-xl border border-cyan-300/25 bg-slate-900/70 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200">Tenant Code</p>
                            <p className="mt-1 text-sm font-semibold text-white">{subscription.tenant?.tenant_code || tenant?.tenant_code || '-'}</p>
                            <p className="mt-1 text-xs text-slate-500">{subscription.tenant_id}</p>
                          </div>
                          <div className="rounded-xl border border-emerald-300/25 bg-slate-900/70 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">Tenant Sales</p>
                            <p className="mt-1 text-sm font-semibold text-white">{formatMoney(tenantStats?.totalRevenue || 0, subscription.tenant?.currency || tenant?.currency || 'INR')}</p>
                            <p className="mt-1 text-xs text-slate-500">Orders: {tenantStats?.totalOrders || 0}</p>
                          </div>
                          <div className="rounded-xl border border-amber-300/25 bg-slate-900/70 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200">Subscription Health</p>
                            <p className="mt-1"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(String(draft?.status || subscription.status || 'active'))}`}>{titleize(String(draft?.status || subscription.status || 'active'))}</span></p>
                            <p className="mt-2 text-xs text-slate-300">Renews: {formatDate(renewalDateValue)}</p>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-slate-600">Renewal: {formatDate(renewalDateValue)} · Trial ends: {formatDate(draft?.trialEndsAt || subscription.trial_ends_at)}</div>
                        <div className="mt-1 text-xs text-slate-500">Access Mode: {String(subscription.store_access_mode || 'ACTIVE')} · Dashboard: {String(subscription.dashboard_access || 'UNLOCKED')}</div>
                        <div className="mt-1 text-xs text-slate-500">Subscription ID: {subscription.id} · Created: {formatDate(subscription.created_at)} · Updated: {formatDate(subscription.updated_at)}</div>
                        </Card>
                      </div>
                    )
                  })()}
              </div>
            )}

            {section === 'comms' && (
              <div>
                <SectionHeader title="Send Comms" subtitle="List first. Open each communication via row actions." action={<Btn onClick={() => setCreateCommOpen(true)}>Create Comm</Btn>} />

                <Card className="p-5">
                  <SectionHeader title="Communication Records" subtitle="Nearby actions for view, expire, and delete." />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-3">Title</th>
                          <th className="px-3 py-3">Target</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Schedule</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comms.map((comm) => (
                          <tr key={comm.id} className="border-b border-slate-50 last:border-b-0">
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-900">{comm.title}</p>
                              <p className="max-w-[360px] truncate text-xs text-slate-500">{comm.body}</p>
                            </td>
                            <td className="px-3 py-3 text-slate-700">{comm.target_tenant_id ? `Client: ${comm.target_tenant_id}` : 'All clients'}</td>
                            <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(comm.status)}`}>{titleize(comm.status)}</span></td>
                            <td className="px-3 py-3 text-slate-700">{formatDate(comm.start_at)} to {formatDate(comm.end_at)}</td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Btn size="sm" variant="ghost" onClick={() => { setCommModalMode('view'); setCommModalId(comm.id) }}>View</Btn>
                                <Btn size="sm" onClick={() => { setCommModalMode('edit'); setCommModalId(comm.id) }}>Edit</Btn>
                                <Btn size="sm" onClick={() => runAction(() => updateComm(comm.id, { status: 'expired' }), 'Communication expired.')}>Expire</Btn>
                                <Btn size="sm" variant="danger" onClick={() => runDeleteAction(() => deleteComm(comm.id), 'Communication deleted.', comm.title || 'this communication')}>Delete</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {comms.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No communications yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {createCommOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-white">Create Communication</h3>
                          <p className="text-sm text-slate-400">Broadcast to all clients or a specific client.</p>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => setCreateCommOpen(false)}>Close</Btn>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Inp value={newComm.title} onChange={(event) => setNewComm((state) => ({ ...state, title: event.target.value }))} placeholder="Message title" />
                        <Sel value={newComm.targetTenantId} onChange={(event) => setNewComm((state) => ({ ...state, targetTenantId: event.target.value }))}>
                          <option value="">All clients</option>
                          {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.business_name || tenant.tenant_code || tenant.id}</option>)}
                        </Sel>
                        <Sel value={newComm.status} onChange={(event) => setNewComm((state) => ({ ...state, status: event.target.value as PlatformCommRow['status'] }))}>
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="expired">Expired</option>
                          <option value="deleted">Deleted</option>
                        </Sel>
                      </div>
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        <Txt rows={6} value={newComm.body} onChange={(event) => setNewComm((state) => ({ ...state, body: event.target.value }))} placeholder="Popup message body" />
                        <div className="space-y-3">
                          <Inp value={newComm.imageUrl} onChange={(event) => setNewComm((state) => ({ ...state, imageUrl: event.target.value }))} placeholder="Image URL (optional)" />
                          <Inp value={newComm.startAt} onChange={(event) => setNewComm((state) => ({ ...state, startAt: event.target.value }))} type="datetime-local" />
                          <Inp value={newComm.endAt} onChange={(event) => setNewComm((state) => ({ ...state, endAt: event.target.value }))} type="datetime-local" />
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Btn onClick={() => runAction(async () => { await createComm(); setCreateCommOpen(false) }, 'Communication created successfully.')}>Create Comm</Btn>
                        <Btn variant="ghost" onClick={() => setCreateCommOpen(false)}>Cancel</Btn>
                      </div>
                    </Card>
                  </div>
                )}

                {commModalId && (() => {
                  const comm = comms.find((row) => row.id === commModalId)
                  if (!comm) return null
                  const draft = commDrafts[comm.id]
                  const isEditMode = commModalMode === 'edit'
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                      <Card className="max-h-[90vh] w-full max-w-4xl overflow-y-auto p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-white">{comm.title}</h3>
                            <p className="mt-1 text-xs text-slate-500">{comm.target_tenant_id ? `Client: ${comm.target_tenant_id}` : 'All clients'} · {comm.status}</p>
                          </div>
                          <Btn size="sm" variant="ghost" onClick={() => setCommModalId(null)}>Close</Btn>
                        </div>
                        {isEditMode ? (
                          <div className="space-y-3">
                            <Inp value={draft?.title || ''} onChange={(event) => setCommDrafts((state) => ({ ...state, [comm.id]: { ...state[comm.id], title: event.target.value } }))} placeholder="Title" />
                            <Txt rows={5} value={draft?.body || ''} onChange={(event) => setCommDrafts((state) => ({ ...state, [comm.id]: { ...state[comm.id], body: event.target.value } }))} placeholder="Body" />
                            <div className="grid gap-3 md:grid-cols-2">
                              <Inp value={draft?.startAt || ''} onChange={(event) => setCommDrafts((state) => ({ ...state, [comm.id]: { ...state[comm.id], startAt: event.target.value } }))} type="datetime-local" />
                              <Inp value={draft?.endAt || ''} onChange={(event) => setCommDrafts((state) => ({ ...state, [comm.id]: { ...state[comm.id], endAt: event.target.value } }))} type="datetime-local" />
                            </div>
                            <Inp value={draft?.imageUrl || ''} onChange={(event) => setCommDrafts((state) => ({ ...state, [comm.id]: { ...state[comm.id], imageUrl: event.target.value } }))} placeholder="Image URL" />
                            <Sel value={draft?.status || 'active'} onChange={(event) => setCommDrafts((state) => ({ ...state, [comm.id]: { ...state[comm.id], status: event.target.value as PlatformCommRow['status'] } }))}>
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="scheduled">Scheduled</option>
                              <option value="expired">Expired</option>
                              <option value="deleted">Deleted</option>
                            </Sel>
                            <Sel value={draft?.targetTenantId || ''} onChange={(event) => setCommDrafts((state) => ({ ...state, [comm.id]: { ...state[comm.id], targetTenantId: event.target.value } }))}>
                              <option value="">All clients</option>
                              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.business_name || tenant.tenant_code || tenant.id}</option>)}
                            </Sel>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-slate-200">{comm.body}</p>
                            {comm.image_url && <p className="mt-2 text-xs text-cyan-300 break-all">Image: {comm.image_url}</p>}
                            <p className="mt-2 text-xs text-slate-500">Start: {formatDate(comm.start_at)} · End: {formatDate(comm.end_at)}</p>
                          </>
                        )}
                        <div className="mt-4 flex gap-2">
                          {isEditMode && <Btn onClick={() => runAction(async () => { await updateCommFromDraft(comm.id); setCommModalId(null) }, 'Communication updated.')}>Save</Btn>}
                          {!isEditMode && <Btn onClick={() => setCommModalMode('edit')}>Edit</Btn>}
                          <Btn onClick={() => runAction(() => updateComm(comm.id, { status: 'expired' }), 'Communication expired.')}>Expire</Btn>
                          <Btn variant="danger" onClick={() => runDeleteAction(async () => { await deleteComm(comm.id); setCommModalId(null) }, 'Communication deleted.', comm.title || 'this communication')}>Delete</Btn>
                        </div>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            )}

            {section === 'paymentHistory' && (
              <div>
                <SectionHeader title="Payment History" subtitle="Client payment ledger with status updates, records, and receipt downloads." action={<Btn onClick={() => setCreatePaymentOpen(true)}>Create Payment Record</Btn>} />

                {paymentTableMissing && (
                  <Card className="mb-4 p-4">
                    <p className="text-sm text-amber-200">Payment ledger table is missing. Run latest migration to enable payment history and receipts.</p>
                  </Card>
                )}

                <Card className="mb-6 p-5">
                  <SectionHeader title="Payment Dashboard" subtitle="Quick payment KPIs for platform collections." />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Paid Revenue" value={formatMoney(platformStats?.totalPaidRevenue || 0)} sub="Collected from clients" />
                    <StatCard label="Paid Records" value={platformStats?.totalPaidRecords || 0} sub="Successful entries" />
                    <StatCard label="Pending Amount" value={formatMoney(platformStats?.totalPendingAmount || 0)} sub="Awaiting settlement" />
                    <StatCard label="Clients Paid" value={platformStats?.clientsWithPaidRevenue || 0} sub="Clients with paid ledger" />
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionHeader title="Payment Records" subtitle="List first, then open popup for edit and receipt download." />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-3">Client</th>
                          <th className="px-3 py-3">Amount</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Paid Date</th>
                          <th className="px-3 py-3">Receipt</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-slate-50 last:border-b-0">
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-900">{payment.tenant?.business_name || payment.tenant?.tenant_code || payment.tenant_id}</p>
                              <p className="text-xs text-slate-500">{payment.tenant?.tenant_code || payment.tenant_id}</p>
                            </td>
                            <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(payment.amount || 0, payment.currency || 'INR')}</td>
                            <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(payment.status)}`}>{titleize(payment.status)}</span></td>
                            <td className="px-3 py-3 text-slate-700">{formatDate(payment.payment_date)}</td>
                            <td className="px-3 py-3 text-slate-700">{payment.receipt_number || '-'}</td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Btn size="sm" variant="ghost" onClick={() => { setPaymentModalMode('view'); setPaymentModalId(payment.id) }}>View</Btn>
                                <Btn size="sm" onClick={() => { setPaymentModalMode('edit'); setPaymentModalId(payment.id) }}>Edit</Btn>
                                <Btn size="sm" variant="ghost" onClick={() => downloadPaymentReceipt(payment)}>Download Receipt</Btn>
                                <Btn size="sm" variant="danger" onClick={() => runDeleteAction(() => deletePaymentRecord(payment.id), 'Payment record deleted.', payment.receipt_number || `payment ${payment.id}`)}>Delete</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {payments.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No payment records found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {createPaymentOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-white">Create Payment Record</h3>
                          <p className="text-sm text-slate-400">Store payment details and status for client billing history.</p>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => setCreatePaymentOpen(false)}>Close</Btn>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Client</label>
                          <Sel value={newPayment.tenantId} onChange={(event) => setNewPayment((state) => ({ ...state, tenantId: event.target.value }))}>
                            <option value="">Select client</option>
                            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.business_name || tenant.tenant_code || tenant.id}</option>)}
                          </Sel>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Subscription (optional)</label>
                          <Sel value={newPayment.subscriptionId} onChange={(event) => {
                            const subId = event.target.value
                            const sub = subscriptions.find((s) => s.id === subId)
                            const plan = sub ? planById.get(sub.plan_id) || sub.plan : null
                            const planPrice = Number((plan as any)?.price || 0)
                            setNewPayment((state) => ({
                              ...state,
                              subscriptionId: subId,
                              ...(subId && planPrice > 0 ? { amount: planPrice, currency: (plan as any)?.currency || state.currency } : {}),
                            }))
                          }}>
                            <option value="">No subscription</option>
                            {subscriptions.filter((subscription) => !newPayment.tenantId || subscription.tenant_id === newPayment.tenantId).map((subscription) => {
                              const plan = planById.get(subscription.plan_id) || subscription.plan
                              const label = `${(plan as any)?.name || subscription.id.slice(0, 8)} · ${titleize(subscription.status)}`
                              return <option key={subscription.id} value={subscription.id}>{label}</option>
                            })}
                          </Sel>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Amount</label>
                          <Inp type="text" inputMode="decimal" value={newPayment.amount === 0 ? '' : String(newPayment.amount)} onChange={(event) => { const v = event.target.value.replace(/[^0-9.]/g, ''); setNewPayment((state) => ({ ...state, amount: v === '' ? 0 : Number(v) })) }} placeholder="0" /></div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Currency</label>
                          <Inp value={newPayment.currency} onChange={(event) => setNewPayment((state) => ({ ...state, currency: event.target.value }))} placeholder="INR" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Status</label>
                          <Sel value={newPayment.status} onChange={(event) => setNewPayment((state) => ({ ...state, status: event.target.value as PlatformPaymentRow['status'] }))}>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                          </Sel>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Method</label>
                          <Inp value={newPayment.method} onChange={(event) => setNewPayment((state) => ({ ...state, method: event.target.value }))} placeholder="bank_transfer / UPI" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Reference</label>
                          <Inp value={newPayment.reference} onChange={(event) => setNewPayment((state) => ({ ...state, reference: event.target.value }))} placeholder="UTR / txn id" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Receipt Number</label>
                          <Inp value={newPayment.receiptNumber} onChange={(event) => setNewPayment((state) => ({ ...state, receiptNumber: event.target.value }))} placeholder="RCPT-2026-001" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Paid Date</label>
                          <Inp type="datetime-local" value={newPayment.paidAt} onChange={(event) => setNewPayment((state) => ({ ...state, paidAt: event.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Due Date</label>
                          <Inp type="datetime-local" value={newPayment.dueDate} onChange={(event) => setNewPayment((state) => ({ ...state, dueDate: event.target.value }))} />
                        </div>
                        <div className="md:col-span-2 xl:col-span-2">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</label>
                          <Txt rows={3} value={newPayment.notes} onChange={(event) => setNewPayment((state) => ({ ...state, notes: event.target.value }))} placeholder="Optional notes for customer or finance team" />
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Btn onClick={() => runAction(async () => { await createPaymentRecord(); setCreatePaymentOpen(false) }, 'Payment record created successfully.')}>Create Payment</Btn>
                        <Btn variant="ghost" onClick={() => setCreatePaymentOpen(false)}>Cancel</Btn>
                      </div>
                    </Card>
                  </div>
                )}

                {paymentModalId && (() => {
                  const payment = payments.find((row) => row.id === paymentModalId)
                  if (!payment) return null
                  const draft = paymentDrafts[payment.id]
                  const isEditMode = paymentModalMode === 'edit'
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                      <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-white">{isEditMode ? 'Edit Payment Record' : 'View Payment Record'}</h3>
                            <p className="text-sm text-slate-400">{payment.receipt_number || payment.id}</p>
                          </div>
                          <Btn size="sm" variant="ghost" onClick={() => setPaymentModalId(null)}>Close</Btn>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <Sel disabled={!isEditMode} value={draft?.tenantId || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], tenantId: event.target.value } }))}>
                            <option value="">Select client</option>
                            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.business_name || tenant.tenant_code || tenant.id}</option>)}
                          </Sel>
                          <Sel disabled={!isEditMode} value={draft?.subscriptionId || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], subscriptionId: event.target.value } }))}>
                            <option value="">No subscription</option>
                            {subscriptions.filter((subscription) => !draft?.tenantId || subscription.tenant_id === draft.tenantId).map((subscription) => <option key={subscription.id} value={subscription.id}>{subscription.id.slice(0, 8)} · {titleize(subscription.status)}</option>)}
                          </Sel>
                          <Inp readOnly={!isEditMode} type="number" value={draft?.amount || 0} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], amount: Number(event.target.value || 0) } }))} />
                          <Inp readOnly={!isEditMode} value={draft?.currency || 'INR'} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], currency: event.target.value } }))} />
                          <Sel disabled={!isEditMode} value={draft?.status || 'pending'} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], status: event.target.value as PlatformPaymentRow['status'] } }))}>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                          </Sel>
                          <Inp readOnly={!isEditMode} value={draft?.method || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], method: event.target.value } }))} placeholder="bank_transfer / UPI" />
                          <Inp readOnly={!isEditMode} value={draft?.reference || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], reference: event.target.value } }))} placeholder="UTR / txn id" />
                          <Inp readOnly={!isEditMode} value={draft?.receiptNumber || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], receiptNumber: event.target.value } }))} placeholder="Receipt number" />
                          <Inp readOnly={!isEditMode} type="datetime-local" value={draft?.paidAt || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], paidAt: event.target.value } }))} />
                          <Inp readOnly={!isEditMode} type="datetime-local" value={draft?.dueDate || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], dueDate: event.target.value } }))} />
                          <div className="md:col-span-2 xl:col-span-2">
                            <Txt disabled={!isEditMode} rows={3} value={draft?.notes || ''} onChange={(event) => setPaymentDrafts((state) => ({ ...state, [payment.id]: { ...state[payment.id], notes: event.target.value } }))} placeholder="Notes" />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {isEditMode && <Btn onClick={() => runAction(async () => { await updatePaymentRecord(payment.id); setPaymentModalId(null) }, 'Payment record updated successfully.')}>Save Changes</Btn>}
                          {!isEditMode && <Btn onClick={() => setPaymentModalMode('edit')}>Edit</Btn>}
                          <Btn variant="ghost" onClick={() => downloadPaymentReceipt(payment)}>Download Receipt</Btn>
                          <Btn variant="danger" onClick={() => runDeleteAction(async () => { await deletePaymentRecord(payment.id); setPaymentModalId(null) }, 'Payment record deleted.', payment.receipt_number || `payment ${payment.id}`)}>Delete</Btn>
                        </div>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            )}

            {section === 'support' && (
              <div>
                <SectionHeader title="Support Tickets" subtitle="List first with nearby actions and popup workflow." />
                <Card className="mb-4 p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Inp value={supportSearch} onChange={(event) => setSupportSearch(event.target.value)} placeholder="Search subject/client/ticket id" />
                    <Sel value={supportFilterStatus} onChange={(event) => setSupportFilterStatus(event.target.value)}>
                      <option value="all">All Statuses</option>
                      <option value="created">Created</option>
                      <option value="work_in_progress">Work in Progress</option>
                      <option value="pending">Pending</option>
                      <option value="need_more_info">Need More Info</option>
                      <option value="review_with_user">Review With User</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </Sel>
                    <Sel value={supportFilterPriority} onChange={(event) => setSupportFilterPriority(event.target.value)}>
                      <option value="all">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Sel>
                    <Sel value={supportFilterTenant} onChange={(event) => setSupportFilterTenant(event.target.value)}>
                      <option value="all">All Tenants</option>
                      {Array.from(new Set(supportTickets.map((t) => String(t.tenant_id || '')))).map((tenantId) => {
                        const tenant = tenants.find((tt) => tt.id === tenantId)
                        return <option key={tenantId} value={tenantId}>{tenant?.business_name || tenant?.tenant_code || tenantId}</option>
                      })}
                    </Sel>
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionHeader title="Ticket Records" subtitle="Open full ticket details in popup." />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-3">Ticket</th>
                          <th className="px-3 py-3">Tenant</th>
                          <th className="px-3 py-3">Priority</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supportTickets
                          .filter((ticket) => {
                            const hay = `${ticket.subject} ${ticket.description} ${ticket.sid || ''} ${ticket.tenant?.business_name || ''} ${ticket.tenant?.tenant_code || ''}`.toLowerCase()
                            const matchSearch = !supportSearch || hay.includes(supportSearch.toLowerCase())
                            const matchStatus = supportFilterStatus === 'all' || ticket.status === supportFilterStatus
                            const matchPriority = supportFilterPriority === 'all' || ticket.priority === supportFilterPriority
                            const matchTenant = supportFilterTenant === 'all' || ticket.tenant_id === supportFilterTenant
                            return matchSearch && matchStatus && matchPriority && matchTenant
                          })
                          .map((ticket) => (
                            <tr key={ticket.id} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-3 py-3">
                                <p className="font-semibold text-slate-900">{ticket.subject}</p>
                                <p className="text-xs text-slate-500">{ticket.sid || ticket.id}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-700">{ticket.tenant?.business_name || ticket.tenant?.tenant_code || ticket.tenant_id}</td>
                              <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(ticket.priority)}`}>{titleize(ticket.priority)}</span></td>
                              <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(ticket.status)}`}>{titleize(ticket.status)}</span></td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <Btn size="sm" variant="ghost" onClick={() => setSupportModalId(ticket.id)}>View</Btn>
                                  <Btn size="sm" onClick={() => runAction(() => updateSupportTicket(ticket.id, ticket.status === 'resolved' ? 'work_in_progress' : 'resolved', ticket.assigned_to_user_id || null), 'Support ticket updated.')}>{ticket.status === 'resolved' ? 'Reopen' : 'Resolve'}</Btn>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {supportTickets.filter((ticket) => {
                          const hay = `${ticket.subject} ${ticket.description} ${ticket.sid || ''} ${ticket.tenant?.business_name || ''} ${ticket.tenant?.tenant_code || ''}`.toLowerCase()
                          const matchSearch = !supportSearch || hay.includes(supportSearch.toLowerCase())
                          const matchStatus = supportFilterStatus === 'all' || ticket.status === supportFilterStatus
                          const matchPriority = supportFilterPriority === 'all' || ticket.priority === supportFilterPriority
                          const matchTenant = supportFilterTenant === 'all' || ticket.tenant_id === supportFilterTenant
                          return matchSearch && matchStatus && matchPriority && matchTenant
                        }).length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No support tickets found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {supportModalId && (() => {
                  const ticket = supportTickets.find((row) => row.id === supportModalId)
                  if (!ticket) return null
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                      <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5">
                        {(() => {
                          const sla = ticketSla(ticket)
                          return (
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300">Age: {sla.ageHrs ?? 0}h</span>
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300">Last response: {sla.lastResponseHrs ?? 0}h ago</span>
                              {sla.overdue && <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-300">Overdue</span>}
                            </div>
                          )
                        })()}

                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-white">{ticket.subject}</h3>
                            <p className="text-xs text-slate-400">{ticket.description}</p>
                            <p className="mt-1 text-xs text-slate-500">{ticket.sid || ticket.id} · {ticket.tenant?.business_name || ticket.tenant?.tenant_code || ticket.tenant_id}</p>
                            <p className="mt-1 text-xs text-slate-500">Tenant ID: {ticket.tenant_id}</p>
                            <p className="mt-1 text-xs text-slate-500">Created By User: {ticket.created_by_user_id || '-'}</p>
                            <p className="mt-1 text-xs text-slate-500">Created: {formatDate(ticket.created_at)} · Updated: {formatDate(ticket.updated_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(ticket.priority)}`}>{titleize(ticket.priority)}</span>
                            <Sel value={ticket.status} onChange={(event) => runAction(() => updateSupportTicket(ticket.id, event.target.value, ticket.assigned_to_user_id || null), 'Support ticket updated.') }>
                              <option value="created">Created</option>
                              <option value="work_in_progress">Work in Progress</option>
                              <option value="pending">Pending</option>
                              <option value="need_more_info">Need More Info</option>
                              <option value="review_with_user">Review With User</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </Sel>
                            <Btn size="sm" variant="ghost" onClick={() => setSupportModalId(null)}>Close</Btn>
                          </div>
                        </div>

                        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                          <Inp
                            value={ticket.assigned_to_user_id || ''}
                            onChange={(event) => {
                              const value = event.target.value
                              setSupportTickets((state) => state.map((row) => row.id === ticket.id ? { ...row, assigned_to_user_id: value } : row))
                            }}
                            placeholder="Assigned To User ID"
                          />
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() => runAction(() => updateSupportTicket(ticket.id, ticket.status, ticket.assigned_to_user_id || null), 'Ticket assignment updated.')}
                          >
                            Save Assignee
                          </Btn>
                        </div>

                        {ticket.comments_unavailable && (
                          <p className="mb-3 text-xs text-amber-300">Comments table is missing. Run latest migration to enable threaded responses.</p>
                        )}

                        <div className="space-y-2">
                          {(ticket.comments || []).slice(0, 8).map((comment) => (
                            <div key={comment.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                              <span className="font-semibold text-white">{comment.author_type === 'platform' ? 'Platform' : 'Client'}:</span> {comment.comment}
                              <span className="ml-2 text-slate-500">{formatDate(comment.created_at)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Inp value={supportCommentDrafts[ticket.id] || ''} onChange={(event) => setSupportCommentDrafts((state) => ({ ...state, [ticket.id]: event.target.value }))} placeholder="Add platform response..." />
                          <Btn size="sm" onClick={() => runAction(() => addSupportComment(ticket.id), 'Comment added to ticket.')}>Reply</Btn>
                        </div>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </main>

        {deleteConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
            <Card className="w-full max-w-md p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirm Deletion</h3>
                  <p className="mt-1 text-sm text-slate-300">Delete {deleteConfirm.entityLabel} permanently?</p>
                  <p className="mt-1 text-xs text-rose-200">This action cannot be undone.</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Btn variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={saving}>Cancel</Btn>
                <Btn variant="danger" onClick={() => confirmDeleteAction()} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Btn>
              </div>
            </Card>
          </div>
        )}
      </div>

      <footer className="mx-3 mb-3 flex shrink-0 flex-col items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-[11px] text-slate-600 backdrop-blur-2xl sm:flex-row">
        <p>ImiqX Platform Admin · Powered by <span className="font-semibold text-accent">ImiqX</span></p>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">Global Admin Console</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">Secure session</span>
        </div>
      </footer>
    </div>
  )
}
