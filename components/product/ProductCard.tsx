import Link from 'next/link'

type Product = {
  productId: string
  name: string
  brand?: string
  category?: string
  image?: string
  images?: string[]
  offerPrice: number
  price: number
  discount?: number
  description?: string
}

export default function ProductCard({ product }: { product: Product }) {
  const imageSrc = product.image ?? product.images?.[0] ?? '/placeholder.svg'

  return (
    <article className="group overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-lg transition duration-300 will-change-transform hover:-translate-y-1 hover:shadow-2xl animate-fade-up">
      <Link href={`/product/${product.productId}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-100 transition duration-300 group-hover:scale-[1.02]">
          <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/90 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-900 shadow-sm">
            {product.category ?? 'New'}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
              <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-500">{product.brand ?? 'Premium'}</p>
            </div>
            {product.discount ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {product.discount}% off
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-base font-semibold text-slate-900">₹{product.offerPrice}</span>
            <span className="text-sm text-slate-500 line-through">₹{product.price}</span>
          </div>
          <p className="mt-3 min-h-[2.5rem] text-sm leading-5 text-slate-600 line-clamp-2">{product.description ?? 'Shop this fan-favorite item with style and comfort.'}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Ready to ship</span>
            <span className="rounded-full bg-gradient-to-r from-accent/15 via-cyan-100 to-fuchsia-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Buy</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
