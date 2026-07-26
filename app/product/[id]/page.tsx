import React from 'react'
import { fetchProductById, fetchReviews } from '../../../services/productService'
import { getTenantConfig } from '../../../lib/tenant'
import { getTenantEntitlements, getTenantRowFromRequest, getTenantSettings } from '../../../lib/tenantDb'
import ProductDetailClient from '../../../components/product/ProductDetailClient'
import ProductImageGallery from '../../../components/product/ProductImageGallery'
import ReviewsSection from '../../../components/product/ReviewsSection'
import { CheckCircle2, Star } from 'lucide-react'

export default async function ProductPage({ params }: { params: any }) {
  const { id } = await params
  const tenant = await getTenantConfig()
  const tenantRow = await getTenantRowFromRequest().catch(() => null)
  const tenantSettings = tenantRow ? await getTenantSettings(tenantRow.id).catch(() => ({} as Record<string, string>)) : {}
  const entitlements = tenantRow ? await getTenantEntitlements(tenantRow.id).catch(() => null) : null
  const route = (path: string) => `${tenant.routePrefix}${path}`
  const [product, reviews] = await Promise.all([
    fetchProductById(id, tenant.gsheetId),
    fetchReviews(id, tenant.gsheetId).catch(() => []),
  ])

  if (!product)
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-4 text-6xl">😕</div>
          <h2 className="text-2xl font-bold text-slate-900">Product not found</h2>
          <p className="mt-2 text-slate-500">This product may have been removed or the link is incorrect.</p>
          <a href={route('/')} className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
            Back to home
          </a>
        </div>
      </div>
    )

  const savings = product.price && product.offerPrice ? Math.round(product.price - product.offerPrice) : 0
  const categoryLabel = String(product.category || '').trim()
  const businessType = String(tenantSettings.BusinessType || tenantSettings.businessType || 'ecommerce_product').trim().toLowerCase() === 'ecommerce_services'
    ? 'ecommerce_services'
    : 'ecommerce_product'
  const whatsappNumber = String(tenantRow?.whatsapp_number || tenant.whatsappNumber || '').trim()

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6">
      <nav aria-label="breadcrumb" className="mb-7 flex items-center gap-2 text-sm text-slate-400">
        <a href={route('/')} className="transition hover:text-accent">Home</a>
        <span>›</span>
        <a href={route('/search')} className="transition hover:text-accent">{product.category ?? 'Products'}</a>
        <span>›</span>
        <span className="max-w-[200px] truncate text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] animate-fade-up">
        <div className="space-y-4">
          <ProductImageGallery images={product.images ?? []} productName={product.name} />
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex min-w-[112px] items-center justify-center rounded-full border border-blue-300 bg-blue-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-blue-900">
                {categoryLabel || 'Featured'}
              </span>
              {product.discount ? (
                <span className="inline-flex min-w-[92px] items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">{product.discount}% OFF</span>
              ) : null}
            </div>
            <h1 className="text-2xl font-extrabold leading-snug text-slate-900 lg:text-[1.75rem]">{product.name}</h1>
            {product.brand && <p className="mt-1.5 text-sm font-medium text-slate-500">by {product.brand}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={15} className={i <= 4 ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'} />
              ))}
            </div>
            <span className="text-sm font-semibold text-slate-700">{product.rating ?? '4.8'}</span>
            <span className="text-sm text-slate-400">· 128 reviews</span>
            <span className={`text-xs font-bold ${product.stock ? 'text-emerald-600' : 'text-red-500'}`}>
              ● {product.stock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-extrabold text-slate-900">₹{product.offerPrice}</span>
              {product.price && product.price !== product.offerPrice && (
                <span className="mb-0.5 text-lg text-slate-400 line-through">₹{product.price}</span>
              )}
            </div>
            {savings > 0 && (
              <p className="mt-1 text-sm font-semibold text-emerald-600">You save ₹{savings} ({product.discount}% off)</p>
            )}
            <p className="mt-2 text-xs text-slate-400">Inclusive of all taxes · Free delivery available</p>
          </div>

          {product.description && <p className="text-sm leading-7 text-slate-600">{product.description}</p>}

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Why you'll love it</h3>
            <ul className="space-y-2.5">
              {[
                'Premium materials for lasting comfort and durability',
                'Fast WhatsApp checkout — no account needed',
                'Easy returns within 7 days of delivery',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <ProductDetailClient
                product={product}
                routePrefix={tenant.routePrefix}
                businessType={businessType}
                whatsappNumber={whatsappNumber}
              />
            </div>

          <div className="grid grid-cols-3 gap-3">
            {[{ e: '🔒', t: 'Secure' }, { e: '🚚', t: 'Fast Ship' }, { e: '↩️', t: 'Returns' }].map(({ e, t }) => (
              <div key={t} className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white py-4">
                <span className="text-xl">{e}</span>
                <span className="text-[11px] font-semibold text-slate-500">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {entitlements?.features?.customer_reviews !== false ? <ReviewsSection productId={id} initialReviews={reviews} /> : null}
    </div>
  )
}
