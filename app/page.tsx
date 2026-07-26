import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, BadgeCheck, BarChart3, CheckCircle2, Crown, MessageCircle, Package2, ShieldCheck, Sparkles, Store, Truck, Users } from 'lucide-react'
import SalesEnquiryForm from '../components/landing/SalesEnquiryForm'
import PlatformHeader from '../components/landing/PlatformHeader'
import PlatformFooter from '../components/landing/PlatformFooter'
import { listTenantClients } from '../lib/tenantDb'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'

export const metadata: Metadata = {
  title: 'ImiqX | Online Store Builder India',
  description: 'Build a polished online store in minutes. Sell via WhatsApp, manage products, and grow with a mobile-first commerce OS.',
  keywords: ['online store builder India', 'WhatsApp store', 'sell on WhatsApp', 'ecommerce India', 'small business store'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'ImiqX | Online Store Builder India',
    description: 'Create a storefront, accept WhatsApp orders, and manage your business from one place.',
    url: '/',
    siteName: 'ImiqX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ImiqX | Online Store Builder India',
    description: 'Create a storefront, accept WhatsApp orders, and manage your business from one place.',
  },
}

const HERO_STATS = [
  { label: '5 minutes', value: 'Launch fast' },
  { label: 'Zero friction', value: 'WhatsApp checkout' },
  { label: 'One dashboard', value: 'Store + orders + leads' },
]

const TRUST_METRICS = [
  { label: 'Zero transaction fees', value: 'Keep more of every order' },
  { label: 'WhatsApp orders', value: 'Customers buy where they chat' },
  { label: 'Live in minutes', value: 'Setup is fast and simple' },
  { label: '₹399/month', value: '7-day free trial available' },
]

const DASHBOARD_STEPS = ['Your store', 'Order on WhatsApp', 'You manage']

const MARKET_CARDS = [
  { country: 'India', note: 'Hindi + English support', metric: '853.8M chat users' },
  { country: 'Brazil', note: 'Portuguese growth market', metric: '148M chat users' },
  { country: 'Indonesia', note: 'Highly mobile commerce', metric: '112M chat users' },
  { country: 'Mexico', note: 'Strong social selling culture', metric: '85M chat users' },
]

const FALLBACK_CLIENTS = [
  { id: 'demo-1', businessName: 'Mobile Mart India', logoUrl: '', tenantCode: 'mobile-mart-india' },
  { id: 'demo-2', businessName: 'Style Studio', logoUrl: '', tenantCode: 'style-studio' },
  { id: 'demo-3', businessName: 'Fresh Basket', logoUrl: '', tenantCode: 'fresh-basket' },
  { id: 'demo-4', businessName: 'Daily Needs', logoUrl: '', tenantCode: 'daily-needs' },
]

const FEATURE_CARDS = [
  { icon: Store, title: 'Storefront that feels premium', detail: 'Clean product browsing, brand-led sections, and a mobile-first layout built to convert social traffic.' },
  { icon: MessageCircle, title: 'Order on WhatsApp', detail: 'Send customers directly into a pre-filled chat flow so orders feel personal and familiar.' },
  { icon: Package2, title: 'Catalog and inventory', detail: 'Keep products, pricing, stock, and offers organized from one panel across every store.' },
  { icon: BarChart3, title: 'Simple business visibility', detail: 'See what is selling, what needs attention, and where customers are dropping off.' },
  { icon: ShieldCheck, title: 'Trust built in', detail: 'Lightweight, secure, and designed for small businesses that need reliability more than complexity.' },
  { icon: Truck, title: 'Ready for daily operations', detail: 'Handle fulfilment, delivery, and support without switching tools or losing context.' },
]

const PLAN_ACCENTS = [
  'from-[#1d4ed8] to-[#0369a1]',
  'from-[#0f766e] to-[#0891b2]',
  'from-[#ca8a04] to-[#f59e0b]',
  'from-[#7c3aed] to-[#a855f7]',
  'from-[#be185d] to-[#e11d48]',
]

const FALLBACK_PLAN_CARDS = [
  { name: 'Starter', price: '₹399', cycle: '/month', accent: PLAN_ACCENTS[0], points: ['Online store + WhatsApp ordering', 'Core catalog and lead capture', 'Ideal for first-time sellers'] },
  { name: 'Growth', price: '₹499', cycle: '/month', accent: PLAN_ACCENTS[1], points: ['Everything in Starter', 'Coupons, analytics, and extra controls', 'Best for active business teams'] },
]

const FAQS = [
  { question: 'How fast can I go live?', answer: 'Most stores can be launched in a few minutes once the business profile, logo, and product data are ready.' },
  { question: 'Does it work well on mobile?', answer: 'Yes. The homepage and store experience are designed mobile-first so customers can browse and order quickly.' },
  { question: 'Can I use WhatsApp as my main sales channel?', answer: 'Yes. WhatsApp ordering is a core flow, so customers can move from browsing to enquiry without extra friction.' },
  { question: 'Is the pricing fixed?', answer: 'You can start with a low monthly plan or choose the one-time lifetime option depending on your growth stage.' },
]

function initialsFromName(name: string) {
  return String(name || '')
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default async function ImiqxLandingPage() {
  const tenantClients = await listTenantClients(30).catch(() => [])
  const showcaseClients = tenantClients.length > 0 ? tenantClients : FALLBACK_CLIENTS
  const platformWhatsAppNumber = String(
    process.env.PLATFORM_WHATSAPP_NUMBER ||
    process.env.NEXT_PUBLIC_PLATFORM_WHATSAPP_NUMBER ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    process.env.WHATSAPP_NUMBER ||
    '',
  ).replace(/\D/g, '')
  const clientTicker = showcaseClients.length > 0 ? [...showcaseClients, ...showcaseClients] : []

  // Fetch live plans from DB
  let planCards = FALLBACK_PLAN_CARDS
  try {
    const supabase = getSupabaseAdmin()
    const plansRes = await supabase
      .from('subscription_plans')
      .select('id,name,plan_code,billing_cycle,price,currency,features,limits')
      .eq('is_active', true)
      .order('price', { ascending: true })
    if (!plansRes.error && plansRes.data && plansRes.data.length > 0) {
      planCards = plansRes.data.map((plan: any, index: number) => {
        const features = (plan.features && typeof plan.features === 'object' ? plan.features : {}) as Record<string, unknown>
        const limits = (plan.limits && typeof plan.limits === 'object' ? plan.limits : {}) as Record<string, unknown>
        const points: string[] = []
        if (features.trial_days && Number(features.trial_days) > 0) points.push(`${features.trial_days}-day free trial`)
        if (limits.max_products) points.push(`Up to ${limits.max_products} products`)
        if (limits.max_orders) points.push(`Up to ${limits.max_orders} orders/month`)
        if (!points.length) points.push('Online store + WhatsApp ordering')
        const cycle = plan.billing_cycle === 'monthly' ? '/month'
          : plan.billing_cycle === 'quarterly' ? '/quarter'
          : plan.billing_cycle === 'half_yearly' ? '/6 months'
          : plan.billing_cycle === 'yearly' ? '/year'
          : 'one-time'
        const currency = String(plan.currency || 'INR')
        const price = Number(plan.price || 0)
        const priceStr = currency === 'INR' ? `₹${price.toLocaleString('en-IN')}` : `${currency} ${price}`
        return {
          name: plan.name,
          price: priceStr,
          cycle,
          accent: PLAN_ACCENTS[index % PLAN_ACCENTS.length],
          points,
        }
      })
    }
  } catch {
    // fall back to static cards
  }

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#0f172a]">
      <PlatformHeader />

      <main>
        <section id="home" className="relative overflow-hidden border-b border-[#dbe7f5] pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(247,250,252,1))]" />
            <div className="absolute left-[-8rem] top-0 h-72 w-72 rounded-full bg-[#1d4ed8]/10 blur-3xl" />
            <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-[#0f766e]/10 blur-3xl" />
            <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-[#f59e0b]/10 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:items-start lg:gap-10 lg:px-8 lg:py-14 xl:py-16">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c7d7ef] bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#1d4ed8] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <Sparkles className="h-3.5 w-3.5" />
                ImiqX Commerce OS
              </div>

              <h1 className="display-heading mt-4 max-w-3xl text-4xl font-semibold leading-tight text-[#0b1f4d] sm:text-5xl lg:text-5xl xl:text-6xl">
                A beautiful online store for Indian businesses.
                <span className="mt-3 block bg-gradient-to-r from-[#1d4ed8] via-[#0369a1] to-[#0f766e] bg-clip-text text-transparent">
                  Sell through your website, close faster on WhatsApp.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-[#334155] sm:text-lg">
                Build a premium storefront, manage your products, and guide customers to order with confidence.
                The experience stays clean, light, and fast across desktop and mobile.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-[#d7e5f7] bg-white px-4 py-3 shadow-[0_12px_28px_rgba(30,64,175,0.08)] min-w-[160px] flex-1 sm:flex-none">
                    <p className="text-sm font-semibold text-[#0b1f4d]">{stat.value}</p>
                    <p className="mt-1 text-xs text-[#64748b]">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#contact-sales" className="inline-flex items-center gap-2 rounded-full bg-[#0f766e] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(15,118,110,0.28)] transition hover:-translate-y-0.5">
                  Start a launch call
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link href="/fashionhub" className="inline-flex items-center gap-2 rounded-full border border-[#c7d7ef] bg-white px-6 py-3 text-sm font-semibold text-[#0b1f4d] shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:bg-[#f8fbff]">
                  View demo store
                </Link>
                <a href="#pricing" className="inline-flex items-center gap-2 rounded-full border border-[#c7d7ef] bg-white px-6 py-3 text-sm font-semibold text-[#0b1f4d] transition hover:bg-[#f8fbff]">
                  See plans
                </a>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {TRUST_METRICS.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-[#d7e5f7] bg-white px-4 py-3 shadow-[0_12px_28px_rgba(30,64,175,0.08)]">
                    <p className="text-sm font-semibold text-[#0b1f4d]">{metric.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#64748b]">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#475569]">
                <span className="rounded-full border border-[#d7e5f7] bg-white px-3 py-1.5">WhatsApp-first commerce</span>
                <span className="rounded-full border border-[#d7e5f7] bg-white px-3 py-1.5">Light theme, fast loading</span>
                <span className="rounded-full border border-[#d7e5f7] bg-white px-3 py-1.5">Built for small business growth</span>
              </div>
            </div>

            <div className="space-y-4 lg:pt-1">
              <div className="rounded-[28px] border border-[#d7e5f7] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-6 lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Store dashboard</p>
                    <h2 className="display-heading mt-2 text-xl font-semibold text-[#0b1f4d] sm:text-2xl">Your complete online store in 5 minutes</h2>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-[#f0fdf4] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#15803d]">
                    Live
                  </span>
                </div>

                <div className="mt-4 rounded-[24px] bg-[#f8fbff] p-4 shadow-[inset_0_0_0_1px_rgba(199,215,239,0.6)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#0b1f4d]">Mobile Mart India</p>
                      <p className="mt-1 text-xs text-[#64748b]">Nehru Place, Delhi · Verified</p>
                    </div>
                    <div className="rounded-2xl bg-[#0f766e] px-3 py-2 text-right text-white shadow-[0_12px_24px_rgba(15,118,110,0.22)]">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/80">Revenue · June</p>
                      <p className="text-lg font-semibold">₹82K</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Orders', value: '247' },
                      { label: 'Visitors', value: '1.2K' },
                      { label: 'Avg. order', value: '₹332' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-[#d7e5f7] bg-white px-3 py-3 text-center">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#64748b]">{item.label}</p>
                        <p className="mt-1 text-base font-semibold text-[#0b1f4d]">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#d7e5f7] bg-white px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      <BadgeCheck className="h-4 w-4 text-[#0f766e]" />
                      Order flow
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {DASHBOARD_STEPS.map((step, index) => (
                        <div key={step} className={`rounded-2xl px-3 py-3 text-center text-xs font-semibold ${index === 0 ? 'bg-[#eff6ff] text-[#1d4ed8]' : index === 1 ? 'bg-[#ecfeff] text-[#0f766e]' : 'bg-[#f8fafc] text-[#0b1f4d]'}`}>
                          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold shadow-[0_8px_18px_rgba(15,23,42,0.06)]">{index + 1}</div>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#334155]">
                  <div className="rounded-2xl border border-[#dbe7f5] bg-[#f8fbff] p-3">
                    <p className="font-semibold text-[#0b1f4d]">No commissions</p>
                    <p className="mt-1 text-[#64748b]">Keep 100% of the sale value.</p>
                  </div>
                  <div className="rounded-2xl border border-[#dbe7f5] bg-[#f8fbff] p-3">
                    <p className="font-semibold text-[#0b1f4d]">Built-in support</p>
                    <p className="mt-1 text-[#64748b]">Sell, track, and manage in one place.</p>
                  </div>
                </div>
              </div>

              <div id="contact-sales" className="animate-fade-up rounded-[28px] border border-[#d7e5f7] bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Book a demo</p>
                    <h2 className="display-heading mt-2 text-xl font-semibold text-[#0b1f4d] sm:text-2xl">Talk to sales</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#86efac] bg-[#f0fdf4] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#15803d]">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Fast response
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#475569]">
                  Share your business details and get the right store setup, plan fit, and onboarding path.
                </p>

                <SalesEnquiryForm />

                <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-[#334155]">
                  <div className="rounded-2xl border border-[#dbe7f5] bg-[#f8fbff] p-3">
                    <p className="font-semibold text-[#0b1f4d]">Premium design</p>
                    <p className="mt-1 text-[#64748b]">A clean storefront that feels trustworthy.</p>
                  </div>
                  <div className="rounded-2xl border border-[#dbe7f5] bg-[#f8fbff] p-3">
                    <p className="font-semibold text-[#0b1f4d]">Built for growth</p>
                    <p className="mt-1 text-[#64748b]">Easy to scale with products and plans.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 rounded-[30px] border border-[#d7e5f7] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:grid-cols-3">
            {[
              { title: 'WhatsApp checkout', detail: 'Customers can move from browsing to order confirmation without friction.' },
              { title: 'Business-ready admin', detail: 'Manage products, customers, and orders from one panel.' },
              { title: 'Fast launch support', detail: 'Onboarding is structured so teams can go live quickly.' },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-[#e2ecfa] bg-[#f8fbff] p-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#0f766e]" />
                  <h3 className="text-base font-semibold text-[#0b1f4d]">{item.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Features</p>
              <h2 className="display-heading mt-2 text-3xl font-semibold text-[#0b1f4d] sm:text-4xl">Everything you need to sell better</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-[#475569]">
              The homepage mirrors the clean, premium commerce look you shared, but stays branded for ImiqX and your current product flow.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {FEATURE_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="group rounded-[26px] border border-[#d7e5f7] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(15,23,42,0.08)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#1d4ed8] transition group-hover:bg-[#dbeafe]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#0b1f4d]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#475569]">{card.detail}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section id="clients" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-[30px] border border-[#d7e5f7] bg-gradient-to-br from-white via-[#f8fbff] to-[#eefbf8] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Clients</p>
                <h2 className="display-heading mt-2 text-3xl font-semibold text-[#0b1f4d] sm:text-4xl">Trusted by growing brands</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#475569]">
                Live tenant records appear here when available. Until then, the homepage shows a demo store showcase.
              </p>
            </div>

            {showcaseClients.length > 0 ? (
              <div className="mt-6 overflow-hidden">
                <div className="animate-ticker flex gap-5 py-2">
                  {clientTicker.map((client, index) => (
                    <div key={`${client.id}-${index}`} className="flex min-w-[150px] flex-col items-center rounded-3xl border border-[#dbe7f5] bg-white px-4 py-5 text-center shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.businessName} className="h-16 w-16 object-contain" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1d4ed8] via-[#0369a1] to-[#0f766e] text-lg font-bold text-white">
                          {initialsFromName(client.businessName)}
                        </div>
                      )}
                      <p className="mt-3 text-sm font-semibold text-[#0b1f4d]">{client.businessName}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#c7d7ef] bg-white px-4 py-8 text-center text-sm text-[#64748b]">
                Client cards will appear here once brand records are available in the database.
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="rounded-[30px] border border-[#d7e5f7] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Global reach</p>
                <h2 className="display-heading mt-2 text-3xl font-semibold text-[#0b1f4d] sm:text-4xl">Leading chat commerce markets</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#475569]">
                The same commerce pattern works across India and other mobile-first markets where chat is the default way to shop.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {MARKET_CARDS.map((market) => (
                <div key={market.country} className="rounded-[24px] border border-[#dbe7f5] bg-[#f8fbff] p-5">
                  <p className="text-lg font-semibold text-[#0b1f4d]">{market.country}</p>
                  <p className="mt-1 text-sm text-[#475569]">{market.note}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e]">{market.metric}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="rounded-[30px] border border-[#d7e5f7] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-8 lg:p-9">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Pricing</p>
                <h2 className="display-heading mt-2 text-3xl font-semibold text-[#0b1f4d] sm:text-4xl">Simple plans for every stage</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#475569]">
                Start with the basics, upgrade when the business grows, or choose a one-time option for long-term ownership.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="rounded-[30px] border border-[#d7e5f7] bg-gradient-to-br from-[#eff6ff] via-white to-[#eefbf8] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">Start today</p>
                <h2 className="display-heading mt-2 text-3xl font-semibold text-[#0b1f4d] sm:text-4xl">Start your free trial today</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#475569]">
                Try the platform, explore the store builder, and see how the WhatsApp order flow feels before you commit.
              </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  'Free to start',
                  '7-day trial',
                  'No charge today',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#dbe7f5] bg-white px-4 py-3 text-sm font-semibold text-[#0b1f4d] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <a href="#contact-sales" className="inline-flex items-center gap-2 rounded-full bg-[#0f766e] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(15,118,110,0.28)] transition hover:-translate-y-0.5">
                  Start free trial
                </a>
                <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border border-[#c7d7ef] bg-white px-6 py-3 text-sm font-semibold text-[#0b1f4d] transition hover:bg-[#f8fbff]">
                  See all plans
                </Link>
              </div>
            </div>
          </div>
        </section>
              {planCards.map((plan, index) => (
                <div key={plan.name} className={`animate-fade-up rounded-[26px] border border-[#d7e5f7] bg-gradient-to-b from-white to-[#f8fbff] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)] stagger-${index + 1}`}>
                  <div className={`inline-flex rounded-full bg-gradient-to-r ${plan.accent} px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white`}>
                    {plan.name}
                  </div>
                  <p className="mt-4 display-heading text-4xl font-semibold text-[#0b1f4d]">
                    {plan.price}
                    <span className="ml-2 text-sm font-medium text-[#64748b]">{plan.cycle}</span>
                  </p>
                  <ul className="mt-5 space-y-3 text-sm text-[#475569]">
                    {plan.points.map((point) => (
                      <li key={point} className="flex gap-2 leading-6">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[30px] border border-[#d7e5f7] bg-[#0b1f4d] p-6 text-white shadow-[0_16px_42px_rgba(15,23,42,0.12)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#93c5fd]">Why ImiqX</p>
              <h3 className="display-heading mt-3 text-3xl font-semibold leading-tight">Made for sellers who want a sharper first impression.</h3>
              <p className="mt-4 text-sm leading-7 text-[#cbd5e1]">
                The design language is intentionally bright, premium, and structured so your business feels trustworthy from the first scroll.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-[#e2e8f0]">
                {['Light theme with high contrast buttons', 'Clear business sections and pricing blocks', 'Direct WhatsApp and enquiry pathways'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                    <Users className="h-4 w-4 text-[#86efac]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group rounded-[24px] border border-[#d7e5f7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-[#0b1f4d]">
                    <span>{faq.question}</span>
                    <span className="rounded-full border border-[#c7d7ef] bg-[#f8fbff] px-2.5 py-1 text-xs text-[#0f766e] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-[#475569]">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <section id="help" className="border-t border-[#dbe7f5] bg-[#f8fbff]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm leading-7 text-[#334155]">
              ImiqX helps small businesses launch a polished online store, keep the buying flow simple, and sell confidently through WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {platformWhatsAppNumber ? (
              <a href={`https://wa.me/${platformWhatsAppNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[0_12px_24px_rgba(37,211,102,0.28)] transition hover:-translate-y-0.5">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            ) : null}
            <a href="#contact-sales" className="inline-flex items-center gap-2 rounded-full border border-[#c7d7ef] bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#0b1f4d] transition hover:bg-[#f8fbff]">
              <Crown className="h-4 w-4 text-[#0f766e]" />
              Talk to sales
            </a>
          </div>
        </div>
      </section>

      <a href="#contact-sales" className="animate-pulse-ring fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#0f766e] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[0_16px_34px_rgba(15,118,110,0.32)]">
        <MessageCircle className="h-4 w-4" />
        Send enquiry
      </a>

      <PlatformFooter />
    </div>
  )
}
