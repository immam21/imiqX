import { NextResponse } from 'next/server'
import { fetchProducts } from '../../../services/productService'
import { getTenantConfig } from '../../../lib/tenant'

export const revalidate = 30

export async function GET(request: Request) {
  try {
    const tenant = await getTenantConfig()

    const products = await fetchProducts(tenant.gsheetId)

    return NextResponse.json({ products }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 })
  }
}
