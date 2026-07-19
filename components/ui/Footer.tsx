'use client'

import Link from 'next/link'

interface FooterProps {
  businessName: string
  initials: string
  whatsappNumber?: string
}

export default function Footer({ businessName, initials, whatsappNumber }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 text-slate-400">
      {/* Top section */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-blue-700 text-sm font-extrabold text-white shadow-md">
                {initials}
              </div>
              <span className="text-[15px] font-bold text-white">{businessName}</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6">
              Premium products, always in stock, with seamless WhatsApp checkout. No account needed.
            </p>

            {/* WhatsApp CTA */}
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#20b958]"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat on WhatsApp
              </a>
            )}
          </div>

          {/* Shop links */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-white">Shop</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/search" className="transition hover:text-white">All Products</Link></li>
              <li><Link href="/search" className="transition hover:text-white">New Arrivals</Link></li>
              <li><Link href="/search" className="transition hover:text-white">Best Sellers</Link></li>
              <li><Link href="/search" className="transition hover:text-white">Deals &amp; Offers</Link></li>
            </ul>
          </div>

          {/* Support links */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-white">Support</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                {whatsappNumber
                  ? <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">Contact Us</a>
                  : <span>Contact Us</span>
                }
              </li>
              <li><Link href="/track-order" className="transition hover:text-white">Track Order</Link></li>
              <li><span className="cursor-default">Returns &amp; Refunds</span></li>
              <li><span className="cursor-default">FAQ</span></li>
            </ul>
          </div>
        </div>

        {/* Trust bar */}
        <div className="mt-10 flex flex-wrap justify-center gap-6 border-y border-slate-800 py-7">
          {[
            { icon: '🔒', label: 'Secure Checkout' },
            { icon: '🚀', label: 'Fast Delivery' },
            { icon: '↩️', label: 'Easy Returns' },
            { icon: '🏅', label: '100% Authentic' },
            { icon: '💬', label: 'WhatsApp Support' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="text-base">{icon}</span>
              {label}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 text-xs sm:flex-row">
          <p>© {year} {businessName}. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <span className="cursor-default transition hover:text-white">Privacy Policy</span>
            <span className="cursor-default transition hover:text-white">Terms of Service</span>
            <span className="flex items-center gap-1 text-slate-500">
              Made with ❤️ in India
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
