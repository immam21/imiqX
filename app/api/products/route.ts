import { NextResponse } from 'next/server'
import { fetchProducts } from '../../../services/productService'
import { getTenantConfig } from '../../../lib/tenant'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantConfig()
    const products = await fetchProducts(tenant.gsheetId)
    return NextResponse.json({ products })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 })
  }
}
