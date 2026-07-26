import { cookies, headers } from 'next/headers'
import config from '../config'

export type TenantConfig = {
  tenantId: string
  routePrefix: string
  hostName: string
  businessName: string
  whatsappNumber: string
  gsheetId: string
  currency: string
  logoUrl: string
  deliveryCharge: number
}

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

function normalize(value: string) {
  return String(value || '').trim().toLowerCase()
}

function tenantFromPathLike(pathLike: string) {
  const pathname = String(pathLike || '').split('?')[0]
  const first = normalize(pathname.split('/').filter(Boolean)[0] || '')
  if (!first || RESERVED_FIRST_SEGMENTS.has(first)) return ''
  return first
}

/** Call from Server Components and Route Handlers only */
export async function getTenantConfig(): Promise<TenantConfig> {
  const h = await headers()
  const c = await cookies()

  const defaultTenant = normalize(
    process.env.DEFAULT_TENANT_CODE || process.env.NEXT_PUBLIC_DEFAULT_TENANT_CODE || ''
  )

  const tenantHeader = normalize(h.get('x-tenant-slug-candidate') || '')
  const tenantCookie = normalize(c.get('tenant_slug')?.value || '')
  const routePrefixHeader = String(h.get('x-tenant-path-prefix') || '').trim()
  const routePrefixCookie = String(c.get('tenant_path_prefix')?.value || '').trim()

  const refererRaw = String(h.get('referer') || '')
  let refererTenant = ''
  if (refererRaw) {
    try {
      const ref = new URL(refererRaw)
      refererTenant = tenantFromPathLike(ref.pathname)
    } catch {
      refererTenant = ''
    }
  }

  const routePrefix = routePrefixHeader || routePrefixCookie || ''
  const tenantFromPrefix = tenantFromPathLike(routePrefix)

  const tenantId = tenantHeader || tenantCookie || tenantFromPrefix || refererTenant || defaultTenant
  const hostName = normalize(h.get('x-tenant-host') || h.get('host') || '')

  // These values are fallback placeholders until DB-backed tenant settings are loaded.
  const gsheetId = config.gsheetId
  const businessName = config.businessName
  const whatsapp = config.whatsappNumber
  const currency = config.currency
  const logoUrl = config.logo
  const delivery = config.deliveryCharge

  return {
    tenantId,
    routePrefix,
    hostName,
    businessName,
    whatsappNumber: whatsapp,
    gsheetId,
    currency,
    logoUrl,
    deliveryCharge: delivery,
  }
}
