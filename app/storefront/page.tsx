import BannerCarousel from '../../components/home/BannerCarousel'
import LeadsPopup from '../../components/LeadsPopup'
import FeaturedProductsGrid from '../../components/product/FeaturedProductsGrid'
import { fetchProducts, fetchSettings, fetchTestimonials, fetchBanners } from '../../services/productService'
import { getTenantConfig } from '../../lib/tenant'
import { getTenantBusinessProfile, getTenantEntitlements, getTenantRowFromRequest, getTenantSettings } from '../../lib/tenantDb'
import { toRenderableAssetUrl } from '../../lib/assetUrl'
import type { Product } from '../../types'

export const dynamic = 'force-dynamic'

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

export default async function Home() {
  const tenant = await getTenantConfig()
  const tenantRow = await getTenantRowFromRequest().catch(() => null)
  const tenantSettings = tenantRow ? await getTenantSettings(tenantRow.id).catch(() => ({} as Record<string, string>)) : {}
  const tenantProfile = tenantRow ? await getTenantBusinessProfile(tenantRow.id).catch(() => null) : null
  const entitlements = tenantRow ? await getTenantEntitlements(tenantRow.id).catch(() => null) : null
  const sid = tenant.gsheetId
  const route = (path: string) => `${tenant.routePrefix}${path}`
  const bannersEnabled = entitlements?.features?.banners !== false

  const [products, settings, testimonials, banners] = await Promise.all([
    fetchProducts(sid).catch((error) => {
      console.error('Catalog fetch failed:', error)
      return [] as Product[]
    }),
    fetchSettings(sid).catch(() => ({ businessName: '', offerLabel: '', offerTitle: '', offerSubtitle: '', logoUrl: '' })),
    fetchTestimonials(sid).catch(() => []),
    fetchBanners(sid).catch(() => []),
  ])
  const businessName = String(
    settings.businessName?.trim() ||
    tenantProfile?.business_name?.trim() ||
    tenantRow?.business_name?.trim() ||
    toDisplayName(tenantRow?.tenant_code || tenant.tenantId || '') ||
    'Our Store'
  ).trim()
  const tenantLogoUrl = toRenderableAssetUrl(
    tenantSettings.LogoURL || tenantSettings.logoUrl ||
    settings.logoUrl ||
    tenantProfile?.logo_url?.trim() ||
    tenantRow?.logo_url?.trim() ||
    ''
  )
  const featuredProducts = products.slice(0, 8)
  const businessType = String(tenantSettings.BusinessType || tenantSettings.businessType || 'ecommerce_product').trim().toLowerCase() === 'ecommerce_services'
    ? 'ecommerce_services'
    : 'ecommerce_product'

  return (
    <div className="theme-aurora min-h-screen">
      <LeadsPopup
        offerLabel={settings.offerLabel || undefined}
        offerTitle={settings.offerTitle || undefined}
        offerSubtitle={settings.offerSubtitle || undefined}
      />

      {/* ====================== HERO ====================== */}
      <section className="relative overflow-hidden px-4 pb-20 pt-12 sm:px-6 sm:pb-28">
        {/* Full blurred logo background */}
        {tenantLogoUrl ? (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {/* Logo as full-bleed background */}
            <img
              src={tenantLogoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover select-none"
              style={{ filter: 'blur(24px)', transform: 'scale(2.2)' }}
            />
            {/* Dark overlay so text stays readable */}
            <div className="absolute inset-0 bg-slate-950/75" />
            {/* Subtle gradient fade at edges */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-transparent to-slate-900/60" />
            {/* Grid texture */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(to right,rgba(255,255,255,1) 1px,transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>
        ) : (
          /* Fallback: original gradient when no logo */
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900">
            <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-cyan-500/25 blur-[90px]" />
            <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-sky-500/20 blur-[90px]" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-teal-400/15 blur-[90px]" />
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(to right,rgba(255,255,255,1) 1px,transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>
        )}

        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl">

            {/* Left — copy */}
            <div className="space-y-7 text-white animate-fade-up">
              <div className="inline-flex w-max items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-300/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                Welcome to {businessName}
              </div>

              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]">
                {businessName}, where<br />
                <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-teal-200 bg-clip-text text-transparent animate-gradient">
                  products and services
                </span>{' '}
                you can trust.
              </h1>

              <p className="max-w-lg text-base leading-7 text-slate-200 sm:text-[17px]">
                Experience a modern shopping destination built for quality, value, and confidence in every order.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="rounded-full border border-cyan-200/40 bg-white/18 px-3 py-1.5 font-bold text-white shadow-sm">Curated collections</span>
                <span className="rounded-full border border-cyan-200/40 bg-white/18 px-3 py-1.5 font-bold text-white shadow-sm">Trusted quality</span>
                <span className="rounded-full border border-cyan-200/40 bg-white/18 px-3 py-1.5 font-bold text-white shadow-sm">Customer-first support</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={route('/search')} className="btn-primary text-[15px]">
                  Browse all products
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
                <a href={route('/cart')} className="btn-ghost text-white text-[15px]">
                  View cart
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {[
                  { icon: '✅', title: 'Genuine', text: 'Authentic picks' },
                  { icon: '🛡️', title: 'Protected', text: 'Safe checkout' },
                  { icon: '🚚', title: 'Fast', text: 'Reliable delivery' },
                ].map(({ icon, title, text }) => (
                  <div key={text} className="trust-icon-badge rounded-xl px-3 py-2">
                    <span className="text-sm">{icon}</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-100">{title}</p>
                      <p className="text-[11px] text-slate-300">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== BANNER CAROUSEL ====================== */}
      {bannersEnabled && banners.length > 0 ? <BannerCarousel banners={banners} /> : null}

      {/* ====================== SHOP COLLECTION ====================== */}
      <section className="surface-premium glass-surface mx-auto mt-10 max-w-7xl rounded-[2rem] px-4 py-16 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Shop collection</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">Popular picks for you</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Discover products from our latest catalog updates, ready to browse and order.
            </p>
          </div>
          <a
            href={route('/search')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-blue-700"
          >
            Explore full catalog
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <FeaturedProductsGrid products={featuredProducts} routePrefix={tenant.routePrefix} businessType={businessType} />
      </section>

      {/* ====================== WHY US ====================== */}
      <section className="border-y border-cyan-100/60 bg-white/80 py-20 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 text-center animate-fade-up">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Why choose us</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Shopping made simple,<br className="hidden sm:block" /> fast &amp; trustworthy
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 leading-6">
              Every order is backed by secure checkout, verified catalog control, and responsive support from discovery to delivery.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up">
            {[
              {
                emoji: '✅',
                from: 'from-blue-50',
                to: 'to-indigo-50',
                border: 'border-blue-100',
                badge: 'Always accurate',
                title: 'Live, real-time inventory',
                desc: 'Every product shown is verified and continuously synced with available inventory for dependable checkout decisions.',
              },
              {
                emoji: '💬',
                from: 'from-emerald-50',
                to: 'to-teal-50',
                border: 'border-emerald-100',
                badge: 'Zero friction',
                title: 'Order via WhatsApp',
                desc: 'No account. No complex steps. Select your products and confirm securely on WhatsApp in under a minute.',
              },
              {
                emoji: '🚀',
                from: 'from-amber-50',
                to: 'to-orange-50',
                border: 'border-amber-100',
                badge: '1–3 day delivery',
                title: 'Swift, safe delivery',
                desc: 'Orders are packed with care and dispatched through reliable courier partners with clear delivery updates.',
              },
              {
                emoji: '🏅',
                from: 'from-violet-50',
                to: 'to-purple-50',
                border: 'border-violet-100',
                badge: '100% authentic',
                title: 'Only genuine products',
                desc: 'Every item comes from verified suppliers and approved sources so you always receive genuine products.',
              },
              {
                emoji: '🔄',
                from: 'from-rose-50',
                to: 'to-pink-50',
                border: 'border-rose-100',
                badge: 'Hassle-free',
                title: 'Easy returns & refunds',
                desc: 'If something is not right, our return and refund flow is designed to be fast, transparent, and customer-first.',
              },
              {
                emoji: '🤝',
                from: 'from-cyan-50',
                to: 'to-sky-50',
                border: 'border-cyan-100',
                badge: 'Always available',
                title: '24 / 7 customer support',
                desc: 'Questions before or after checkout are handled quickly by our support team through trusted direct channels.',
              },
            ].map(({ emoji, from, to, border, badge, title, desc }) => (
              <div
                key={title}
                className={`card-3d group rounded-3xl bg-gradient-to-br ${from} ${to} border ${border} p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl`}
              >
                <div className="mb-4 text-4xl">{emoji}</div>
                <span className="inline-block rounded-full bg-white/70 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200/60 mb-3">
                  {badge}
                </span>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== TESTIMONIALS ====================== */}
      {testimonials.length > 0 && (
        <section className="relative overflow-hidden bg-slate-900 py-20">
          {/* Subtle glow blobs */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-accent/10 blur-[100px]" />
            <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            {/* Header */}
            <div className="mb-12 text-center animate-fade-up">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Customer trust</p>
              <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                Safe shopping experiences people recommend
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400 leading-6">
                Verified customer stories from secure, reliable orders across categories.
              </p>
              {/* Aggregate star row */}
              <div className="mt-5 flex items-center justify-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-bold text-white">
                  {(testimonials.reduce((s, t) => s + t.rating, 0) / testimonials.length).toFixed(1)}
                </span>
                <span className="text-sm text-slate-400">
                  from {testimonials.length} review{testimonials.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Cards grid */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.15] hover:bg-white/[0.07]"
                >
                  {/* Decorative quote */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute right-5 top-3 select-none font-serif text-8xl leading-none text-white/[0.04]"
                  >
                    "
                  </div>

                  {/* Stars */}
                  <div className="mb-4 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <svg
                        key={j}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={j < t.rating ? '#F59E0B' : '#1e293b'}
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                  </div>

                  {/* Review text */}
                  <p className="relative flex-1 text-sm leading-7 text-slate-300">
                    &ldquo;{t.review}&rdquo;
                  </p>

                  {/* Author */}
                  <div className="mt-6 flex items-center gap-3">
                    {t.avatar ? (
                      <img
                        src={t.avatar}
                        alt={t.name}
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-700 text-sm font-extrabold text-white shadow-md shadow-accent/20">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      {t.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          {t.location}
                        </p>
                      )}
                    </div>
                    {/* Verified badge */}
                    <div className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                      </svg>
                      Verified
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  )
}
