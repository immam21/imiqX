import './globals.css'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google'
import AppShell from '../components/AppShell'
import PWAProvider from '../components/PWAProvider'
import config from '../config'
import { fetchSettings } from '../services/productService'
import { getTenantConfig } from '../lib/tenant'
import { getTenantRowFromRequest, getTenantSubscriptionAccess, getTenantBusinessProfile, getTenantSettings } from '../lib/tenantDb'
import { headers } from 'next/headers'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
})

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const tenantSource = (h.get('x-tenant-source') || '').trim().toLowerCase()
  const tenantSlugCandidate = (h.get('x-tenant-slug-candidate') || '').trim()
  const strictStorefrontTenant = tenantSource === 'path' || tenantSource === 'host'

  const tenant = await getTenantConfig().catch(() => null)
  const tenantRow = await getTenantRowFromRequest().catch(() => null)
  const resolvedBusinessName =
    tenantRow?.business_name?.trim() ||
    (strictStorefrontTenant ? (tenantSlugCandidate || 'Storefront') : (tenant?.businessName || 'Storefront'))

  return {
    title: resolvedBusinessName,
    description: `Shop secure, verified products from ${resolvedBusinessName}.`,
    applicationName: resolvedBusinessName,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: resolvedBusinessName,
    },
    formatDetection: { telephone: false },
    openGraph: {
      title: resolvedBusinessName,
      description: `Shop secure, verified products from ${resolvedBusinessName}.`,
    },
  }
}

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

export const revalidate = 300 // cache layout data for 5 minutes
export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === 'production'
  const h = await headers()
  const currentPath = (h.get('x-tenant-original-path') || '').trim()
  const isPlatformAdminPath = currentPath === '/platform-admin' || currentPath.startsWith('/platform-admin/')
  const tenantSource = (h.get('x-tenant-source') || '').trim().toLowerCase()
  const tenantSlugCandidate = (h.get('x-tenant-slug-candidate') || '').trim()
  const strictStorefrontTenant = tenantSource === 'path' || tenantSource === 'host'
  // Keep platform root deterministic on shared hosts (localhost/platform domain)
  // while still allowing host-mapped tenant domains to render storefront at '/'.
  const isPlatformLanding = currentPath === '/' && tenantSource !== 'host'
  const devCacheCleanupScript = `
    (function () {
      if (typeof window === 'undefined') return;
      if (window.sessionStorage.getItem('__imiqx_dev_cache_cleared__') === '1') return;
      window.sessionStorage.setItem('__imiqx_dev_cache_cleared__', '1');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        }).catch(function () {});
      }
      if ('caches' in window) {
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }).catch(function () {});
      }
    })();
  `

  if (isPlatformLanding) {
    return (
      <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
        <head>
          {!isProd && <script dangerouslySetInnerHTML={{ __html: devCacheCleanupScript }} />}
          {/* Keep PWA wiring production-only to avoid stale chunk/runtime issues in dev. */}
          {isProd && (
            <>
              <link rel="manifest" href="/api/pwa-manifest" />
              <meta name="theme-color" content={config.theme.accent} />
              <meta name="mobile-web-app-capable" content="yes" />
              <meta name="msapplication-TileColor" content={config.theme.accent} />

              {/* Apple PWA */}
              <meta name="apple-mobile-web-app-capable" content="yes" />
              <meta name="apple-mobile-web-app-status-bar-style" content="default" />
              <meta name="apple-mobile-web-app-title" content={config.businessName} />
              <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
            </>
          )}

          {/* Favicons */}
          <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />
        </head>
        <body className={`min-h-screen bg-[#F8FAFC] text-slate-900 safe-area ${jakarta.className}`}>
          <main>{children}</main>
        </body>
      </html>
    )
  }

  if (isPlatformAdminPath) {
    return (
      <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
        <head>
          {!isProd && <script dangerouslySetInnerHTML={{ __html: devCacheCleanupScript }} />}
        </head>
        <body className={`min-h-screen bg-[#F8FAFC] text-slate-900 safe-area ${jakarta.className}`}>
          <main>{children}</main>
        </body>
      </html>
    )
  }

  const tenant = await getTenantConfig()
  let tenantRowErrorMessage = ''
  const tenantRow = await getTenantRowFromRequest().catch((error) => {
    tenantRowErrorMessage = error instanceof Error ? error.message : String(error || '')
    return null
  })
  const tenantProfile = tenantRow ? await getTenantBusinessProfile(tenantRow.id).catch(() => null) : null
  const tenantAccess = tenantRow ? await getTenantSubscriptionAccess(tenantRow.id).catch(() => null) : null
  const tenantKv = tenantRow ? await getTenantSettings(tenantRow.id).catch(() => ({} as Record<string, string>)) : {}
  const storefrontRestricted = tenant.routePrefix
    ? currentPath === tenant.routePrefix || currentPath.startsWith(`${tenant.routePrefix}/`)
    : false
  const allowIfAdminPath = currentPath.endsWith('/admin') || currentPath.includes('/admin/') || currentPath.startsWith('/platform-admin')
  const tenantLookupTransient = /fetch failed|network|econn|enotfound|etimedout|temporary/i.test(tenantRowErrorMessage)

  if (!tenantRow && strictStorefrontTenant && !allowIfAdminPath) {
    return (
      <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
        <head>
          {!isProd && <script dangerouslySetInnerHTML={{ __html: devCacheCleanupScript }} />}
        </head>
        <body className={`min-h-screen bg-[#0B1020] text-slate-100 safe-area ${jakarta.className}`}>
          <main className="flex min-h-screen items-center justify-center px-4 py-14">
            <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-sm">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl">⚠️</div>
              <h1 className="text-2xl font-extrabold text-white">{tenantLookupTransient ? 'Store Temporarily Unavailable' : 'Store Not Available'}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {tenantLookupTransient
                  ? 'We could not verify this storefront right now due to a temporary connection issue with backend services. Please retry shortly.'
                  : 'This storefront URL is no longer active or does not exist. Please contact platform admin if you believe this is a mistake.'}
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300">
                <p><span className="text-slate-400">Requested store:</span> {tenantSlugCandidate || tenant.tenantId || 'Unknown'}</p>
                <p className="mt-1"><span className="text-slate-400">Path:</span> {currentPath || '/'}</p>
                {tenantLookupTransient ? (
                  <p className="mt-1"><span className="text-slate-400">Reason:</span> Temporary backend connectivity issue</p>
                ) : null}
              </div>
            </div>
          </main>
        </body>
      </html>
    )
  }

  if (tenantRow && tenantAccess && !tenantAccess.hasAccess && storefrontRestricted && !allowIfAdminPath) {
    return (
      <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
        <head>
          {!isProd && <script dangerouslySetInnerHTML={{ __html: devCacheCleanupScript }} />}
        </head>
        <body className={`min-h-screen bg-[#0B1020] text-slate-100 safe-area ${jakarta.className}`}>
          <main className="flex min-h-screen items-center justify-center px-4 py-14">
            <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-sm">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-2xl">🔒</div>
              <h1 className="text-2xl font-extrabold text-white">Store Access Locked</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your subscription is currently inactive or expired, so this store URL is temporarily disabled.
                Please contact platform admin to unlock your store access.
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300">
                <p><span className="text-slate-400">Tenant:</span> {tenantRow.business_name || tenant.businessName}</p>
                <p className="mt-1"><span className="text-slate-400">Status:</span> {String(tenantAccess.status || tenantAccess.reason)}</p>
                <p className="mt-1"><span className="text-slate-400">Expiry:</span> {tenantAccess.expiryAt ? new Date(tenantAccess.expiryAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not available'}</p>
              </div>
              <p className="mt-4 text-xs text-slate-500">Platform admin can reactivate by updating tenant subscription plan and expiry.</p>
            </div>
          </main>
        </body>
      </html>
    )
  }

  const settings = await fetchSettings(tenant.gsheetId).catch(() => ({
    businessName: '', businessAddress: '', whatsappNumber: '', themePreset: 'classic', offerLabel: '', offerTitle: '', offerSubtitle: '', announcementMessages: [] as string[], deliveryCharge: tenant.deliveryCharge, logoUrl: tenant.logoUrl,
  }))

  const businessName =
    settings.businessName?.trim() ||
    tenantProfile?.business_name?.trim() ||
    tenantRow?.business_name?.trim() ||
    (strictStorefrontTenant ? toDisplayName(tenantSlugCandidate || 'Storefront') : tenant.businessName)

  const manifestHref = `${tenant.routePrefix || ''}/api/pwa-manifest`

  const whatsappNumber =
    settings.whatsappNumber?.trim() ||
    tenantRow?.whatsapp_number?.trim() ||
    (strictStorefrontTenant ? '' : tenant.whatsappNumber)

  const businessAddress = settings.businessAddress?.trim() || ''

  const tenantLogoUrl =
    String(tenantKv.LogoURL || tenantKv.logoUrl || '').trim() ||
    settings.logoUrl ||
    tenantProfile?.logo_url?.trim() ||
    tenantRow?.logo_url?.trim() ||
    (strictStorefrontTenant ? '' : tenant.logoUrl)
  const tenantFaviconUrl = tenantLogoUrl || '/icons/icon-32.png'
  const faviconVersion = encodeURIComponent(String(tenantRow?.id || tenant.tenantId || businessName || 'tenant').trim())
  const tenantFaviconHref = `${tenantFaviconUrl}${tenantFaviconUrl.includes('?') ? '&' : '?'}v=${faviconVersion}`
  const initials = businessName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
      <head>
        {!isProd && <script dangerouslySetInnerHTML={{ __html: devCacheCleanupScript }} />}
        {/* Keep PWA wiring production-only to avoid stale chunk/runtime issues in dev. */}
        {isProd && (
          <>
            <link rel="manifest" href={manifestHref} />
            <meta name="theme-color" content={config.theme.accent} />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="msapplication-TileColor" content={config.theme.accent} />

            {/* Apple PWA */}
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="apple-mobile-web-app-title" content={businessName} />
            <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          </>
        )}

        {/* Favicons (tenant branded when logo is available) */}
        <link rel="icon" type="image/png" sizes="32x32" href={tenantFaviconHref} />
        <link rel="icon" type="image/png" sizes="16x16" href={tenantFaviconHref} />
      </head>
      <body className={`min-h-screen bg-[#F8FAFC] text-slate-900 safe-area ${jakarta.className}`}>
        <AppShell
          initials={initials}
          businessName={businessName}
          businessAddress={businessAddress}
          logo={tenantLogoUrl}
          whatsappNumber={whatsappNumber}
          themePreset={settings.themePreset}
          routePrefix={tenant.routePrefix}
          announcementMessages={settings.announcementMessages}
        >
          <main className="pt-[92px]">{children}</main>
          <PWAProvider />
        </AppShell>
      </body>
    </html>
  )
}
