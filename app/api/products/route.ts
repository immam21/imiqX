import { NextResponse } from 'next/server'
import { fetchProducts } from '../../../services/productService'
import { getTenantConfig } from '../../../lib/tenant'
import { getCached, setCached, TTL } from '../../../lib/serverCache'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantConfig()
    const tenantId = tenant.tenantId || 'default'
    const cacheKey = `${tenantId}:products`

    const cached = getCached<object[]>(cacheKey)
    if (cached) {
      return NextResponse.json({ products: cached }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60', 'X-Cache': 'HIT' },
      })
    }

    const products = await fetchProducts(tenant.gsheetId)
    setCached(cacheKey, products, TTL.PRODUCTS)
    return NextResponse.json({ products }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60', 'X-Cache': 'MISS' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 })
  }
}
