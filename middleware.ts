import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const RESERVED_FIRST_SEGMENTS = new Set([
  'api',
  '_next',
  'favicon.ico',
  'icons',
  'manifest.json',
  'sw.js',
  'offline.html',
  'admin',
  'platform-admin',
])

const SHARED_STOREFRONT_SEGMENTS = new Set(['search', 'products', 'product', 'cart', 'checkout', 'track-order'])

function normalizeHost(hostname: string) {
  return String(hostname || '').split(':')[0].trim().toLowerCase()
}

function isLocalHost(host: string) {
  const normalized = normalizeHost(host)
  return normalized === 'localhost' || normalized.startsWith('localhost.') || normalized.endsWith('.localhost')
}

const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000
const domainTenantCache = new Map<string, { tenantSlug: string; expiresAt: number }>()

async function resolveTenantFromMappedDomain(hostname: string): Promise<string | null> {
  const host = normalizeHost(hostname)
  if (!host || isLocalHost(host)) return null

  const cached = domainTenantCache.get(host)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenantSlug || null
  }

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()
  if (!supabaseUrl || !serviceRoleKey) return null

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  }

  const loadTenantId = async (column: 'host' | 'domain') => {
    const lookupUrl = `${supabaseUrl}/rest/v1/tenant_domains?select=tenant_id,is_verified,${column}&${column}=eq.${encodeURIComponent(host)}&is_verified=eq.true&limit=1`
    const response = await fetch(lookupUrl, { headers, cache: 'no-store' })
    if (!response.ok) {
      const message = await response.text()
      return { tenantId: '', missingColumn: /column .* does not exist/i.test(message || '') }
    }
    const rows = (await response.json().catch(() => [])) as Array<{ tenant_id?: string }>
    return { tenantId: String(rows?.[0]?.tenant_id || '').trim(), missingColumn: false }
  }

  let tenantId = ''
  const byHost = await loadTenantId('host')
  tenantId = byHost.tenantId
  if (!tenantId && byHost.missingColumn) {
    const byDomain = await loadTenantId('domain')
    tenantId = byDomain.tenantId
  }

  if (!tenantId) {
    domainTenantCache.set(host, { tenantSlug: '', expiresAt: Date.now() + DOMAIN_CACHE_TTL_MS })
    return null
  }

  const tenantUrl = `${supabaseUrl}/rest/v1/tenants?select=tenant_code,id&id=eq.${encodeURIComponent(tenantId)}&limit=1`
  const tenantResponse = await fetch(tenantUrl, { headers, cache: 'no-store' })
  if (!tenantResponse.ok) return null

  const tenantRows = (await tenantResponse.json().catch(() => [])) as Array<{ tenant_code?: string }>
  const tenantSlug = String(tenantRows?.[0]?.tenant_code || '').trim().toLowerCase()
  if (!tenantSlug) return null

  domainTenantCache.set(host, { tenantSlug, expiresAt: Date.now() + DOMAIN_CACHE_TTL_MS })
  return tenantSlug
}

function resolveTenantFromHost(hostname: string): string | null {
  const cleanHost = hostname.split(':')[0].toLowerCase()
  const hostParts = cleanHost.split('.')
  const subdomain = hostParts[0]

  const isSubdomain =
    hostParts.length > 1 &&
    subdomain &&
    !['www', 'localhost', 'vercel'].includes(subdomain) &&
    !cleanHost.startsWith('localhost')

  if (isSubdomain) return subdomain
  return null
}

function resolveTenantFromPath(pathname: string): { tenantSlug: string | null; rewrittenPath: string | null } {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 1) return { tenantSlug: null, rewrittenPath: null }

  const first = segments[0].toLowerCase()
  if (RESERVED_FIRST_SEGMENTS.has(first)) return { tenantSlug: null, rewrittenPath: null }

  const passthrough = segments.slice(1)

  let rewrittenPath = passthrough.length ? `/${passthrough.join('/')}` : '/storefront'
  // Friendly alias: /{tenant}/products -> /search and /{tenant}/products/{id} -> /product/{id}
  if (passthrough[0] === 'products') {
    if (passthrough.length <= 1) rewrittenPath = '/search'
    else rewrittenPath = `/product/${passthrough.slice(1).join('/')}`
  }

  return { tenantSlug: first, rewrittenPath }
}

function resolveStorefrontPathForHostTenant(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return '/storefront'

  const first = segments[0].toLowerCase()
  if (RESERVED_FIRST_SEGMENTS.has(first)) return null

  if (first === 'products') {
    if (segments.length <= 1) return '/search'
    return `/product/${segments.slice(1).join('/')}`
  }

  if (SHARED_STOREFRONT_SEGMENTS.has(first)) {
    return `/${segments.join('/')}`
  }

  return null
}

function isSharedStorefrontHost(hostname: string) {
  const host = normalizeHost(hostname)
  if (!host) return false
  if (host === 'localhost' || host.startsWith('localhost.')) return true
  if (host.endsWith('.localhost')) return true

  const platformDomain = normalizeHost(process.env.PLATFORM_BASE_DOMAIN || process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || '')
  if (!platformDomain) return false
  return host === platformDomain || host === `www.${platformDomain}`
}

function getDefaultTenantSlug() {
  return String(
    process.env.DEFAULT_TENANT_CODE ||
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_CODE ||
    ''
  )
    .trim()
    .toLowerCase()
}

function shouldRedirectToTenantPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const first = (segments[0] || '').toLowerCase()
  if (RESERVED_FIRST_SEGMENTS.has(first)) return false
  return SHARED_STOREFRONT_SEGMENTS.has(first)
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl
  const sharedHost = isSharedStorefrontHost(hostname)
  const pathTenant = resolveTenantFromPath(pathname)

  // Platform admin is global and must not be served via tenant-prefixed URLs.
  if (pathTenant.tenantSlug && pathTenant.rewrittenPath === '/platform-admin') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/platform-admin'
    return NextResponse.redirect(redirectUrl)
  }

  const mappedDomainTenant = await resolveTenantFromMappedDomain(hostname)
  const hostTenant = mappedDomainTenant || resolveTenantFromHost(hostname)
  let refererTenant = ''
  if (sharedHost && pathname.startsWith('/api/')) {
    const referer = request.headers.get('referer') || ''
    if (referer) {
      try {
        const refPath = new URL(referer).pathname
        refererTenant = resolveTenantFromPath(refPath).tenantSlug || ''
      } catch {
        refererTenant = ''
      }
    }
  }
  const cookieTenant = request.cookies.get('tenant_slug')?.value?.toLowerCase()
  const defaultTenant = getDefaultTenantSlug()
  const fallbackTenant = sharedHost
    ? (refererTenant || cookieTenant || defaultTenant || '')
    : (cookieTenant || '')

  // Keep tenant prefix visible and canonical on shared-domain storefront URLs.
  if (!pathTenant.tenantSlug && fallbackTenant && sharedHost && shouldRedirectToTenantPath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/${fallbackTenant}${pathname === '/' ? '' : pathname}`
    return NextResponse.redirect(redirectUrl)
  }

  const tenantSlug = pathTenant.tenantSlug || hostTenant || fallbackTenant || ''
  const pathPrefix = pathTenant.tenantSlug
    ? `/${pathTenant.tenantSlug}`
    : (sharedHost && tenantSlug ? `/${tenantSlug}` : '')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-slug-candidate', tenantSlug)
  requestHeaders.set('x-tenant-source', pathTenant.tenantSlug ? 'path' : hostTenant ? 'host' : cookieTenant ? 'cookie' : 'none')
  requestHeaders.set('x-tenant-host', normalizeHost(hostname))
  requestHeaders.set('x-tenant-path-prefix', pathPrefix)
  requestHeaders.set('x-tenant-original-path', pathname)

  const hostTenantRewrite = !pathTenant.rewrittenPath && hostTenant
    ? resolveStorefrontPathForHostTenant(pathname)
    : null

  const response = (pathTenant.rewrittenPath || hostTenantRewrite)
    ? NextResponse.rewrite(
        (() => {
          const rewrittenUrl = request.nextUrl.clone()
          rewrittenUrl.pathname = (pathTenant.rewrittenPath || hostTenantRewrite) as string
          return rewrittenUrl
        })(),
        { request: { headers: requestHeaders } }
      )
    : NextResponse.next({ request: { headers: requestHeaders } })

  if (process.env.NODE_ENV !== 'production') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  if (tenantSlug) {
    response.cookies.set('tenant_slug', tenantSlug, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  response.cookies.set('tenant_path_prefix', pathPrefix, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}

export const config = {
  // Run on all routes except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|offline.html).*)'],
}
