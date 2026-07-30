import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { fetchProducts } from '../../../services/productService'
import { getTenantConfig } from '../../../lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantConfig()
    const tenantId = tenant.tenantId || 'default'

    // unstable_cache: shared across all Vercel serverless instances (Vercel Data Cache)
    const products = await unstable_cache(
      () => fetchProducts(tenant.gsheetId),
      [`products:${tenantId}`],
      { revalidate: 30, tags: [`tenant:${tenantId}`, 'products'] }
    )()

    return NextResponse.json({ products }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 })
  }
}
