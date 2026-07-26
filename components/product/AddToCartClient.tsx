"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '../../hooks/useCart'
import { ShoppingCart, Check, Minus, Plus, Zap, MessageCircle } from 'lucide-react'

export default function AddToCartClient({
  product,
  routePrefix = '',
  businessType = 'ecommerce_product',
  whatsappNumber = '',
}: {
  product: any
  routePrefix?: string
  businessType?: 'ecommerce_product' | 'ecommerce_services'
  whatsappNumber?: string
}) {
  const { addItem } = useCart()
  const router = useRouter()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const route = (path: string) => `${routePrefix}${path}`
  const isServiceBusiness = businessType === 'ecommerce_services'

  const openWhatsAppEnquiry = () => {
    const digits = String(whatsappNumber || '').replace(/\D/g, '')
    const line1 = `Hi, I want to enquire about: ${String(product?.name || 'this service')}`
    const line2 = `Link: ${typeof window !== 'undefined' ? window.location.href : ''}`
    const message = encodeURIComponent(`${line1}\n${line2}`)
    if (digits) {
      window.open(`https://wa.me/${digits}?text=${message}`, '_blank', 'noopener,noreferrer')
      return
    }
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  const add = () => {
    addItem({ productId: product.productId, name: product.name, price: product.offerPrice || product.price || 0, qty, image: product.images?.[0] })
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  const buyNow = () => {
    addItem({ productId: product.productId, name: product.name, price: product.offerPrice || product.price || 0, qty, image: product.images?.[0] })
    router.push(route('/cart'))
  }

  return (
    <div className="space-y-4">
      {!isServiceBusiness && (
        <>
          {/* Quantity selector */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-600">Quantity</span>
            <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200"
              >
                <Minus size={14} />
              </button>
              <span className="flex h-11 min-w-[44px] items-center justify-center border-x border-slate-200 text-sm font-bold text-slate-900">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
                className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Add to cart + Buy Now buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={add}
              className={`flex-1 rounded-2xl px-4 py-4 text-sm font-bold transition-all duration-200 ${
                added
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'border-2 border-accent bg-white text-accent hover:-translate-y-0.5 hover:bg-accent/5 active:translate-y-0'
              }`}
            >
              {added ? (
                <span className="flex items-center justify-center gap-2">
                  <Check size={16} strokeWidth={2.5} />
                  Added!
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShoppingCart size={16} />
                  Add to cart
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={buyNow}
              className="flex-1 rounded-2xl bg-gradient-to-r from-accent to-blue-600 px-4 py-4 text-sm font-bold text-white shadow-md shadow-accent/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30 active:translate-y-0"
            >
              <span className="flex items-center justify-center gap-2">
                <Zap size={16} />
                Buy now
              </span>
            </button>
          </div>
        </>
      )}

      {isServiceBusiness && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Service enquiry</p>
          <button
            type="button"
            onClick={openWhatsAppEnquiry}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-4 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            <span className="flex items-center justify-center gap-2">
              <MessageCircle size={16} />
              Enquire now
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
