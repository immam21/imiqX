import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { auditLog, requirePlatformAdmin } from '../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../lib/security'

const commSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(5000),
  imageUrl: z.string().trim().max(2000).optional(),
  targetTenantId: z.string().uuid().optional(),
  status: z.enum(['draft', 'active', 'scheduled', 'expired', 'deleted']).default('active'),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
})

function normalizeComm(row: any) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    image_url: row.image_url || null,
    target_tenant_id: row.target_tenant_id || null,
    status: row.status,
    start_at: row.start_at || null,
    end_at: row.end_at || null,
    created_by_user_id: row.created_by_user_id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin()
  const url = new URL(request.url)
  const tenantId = String(url.searchParams.get('tenantId') || '').trim()
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 25)))

  try {
    let query = supabase.from('platform_comms').select('*').order('created_at', { ascending: false }).limit(limit)

    if (tenantId) {
      query = query.or(`target_tenant_id.is.null,target_tenant_id.eq.${tenantId}`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const now = Date.now()
    const comms = (data || [])
      .map(normalizeComm)
      .filter((row) => {
        if (row.status === 'deleted') return false
        if (row.status === 'draft') return false
        if (row.status === 'scheduled' && row.start_at && new Date(row.start_at).getTime() > now) return false
        if (row.end_at && new Date(row.end_at).getTime() < now) return false
        return true
      })

    return NextResponse.json({ comms })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load communications' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-comms-post:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin(['super_admin', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const parsed = commSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid comm payload' }, { status: 400 })

    const input = parsed.data
    const supabase = getSupabaseAdmin()
    let result = await supabase
      .from('platform_comms')
      .insert({
        title: input.title,
        body: input.body,
        image_url: input.imageUrl || null,
        target_tenant_id: input.targetTenantId || null,
        status: input.status,
        start_at: input.startAt || null,
        end_at: input.endAt || null,
        created_by_user_id: auth.session.userId,
      })
      .select('*')
      .single()

    if (result.error && /column .*image_url.* does not exist/i.test(result.error.message || '')) {
      result = await supabase
        .from('platform_comms')
        .insert({
          title: input.title,
          body: input.body,
          target_tenant_id: input.targetTenantId || null,
          status: input.status,
          start_at: input.startAt || null,
          end_at: input.endAt || null,
          created_by_user_id: auth.session.userId,
        })
        .select('*')
        .single()
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })

    await auditLog({
      action: 'platform.comms.create',
      entityType: 'platform_comms',
      entityId: result.data.id,
      metadata: { title: input.title, status: input.status },
    })

    return NextResponse.json({ ok: true, comm: result.data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create communication' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-comms-patch:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin(['super_admin', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = String(body.title || '').trim()
    if (body.body !== undefined) updates.body = String(body.body || '').trim()
    if (body.imageUrl !== undefined) updates.image_url = body.imageUrl || null
    if (body.targetTenantId !== undefined) updates.target_tenant_id = body.targetTenantId || null
    if (body.status !== undefined) updates.status = body.status
    if (body.startAt !== undefined) updates.start_at = body.startAt || null
    if (body.endAt !== undefined) updates.end_at = body.endAt || null

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('platform_comms')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.comms.update',
      entityType: 'platform_comms',
      entityId: id,
      metadata: updates,
    })

    return NextResponse.json({ ok: true, comm: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update communication' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-comms-delete:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin(['super_admin', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('platform_comms').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.comms.delete',
      entityType: 'platform_comms',
      entityId: id,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete communication' }, { status: 500 })
  }
}