import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getTenantEntitlements } from '../../../../lib/tenantDb'

async function assertCouponsEnabled(tenantDbId: string) {
  const entitlements = await getTenantEntitlements(tenantDbId).catch(() => null)
  if (entitlements?.features?.coupons === false) {
    return NextResponse.json({ error: 'Coupons are disabled for this subscription.' }, { status: 403 })
  }
  return null
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const blocked = await assertCouponsEnabled(auth.tenantDbId)
  if (blocked) return blocked
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('tenant_id', auth.tenantDbId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const coupons = (data || []).map((r: any) => ({
      code: String(r.code || '').trim(),
      type: String(r.type || 'percent').trim(),
      value: Number(r.value || 0),
      minOrder: Number(r.min_order || 0),
      expiry: String(r.expires_at || '').trim(),
      active: String(Boolean(r.is_active)),
    })).filter((c: any) => c.code)

    return NextResponse.json({ coupons })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const blocked = await assertCouponsEnabled(auth.tenantDbId)
  if (blocked) return blocked
  try {
    const { coupon } = await request.json()
    if (!coupon?.code || !coupon?.value) return NextResponse.json({ error: 'code and value required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const code = String(coupon.code || '').toUpperCase()
    const sid = `C${Date.now().toString().slice(-4)}`
    const { error } = await supabase.from('coupons').insert({
      sid: sid.length <= 5 ? sid : null,
      tenant_id: auth.tenantDbId,
      code,
      type: coupon.type || 'percent',
      value: Number(coupon.value || 0),
      min_order: Number(coupon.minOrder || 0),
      expires_at: coupon.expiry || null,
      is_active: true,
    })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const blocked = await assertCouponsEnabled(auth.tenantDbId)
  if (blocked) return blocked
  try {
    const { code } = await request.json()
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('tenant_id', auth.tenantDbId)
      .ilike('code', String(code).toUpperCase())

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
