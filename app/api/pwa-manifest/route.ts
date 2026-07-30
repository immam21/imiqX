import { getTenantConfig } from '../../../lib/tenant'
import { getTenantBusinessProfile, getTenantRowFromRequest, getTenantSettings } from '../../../lib/tenantDb'
import { toRenderableAssetUrl } from '../../../lib/assetUrl'
import { getCached, setCached, TTL } from '../../../lib/serverCache'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

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

function toShortName(input: string) {
  const name = String(input || '').trim()
  if (!name) return 'Store'
  return name.length > 12 ? name.slice(0, 12).trim() : name
}

export async function GET() {
  const h = await headers()
  const tenantSource = String(h.get('x-tenant-source') || '').trim().toLowerCase()
  const tenantSlugCandidate = String(h.get('x-tenant-slug-candidate') || '').trim()
  const strictStorefrontTenant = tenantSource === 'path' || tenantSource === 'host'

  // Serve from cache if available (2 min TTL) — avoids repeated Supabase calls
  const cacheKey = `${tenantSlugCandidate || 'default'}:manifest`
  const cachedManifest = getCached<string>(cacheKey)
  if (cachedManifest) {
    return new Response(cachedManifest, {
      headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=120', 'X-Cache': 'HIT' },
    })
  }

  const tenant = await getTenantConfig().catch(() => null)
  const tenantRow = await getTenantRowFromRequest().catch(() => null)
  const tenantProfile = tenantRow ? await getTenantBusinessProfile(tenantRow.id).catch(() => null) : null
  const tenantKv = tenantRow ? await getTenantSettings(tenantRow.id).catch(() => ({} as Record<string, string>)) : {}

  const sourceName =
    tenantProfile?.business_name?.trim() ||
    tenantRow?.business_name?.trim() ||
    (strictStorefrontTenant ? toDisplayName(tenantSlugCandidate) : '') ||
    tenant?.businessName ||
    tenant?.tenantId ||
    'Storefront'

  const rawLogoUrl =
    String(tenantKv.LogoURL || tenantKv.logoUrl || '').trim() ||
    tenantProfile?.logo_url?.trim() ||
    tenantRow?.logo_url?.trim() ||
    tenant?.logoUrl ||
    ''

  const tenantLogoUrl = rawLogoUrl ? toRenderableAssetUrl(rawLogoUrl) : ''

  const businessName = toDisplayName(sourceName)
  const shortName = toShortName(businessName)
  const routePrefix = String(tenant?.routePrefix || '').trim() || '/'
  // Unique per-tenant id — this is what browsers use to decide if a PWA is already installed.
  // Without this, all tenants on the same domain appear as the same app.
  const tenantSlug = String(tenantRow?.tenant_code || tenantSlugCandidate || tenant?.tenantId || 'default').trim().toLowerCase()
  const manifestId = routePrefix === '/' ? '/' : `${routePrefix}/`

  const manifest = {
    id: manifestId,
    name: businessName,
    short_name: shortName,
    description: `Shop secure, verified products from ${businessName}.`,
    start_url: routePrefix,
    scope: routePrefix === '/' ? '/' : `${routePrefix}/`,
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#2563EB',
    background_color: '#F8FAFC',
    categories: ['shopping', 'lifestyle'],
    lang: 'en',
    icons: [
      // Tenant logo — listed first so the browser picks it as the install icon.
      ...(tenantLogoUrl
        ? [
            {
              src: tenantLogoUrl,
              sizes: 'any',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: tenantLogoUrl,
              sizes: 'any',
              type: 'image/png',
              purpose: 'maskable',
            },
          ]
        : []),
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Browse Products',
        short_name: 'Products',
        url: `${routePrefix === '/' ? '' : routePrefix}/search`,
        description: 'Search and browse all products',
        icons: [{ src: tenantLogoUrl || '/icons/icon-192.png', sizes: tenantLogoUrl ? 'any' : '192x192' }],
      },
      {
        name: 'Track Order',
        short_name: 'Track',
        url: `${routePrefix === '/' ? '' : routePrefix}/track-order`,
        description: 'Track your latest order updates',
        icons: [{ src: tenantLogoUrl || '/icons/icon-192.png', sizes: tenantLogoUrl ? 'any' : '192x192' }],
      },
    ],
    prefer_related_applications: false,
  }

  const manifestJson = JSON.stringify(manifest)
  setCached(cacheKey, manifestJson, TTL.MANIFEST)

  return new Response(manifestJson, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Cache': 'MISS',
    },
  })
}
