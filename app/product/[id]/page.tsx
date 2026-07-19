import React from 'react'
import { fetchProductById } from '../../../services/productService'
import ProductDetailClient from '../../../components/product/ProductDetailClient'
import { CartProvider } from '../../../hooks/useCart'

export default async function ProductPage({ params }: { params: any }) {
  const { id } = await params
  const product = await fetchProductById(id)
  if (!product) return <div className="px-4 pt-24">Product not found</div>

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-24">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white shadow-lg">
          <div className="aspect-[4/3] bg-slate-100 overflow-hidden rounded-t-[32px]">
            <img src={product.images?.[0] ?? '/placeholder.svg'} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{product.category || 'Featured'}</span>
              <span>{product.brand ?? 'Trusted brand'}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">{product.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="text-3xl font-bold text-slate-900">₹{product.offerPrice}</div>
              <div className="text-sm text-slate-500 line-through">₹{product.price}</div>
              {product.discount ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{product.discount}% off</span> : null}
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-600">{product.description ?? 'A premium product designed to give you comfort and performance in every use.'}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Stock status</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{product.stock ? 'In stock' : 'Out of stock'}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Rating</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{product.rating ? `${product.rating}/5` : '4.8/5'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Why you’ll love it</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>• Premium materials for comfort and durability.</li>
              <li>• Fast checkout through WhatsApp and easy order tracking.</li>
              <li>• Designed for both mobile and desktop shopping.</li>
            </ul>
          </div>
          <CartProvider>
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-lg">
              <ProductDetailClient product={product} />
            </div>
          </CartProvider>
        </div>
      </div>
    </div>
  )
}
