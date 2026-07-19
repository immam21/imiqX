import { NextResponse } from 'next/server'
import { fetchProducts } from '../../../services/productService'

export async function GET(request: Request) {
  try {
    const products = await fetchProducts()
    return NextResponse.json({ products })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 })
  }
}
