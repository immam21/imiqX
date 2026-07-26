import { NextResponse } from 'next/server'
import { validateCoupon } from '../../../services/productService'
import { getTenantConfig } from '../../../lib/tenant'
import { getTenantEntitlements, getTenantRowFromRequest } from '../../../lib/tenantDb'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim().toUpperCase() ?? ''
  if (!code) return NextResponse.json({ error: 'Coupon code required' }, { status: 400 })

  const tenantRow = await getTenantRowFromRequest().catch(() => null)
  if (tenantRow) {
    const entitlements = await getTenantEntitlements(tenantRow.id).catch(() => null)
    if (entitlements && entitlements.features.coupons === false) {
      return NextResponse.json({ error: 'Coupons are not available for this subscription plan' }, { status: 403 })
    }
  }

  const tenant = await getTenantConfig()
  const coupon = await validateCoupon(code, tenant.gsheetId)
  if (!coupon) return NextResponse.json({ error: 'Invalid or expired coupon' }, { status: 404 })
  return NextResponse.json({ coupon })
}
