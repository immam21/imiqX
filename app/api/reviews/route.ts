import { NextResponse } from 'next/server'
import { addReview, fetchReviews } from '../../../services/productService'
import { getTenantEntitlements, getTenantRowFromRequest } from '../../../lib/tenantDb'

async function assertReviewsEnabled() {
  const tenantRow = await getTenantRowFromRequest().catch(() => null)
  if (!tenantRow?.id) return null
  const entitlements = await getTenantEntitlements(tenantRow.id).catch(() => null)
  if (entitlements?.features?.customer_reviews === false) {
    return NextResponse.json({ error: 'Customer reviews are disabled for this subscription.' }, { status: 403 })
  }
  return null
}

export async function GET(request: Request) {
  const blocked = await assertReviewsEnabled()
  if (blocked) return blocked
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId') ?? ''
  const reviews = await fetchReviews(productId).catch(() => [])
  return NextResponse.json({ reviews })
}

export async function POST(request: Request) {
  const blocked = await assertReviewsEnabled()
  if (blocked) return blocked
  try {
    const body = await request.json()
    const { productId, name, rating, review } = body
    if (!productId || !name || !rating || !review) {
      return NextResponse.json({ error: 'productId, name, rating, and review are required' }, { status: 400 })
    }
    await addReview({ productId, name, rating, review })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
