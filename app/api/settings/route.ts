import { NextResponse } from 'next/server'
import { fetchSettings } from '../../../services/productService'
import { getTenantConfig } from '../../../lib/tenant'
import { getTenantBusinessProfile, getTenantEntitlements, getTenantRowFromRequest, getTenantSettings } from '../../../lib/tenantDb'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

export async function GET(request: Request) {
  try {
    const tenant = await getTenantConfig()
    const settings = await fetchSettings(tenant.gsheetId)
    const tenantRow = await getTenantRowFromRequest().catch(() => null)
    const tenantSettings = tenantRow ? await getTenantSettings(tenantRow.id).catch(() => ({} as Record<string, string>)) : {}
    const tenantProfile = tenantRow ? await getTenantBusinessProfile(tenantRow.id).catch(() => null) : null
    const entitlements = tenantRow ? await getTenantEntitlements(tenantRow.id).catch(() => null) : null
    const businessType = String(tenantSettings.BusinessType || tenantSettings.businessType || 'ecommerce_product').trim().toLowerCase() === 'ecommerce_services'
      ? 'ecommerce_services'
      : 'ecommerce_product'

    const businessName =
      settings.businessName?.trim() ||
      tenantProfile?.business_name?.trim() ||
      tenantRow?.business_name?.trim() ||
      toDisplayName(tenantRow?.tenant_code || tenant.tenantId || '')

    const whatsappNumber =
      settings.whatsappNumber?.trim() ||
      tenantRow?.whatsapp_number?.trim() ||
      tenant.whatsappNumber ||
      ''

    const logoUrl =
      settings.logoUrl ||
      tenantProfile?.logo_url?.trim() ||
      tenantRow?.logo_url?.trim() ||
      ''

    return NextResponse.json({
      deliveryCharge: settings.deliveryCharge || tenant.deliveryCharge,
      logoUrl,
      tenantId: tenant.tenantId,
      routePrefix: tenant.routePrefix,
      businessName,
      whatsappNumber,
      themePreset: settings.themePreset || 'classic',
      businessType,
      subscription: entitlements ? {
        planId: entitlements.planId,
        planCode: entitlements.planCode,
        planName: entitlements.planName,
        features: entitlements.features,
        limits: entitlements.limits,
      } : null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { deliveryCharge: 40, logoUrl: '', tenantId: '', routePrefix: '', businessName: '', whatsappNumber: '', themePreset: 'classic', businessType: 'ecommerce_product', subscription: null, error: err.message },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  }
}
