import FeaturedProductsGrid from '../components/product/FeaturedProductsGrid'
import LeadsPopup from '../components/LeadsPopup'
import { fetchProducts, fetchSettings, fetchTestimonials } from '../services/productService'
import config from '../config'
import type { Product } from '../types'

export default async function Home() {
  const [products, settings, testimonials] = await Promise.all([
    fetchProducts().catch((error) => {
      console.error('Inventory fetch failed:', error)
      return [] as Product[]
    }),
    fetchSettings().catch(() => ({ offerLabel: '', offerTitle: '', offerSubtitle: '' })),
    fetchTestimonials().catch(() => []),
  ])
  const heroProduct = products[0]
  const featuredProducts = products.slice(0, 8)

  const initials = config.businessName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen">
      <LeadsPopup
        offerLabel={settings.offerLabel || undefined}
        offerTitle={settings.offerTitle || undefined}
        offerSubtitle={settings.offerSubtitle || undefined}
      />

      {/* ====================== HERO ====================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 pb-20 pt-12 sm:px-6 sm:pb-28">
        {/* Background decorations */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-accent/20 blur-[80px]" />
          <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-blue-600/15 blur-[80px]" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-600/10 blur-[80px]" />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(to right,rgba(255,255,255,1) 1px,transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* Left — copy */}
            <div className="space-y-7 text-white animate-fade-up">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold tracking-wider text-slate-300 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Always in stock · Updated from our own inventory
              </div>

              <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Shop premium<br />
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                  products
                </span>{' '}
                you'll love.
              </h1>

              <p className="max-w-lg text-base leading-7 text-slate-400 sm:text-[17px]">
                Curated catalog, always in stock, and seamless WhatsApp checkout. No account needed.
              </p>

              <div className="flex flex-wrap gap-3">
                <a href="/search" className="btn-primary text-[15px]">
                  Browse all products
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
                <a href="/cart" className="btn-ghost text-white text-[15px]">
                  View cart
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-5 pt-1">
                {[
                  { icon: '⚡', text: 'Fast delivery' },
                  { icon: '🔒', text: 'Secure checkout' },
                  { icon: '↩️', text: 'Easy returns' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-sm">{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — hero product card */}
            <div className="animate-pop stagger-2">
              {heroProduct ? (
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Featured</span>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                      ● Live
                    </span>
                  </div>
                  <div className="relative overflow-hidden">
                    <img
                      src={heroProduct.images?.[0] ?? '/placeholder.svg'}
                      alt={heroProduct.name}
                      className="h-64 w-full object-cover animate-float"
                      style={{ animationDuration: '8s' }}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900/80 to-transparent" />
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      {heroProduct.brand && (
                        <span className="rounded-full bg-white/10 px-2.5 py-1 font-medium">{heroProduct.brand}</span>
                      )}
                      {heroProduct.category && <span className="text-slate-500">{heroProduct.category}</span>}
                    </div>
                    <h2 className="text-xl font-bold text-white line-clamp-1">{heroProduct.name}</h2>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Starting from</p>
                        <p className="mt-0.5 text-2xl font-extrabold text-white">
                          ₹{heroProduct.offerPrice ?? heroProduct.price}
                        </p>
                      </div>
                      <a
                        href={`/product/${heroProduct.productId}`}
                        className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                      >
                        View →
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-12 text-center backdrop-blur-xl">
                  <div className="mb-4 text-4xl">🏪</div>
                  <h2 className="text-xl font-bold text-white">Connect your catalog</h2>
                  <p className="mt-3 text-sm text-slate-400">
                    Add your <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-300">GSHEET_ID</code> to show live products here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====================== FEATURED PRODUCTS ====================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Latest drops</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">Featured products</h2>
            <p className="mt-1.5 text-sm text-slate-500">Hand-picked from our live catalog, always up to date.</p>
          </div>
          <a
            href="/search"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-blue-700"
          >
            View all products
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <FeaturedProductsGrid products={featuredProducts} />
      </section>

      {/* ====================== WHY US ====================== */}
      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 text-center animate-fade-up">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Why choose us</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Shopping made simple,<br className="hidden sm:block" /> fast &amp; trustworthy
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 leading-6">
              We built every detail around your experience — from the moment you browse to the second your order arrives.
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
                desc: 'Every product you see is confirmed in stock from our own warehouse. No disappointments, no "sold out after ordering".',
              },
              {
                emoji: '💬',
                from: 'from-emerald-50',
                to: 'to-teal-50',
                border: 'border-emerald-100',
                badge: 'Zero friction',
                title: 'Order via WhatsApp',
                desc: 'No account. No lengthy forms. Just pick what you love and confirm your order in a single WhatsApp message — done in 30 seconds.',
              },
              {
                emoji: '🚀',
                from: 'from-amber-50',
                to: 'to-orange-50',
                border: 'border-amber-100',
                badge: '1–3 day delivery',
                title: 'Swift, safe delivery',
                desc: 'Your order is carefully packed and handed to trusted couriers. Track every step and receive your parcel right at your door.',
              },
              {
                emoji: '🏅',
                from: 'from-violet-50',
                to: 'to-purple-50',
                border: 'border-violet-100',
                badge: '100% authentic',
                title: 'Only genuine products',
                desc: 'Every item in our catalog is sourced directly from verified brands and suppliers. Quality is non-negotiable — always.',
              },
              {
                emoji: '🔄',
                from: 'from-rose-50',
                to: 'to-pink-50',
                border: 'border-rose-100',
                badge: 'Hassle-free',
                title: 'Easy returns & refunds',
                desc: 'Not happy? No problem. Our 7-day return policy and instant refund process ensure you shop with complete peace of mind.',
              },
              {
                emoji: '🤝',
                from: 'from-cyan-50',
                to: 'to-sky-50',
                border: 'border-cyan-100',
                badge: 'Always available',
                title: '24 / 7 customer support',
                desc: 'Have a question before or after your order? Our team is reachable on WhatsApp any time of day — real humans, real answers.',
              },
            ].map(({ emoji, from, to, border, badge, title, desc }) => (
              <div
                key={title}
                className={`group rounded-3xl bg-gradient-to-br ${from} ${to} border ${border} p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl`}
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
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Customer love</p>
              <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                Trusted by thousands of happy shoppers
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400 leading-6">
                Real reviews from real customers — unfiltered and straight from their hearts.
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
