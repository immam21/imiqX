import React from 'react'
import { ShoppingCart, ArrowRight } from 'lucide-react'

function getTenantPrefix() {
  if (typeof document === 'undefined') return ''
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('tenant_path_prefix='))
    ?.split('=')[1]
  const prefix = decodeURIComponent(raw || '').trim()
  return prefix && prefix !== '/' ? prefix : ''
}

export default function StickyCartBar({ items = 0, total = 0 }: { items?: number; total?: number }) {
  if (items === 0) return null
  const tenantPrefix = getTenantPrefix()
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:w-auto">
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/95 px-5 py-3.5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
            <ShoppingCart size={15} />
          </div>
          <div>
            <p className="text-[11px] font-semibold leading-none text-slate-400">{items} item{items !== 1 ? 's' : ''}</p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900">₹{total}</p>
          </div>
        </div>
        <a
          href={`${tenantPrefix}/cart`}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-accent/25"
        >
          View Cart
          <ArrowRight size={13} />
        </a>
      </div>
    </div>
  )
}
