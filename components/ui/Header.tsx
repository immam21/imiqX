'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { Search, ShoppingCart, Menu, X, Download, PackageSearch } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { toRenderableAssetUrl } from '../../lib/assetUrl'

interface HeaderProps {
  initials: string
  businessName: string
  logo: string
  routePrefix?: string
  announcementMessages?: string[]
}

export default function Header({ initials, businessName, logo, routePrefix = '', announcementMessages = [] }: HeaderProps) {
  const route = (path: string) => `${routePrefix}${path}`
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const { totalItems } = useCart()
  const normalizedLogo = toRenderableAssetUrl(logo)

  // ── PWA install prompt ────────────────────────────────────────────────────
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  // `mounted` prevents the install button from rendering on the server so the
  // initial client HTML always matches the SSR output (no hydration mismatch).
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    )
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    window.addEventListener('appinstalled', () => setIsStandalone(true))
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  useEffect(() => {
    setLogoFailed(false)
  }, [normalizedLogo])

  useEffect(() => {
    // Retry logo load on route changes in case previous request failed transiently.
    setLogoFailed(false)
  }, [pathname])

  const showInstall = mounted && !isStandalone

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setInstallPrompt(null)
    } else {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())
      if (isIOS) {
        alert('To install:\n1. Tap the Share button (□↑) at the bottom of Safari\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"')
      } else {
        alert('To install:\n1. Open this site in Chrome or Edge\n2. Tap the menu (⋮) in the top-right corner\n3. Tap "Install App" or "Add to Home Screen"')
      }
    }
  }

  const DEFAULT_ANNOUNCEMENTS = [
    '⚡ Fast dispatch on trusted orders',
    '🛡️ Protected checkout with secure payment flow',
    '✅ 100% authentic products from verified sources',
    '🚚 Reliable 1-3 day delivery updates',
  ]

  const sanitizeAnnouncement = (value: string) => value
    .replace(/\btenant-?isolated storefront\b/gi, 'secure storefront')
    .replace(/\bstore-?isolated storefront\b/gi, 'secure storefront')
    .replace(/\btenant\b/gi, 'store')
    .replace(/\bsupabase\b/gi, '')
    .replace(/\bvercel\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const customAnnouncements = announcementMessages
    .map((msg) => sanitizeAnnouncement(msg))
    .filter((msg) => msg.length > 0)
    .slice(0, 4)
  const msgs = customAnnouncements.length > 0 ? customAnnouncements : DEFAULT_ANNOUNCEMENTS
  // doubled for seamless infinite loop
  const tickerItems = [...msgs, ...msgs]

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Keep ticker HTML deterministic between SSR and hydration. */}
      <div className="min-h-[30px] overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-teal-600 py-2 text-xs font-medium text-white select-none">
        <div className="animate-ticker">
          {tickerItems.map((msg, i) => (
            <span key={i} className="flex items-center whitespace-nowrap">
              <span className="px-8">{msg}</span>
              <span className="opacity-40" aria-hidden>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <nav className="border-b border-cyan-100/70 bg-white/82 backdrop-blur-xl shadow-[0_10px_30px_rgba(14,116,144,0.10)]">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 lg:gap-6">

          {/* Logo */}
          <Link href={route('/')} className="flex shrink-0 items-center gap-3 rounded-2xl px-1 py-1" aria-label="Home">
            {normalizedLogo && !logoFailed ? (
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-[0_10px_24px_rgba(14,116,144,0.14)]">
                <img
                  src={normalizedLogo}
                  alt={businessName}
                  className="h-full w-full object-contain"
                  onError={() => setLogoFailed(true)}
                />
              </div>
            ) : (
              <div
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-500 via-blue-600 to-teal-500 text-sm font-extrabold text-white shadow-md shadow-cyan-500/30"
                title="Upload your brand logo in Admin Settings to replace this placeholder"
              >
                {initials}
                <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-white bg-slate-900 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                  logo
                </span>
              </div>
            )}
            <div className="leading-none">
              <div className="max-w-[170px] truncate text-[13px] font-bold text-slate-900 sm:max-w-none sm:text-[15px]">{businessName}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Official Store</div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-0.5 text-sm ml-2">
            <Link href={route('/')} className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Home
            </Link>
            <Link href={route('/search')} className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Products
            </Link>
            <Link href={route('/track-order')} className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Track Order
            </Link>
            <Link href={route('/admin')} className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Store Access
            </Link>
          </div>

          {/* Desktop search bar */}
          <div className="relative hidden flex-1 md:block">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
              <Search size={15} />
            </div>
            <input
              placeholder="Search products, brands & categories…"
              aria-label="Search products"
              className="w-full rounded-full border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/15 placeholder:text-slate-400"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Install App (desktop — hidden once app is installed) */}
            {showInstall && (
              <button
                onClick={handleInstall}
                aria-label="Install App"
                title="Install App"
                className="hidden items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10 lg:flex"
              >
                <Download size={13} />
                Install App
              </button>
            )}

            {/* Mobile search */}
            <Link
              href={route('/search')}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-accent md:hidden"
            >
              <Search size={18} />
            </Link>

            {/* Cart */}
            <Link
              href={route('/cart')}
              aria-label={`View cart${totalItems ? ` (${totalItems} items)` : ''}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-accent"
            >
              <ShoppingCart size={19} />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 lg:hidden"
            >
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
            <nav className="space-y-0.5">
              {[
                { label: 'Home', href: route('/'), icon: null },
                { label: 'All Products', href: route('/search'), icon: null },
                { label: 'Track Order', href: route('/track-order'), icon: <PackageSearch size={16} /> },
                { label: 'Cart', href: route('/cart'), icon: <ShoppingCart size={16} /> },
                { label: 'Store Access', href: route('/admin'), icon: null },
              ].map(({ label, href, icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-accent"
                >
                  {icon && <span className="text-slate-400">{icon}</span>}
                  {label}
                  {label === 'Cart' && totalItems > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                      {totalItems}
                    </span>
                  )}
                </Link>
              ))}

              {showInstall && (
                <button
                  onClick={() => { handleInstall(); setMobileOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/5"
                >
                  <Download size={16} />
                  Install App
                </button>
              )}
            </nav>
          </div>
        )}
      </nav>
    </header>
  )
}
