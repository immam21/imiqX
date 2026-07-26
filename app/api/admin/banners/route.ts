import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { toRenderableAssetUrl } from '../../../../lib/assetUrl'
import { getTenantEntitlements } from '../../../../lib/tenantDb'

async function assertBannersEnabled(tenantDbId: string) {
  const entitlements = await getTenantEntitlements(tenantDbId).catch(() => null)
  if (entitlements?.features?.banners === false) {
    return NextResponse.json({ error: 'Banners are disabled for this subscription.' }, { status: 403 })
  }
  return null
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const blocked = await assertBannersEnabled(auth.tenantDbId)
  if (blocked) return blocked
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('tenant_id', auth.tenantDbId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const banners = (data || []).map((r: any) => ({
      bannerId: String(r.sid || r.id || '').trim(),
      title: String(r.title || '').trim(),
      subtitle: String(r.subtitle || '').trim(),
      imageUrl: toRenderableAssetUrl(String(r.image_url || '').trim()),
      linkUrl: String(r.link_url || '').trim(),
      buttonText: String(r.button_text || '').trim(),
    })).filter((b: any) => b.title)
    return NextResponse.json({ banners })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const blocked = await assertBannersEnabled(auth.tenantDbId)
  if (blocked) return blocked
  try {
    const { banner } = await request.json()
    if (!banner?.title || !banner?.imageUrl) return NextResponse.json({ error: 'title and imageUrl required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const bannerId = String(banner.bannerId || `B${Date.now().toString().slice(-4)}`)
    const { error } = await supabase.from('banners').insert({
      sid: bannerId.length <= 5 ? bannerId : null,
      tenant_id: auth.tenantDbId,
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.imageUrl,
      link_url: banner.linkUrl || '',
      button_text: banner.buttonText || 'Shop now',
      is_active: true,
      sort_order: 0,
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const blocked = await assertBannersEnabled(auth.tenantDbId)
  if (blocked) return blocked
  try {
    const { bannerId, banner } = await request.json()
    if (!bannerId || !banner) return NextResponse.json({ error: 'bannerId and banner required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const payload: Record<string, any> = {}
    if (banner.title !== undefined) payload.title = banner.title
    if (banner.subtitle !== undefined) payload.subtitle = banner.subtitle
    if (banner.imageUrl !== undefined) payload.image_url = banner.imageUrl
    if (banner.linkUrl !== undefined) payload.link_url = banner.linkUrl
    if (banner.buttonText !== undefined) payload.button_text = banner.buttonText
    const { error } = await supabase
      .from('banners')
      .update(payload)
      .eq('tenant_id', auth.tenantDbId)
      .or(`sid.eq.${bannerId},id.eq.${bannerId}`)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const blocked = await assertBannersEnabled(auth.tenantDbId)
  if (blocked) return blocked
  try {
    const { bannerId } = await request.json()
    if (!bannerId) return NextResponse.json({ error: 'bannerId required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bannerId)
    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('tenant_id', auth.tenantDbId)
      .eq(isUuid ? 'id' : 'sid', bannerId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
