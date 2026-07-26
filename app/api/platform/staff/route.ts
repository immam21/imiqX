import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { hashPassword } from '../../../../lib/platformAuth'
import { auditLog, requirePlatformAdmin } from '../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../lib/security'

const createSchema = z.object({
  tenantId: z.string().uuid().optional(),
  scope: z.enum(['platform', 'tenant']),
  username: z.string().trim().min(3).max(80),
  email: z.string().email().optional(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(2).max(120).optional(),
  roleKeys: z.array(z.string().trim().min(2)).min(1),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(8).max(30).optional(),
})

async function loadStaffRows(supabase: ReturnType<typeof getSupabaseAdmin>, tenantId: string) {
  let query: any = supabase
    .from('users')
    .select('id,tenant_id,user_type,username,email,display_name,phone,is_active,last_login_at,created_at')
    .order('created_at', { ascending: false })

  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  }

  let result: any = await query
  if (!result.error) return result

  let fallbackQuery: any = supabase
    .from('users')
    .select('id,tenant_id,user_type,username,email,is_active,created_at')
    .order('created_at', { ascending: false })

  if (tenantId) {
    fallbackQuery = fallbackQuery.eq('tenant_id', tenantId)
  }

  result = await fallbackQuery
  if (!result.error) {
    return {
      data: (result.data || []).map((row: any) => ({
        ...row,
        display_name: null,
        phone: null,
        last_login_at: null,
      })),
      error: null,
    }
  }

  return result
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  const tenantId = url.searchParams.get('tenantId') || ''

  const supabase = getSupabaseAdmin()
  const { data, error } = await loadStaffRows(supabase, tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ users: data || [] })
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-staff-post:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const input = parsed.data
    if (input.scope === 'tenant' && !input.tenantId) {
      return NextResponse.json({ error: 'tenantId is required for tenant scope users' }, { status: 400 })
    }

    const passwordHash = await hashPassword(input.password)
    const supabase = getSupabaseAdmin()

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        tenant_id: input.scope === 'tenant' ? input.tenantId : null,
        user_type: input.scope,
        username: input.username,
        email: input.email || null,
        password_hash: passwordHash,
        display_name: input.displayName || null,
        is_active: true,
      })
      .select('id,tenant_id,user_type,username,email,display_name,is_active')
      .single()

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 400 })

    const { data: roles, error: roleErr } = await supabase
      .from('roles')
      .select('id,key,scope')
      .in('key', input.roleKeys)

    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 400 })

    const matched = (roles || []).filter((r: any) => r.scope === input.scope)
    if (matched.length !== input.roleKeys.length) {
      return NextResponse.json({ error: 'One or more roles are invalid for selected scope' }, { status: 400 })
    }

    const inserts = matched.map((r: any) => ({ user_id: user.id, role_id: r.id }))
    const { error: userRoleErr } = await supabase.from('user_roles').insert(inserts)
    if (userRoleErr) return NextResponse.json({ error: userRoleErr.message }, { status: 400 })

    await auditLog({
      action: 'platform.staff.create',
      entityType: 'users',
      entityId: user.id,
      tenantId: user.tenant_id || undefined,
      metadata: { scope: input.scope, roleKeys: input.roleKeys },
    })

    return NextResponse.json({ ok: true, user })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-staff-patch:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const { id, ...rest } = parsed.data
    const updates: Record<string, unknown> = {}
    if (rest.isActive !== undefined) updates.is_active = rest.isActive
    if (rest.displayName !== undefined) updates.display_name = rest.displayName
    if (rest.phone !== undefined) updates.phone = rest.phone

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id,tenant_id,user_type,username,email,display_name,is_active')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.staff.update',
      entityType: 'users',
      entityId: id,
      tenantId: data.tenant_id || undefined,
      metadata: updates,
    })

    return NextResponse.json({ ok: true, user: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-staff-delete:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.staff.delete',
      entityType: 'users',
      entityId: id,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
