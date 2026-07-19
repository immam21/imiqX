import ProductCard from '../components/product/ProductCard'
import LeadsPopup from '../components/LeadsPopup'
import { fetchProducts } from '../services/productService'
import type { Product } from '../types'

export default async function Home() {
  const products: Product[] = await fetchProducts().catch((error) => {
    console.error('Google Sheets fetch failed:', error)
    return []
  })
  const heroProduct = products[0]
  const featuredProducts = products.slice(0, 8)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24">
      <LeadsPopup />
      <section className="mt-6 overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-sky-500 p-6 text-white shadow-2xl sm:p-10 animate-fade-up">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-xl space-y-6">
            <span className="inline-flex rounded-full bg-white/20 px-4 py-2 text-xs uppercase tracking-[0.32em] text-slate-200">Powered by Google Sheets</span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Your live product catalog from Google Sheets.</h1>
              <p className="max-w-2xl text-base text-slate-200/85 sm:text-lg">
                Always display the latest inventory, prices, and images directly from your sheet. No sample products, no placeholders.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <a href="/search" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-xl transition duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98]">
                Browse live products
              </a>
              <a href="/cart" className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition duration-300 ease-out hover:border-white active:scale-[0.98]">
                View cart
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl sm:p-8 animate-pop">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/40 to-transparent" />
            {heroProduct ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-3xl border border-white/15 bg-slate-950/10 px-4 py-3 text-sm text-slate-100">
                  <span className="uppercase tracking-[0.24em] text-slate-200">Featured</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-100">Best seller</span>
                </div>

                <div className="overflow-hidden rounded-[32px] bg-slate-900 shadow-xl">
                  <img src={heroProduct.images?.[0] ?? '/placeholder.svg'} alt={heroProduct.name} className="h-[280px] w-full object-cover object-center" />
                </div>

                <div className="space-y-3 px-1">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <span className="rounded-full bg-white/10 px-3 py-1">{heroProduct.brand ?? 'Brand'}</span>
                    <span className="text-slate-300/80">{heroProduct.category ?? 'Category'}</span>
                  </div>
                  <h2 className="text-3xl font-semibold text-white sm:text-4xl">{heroProduct.name}</h2>
                  <p className="max-w-xl text-sm leading-7 text-slate-200/80">
                    {heroProduct.description ?? 'Your latest catalog item, updated from Google Sheets in real time.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-slate-300">Starting from</p>
                      <p className="text-3xl font-semibold text-white">₹{heroProduct.offerPrice ?? heroProduct.price}</p>
                    </div>
                    <a href={`/product/${heroProduct.productId}`} className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5">
                      View product
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[32px] border border-white/15 bg-slate-950/10 p-10 text-center text-slate-200">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">No live products</p>
                <h2 className="mt-4 text-2xl font-semibold">Connect your Google Sheets catalog</h2>
                <p className="mt-3 text-sm text-slate-300">Add a valid GSHEET_ID to your environment to show your real inventory on the homepage.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Latest drops</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Live inventory</h2>
          </div>
          <a href="/search" className="text-sm font-medium text-accent transition hover:text-slate-900">
            See all products →
          </a>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-600">
            No products loaded from Google Sheets yet. Verify that `GSHEET_ID` is configured and your sheet has a Products tab.
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-3 animate-fade-up">
        <div className="rounded-[32px] bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-6 shadow-xl">
          <span className="text-sm uppercase tracking-[0.24em] text-accent">Why choose us</span>
          <h3 className="mt-4 text-2xl font-semibold text-slate-900">A premium storefront built for modern customers.</h3>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Clean visuals, quick navigation, and checkout through WhatsApp make shopping feel fast and familiar.
          </p>
        </div>
        <div className="rounded-[32px] bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50 p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-900">Fast delivery</h3>
          <p className="mt-3 text-sm text-slate-600">Keep customers coming back with reliable delivery estimates and premium packaging.</p>
        </div>
        <div className="rounded-[32px] bg-gradient-to-br from-slate-50 via-slate-100 to-fuchsia-50 p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-900">Secure checkout</h3>
          <p className="mt-3 text-sm text-slate-600">WhatsApp checkout keeps the purchase flow simple and familiar for mobile buyers.</p>
        </div>
      </section>
    </div>
  )
}
