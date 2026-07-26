import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { auditLog, requirePlatformAdmin } from '../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../lib/security'

const createSchema = z.object({
  tenantId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().trim().min(3).max(10).default('INR'),
  status: z.enum(['pending', 'paid', 'failed', 'refunded', 'overdue']).default('pending'),
  method: z.string().trim().max(50).optional(),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
  receiptNumber: z.string().trim().max(80).optional(),
})

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
})

function normalizeRow(row: any) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    subscription_id: row.subscription_id || null,
    amount: Number(row.amount || 0),
    currency: row.currency || 'INR',
    status: row.status || 'pending',
    method: row.method || null,
    reference: row.reference || null,
    payment_date: row.payment_date || null,
    due_date: row.due_date || null,
    notes: row.notes || null,
    receipt_number: row.receipt_number || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }
}

function isPaymentsTableMissing(message: string) {
  return /relation .*platform_tenant_payments.* does not exist|schema cache/i.test(String(message || ''))
}

async function loadRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const baseRes = await supabase
    .from('platform_tenant_payments')
    .select('id,tenant_id,subscription_id,amount,currency,status,method,reference,payment_date,due_date,notes,receipt_number,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (!baseRes.error) return { rows: (baseRes.data || []).map(normalizeRow), missing: false, error: null as any }
  if (isPaymentsTableMissing(baseRes.error.message || '')) return { rows: [], missing: true, error: null as any }

  const reducedRes = await supabase
    .from('platform_tenant_payments')
    .select('id,tenant_id,amount,currency,status,created_at')
    .order('created_at', { ascending: false })

  if (!reducedRes.error) {
    return {
      rows: (reducedRes.data || []).map((row: any) => normalizeRow({ ...row, subscription_id: null, method: null, reference: null, payment_date: null, due_date: null, notes: null, receipt_number: null, updated_at: row.created_at || null })),
      missing: false,
      error: null as any,
    }
  }

  if (isPaymentsTableMissing(reducedRes.error.message || '')) return { rows: [], missing: true, error: null as any }
  return { rows: [], missing: false, error: baseRes.error }
}

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = getSupabaseAdmin()
  const loaded = await loadRows(supabase)
  if (loaded.error) return NextResponse.json({ error: loaded.error.message }, { status: 400 })

  const tenantIds = Array.from(new Set((loaded.rows || []).map((row: any) => String(row.tenant_id || '')).filter(Boolean)))
  const subscriptionIds = Array.from(new Set((loaded.rows || []).map((row: any) => String(row.subscription_id || '')).filter(Boolean)))

  const [tenantsRes, subscriptionsRes] = await Promise.all([
    tenantIds.length ? supabase.from('tenants').select('id,tenant_code,business_name').in('id', tenantIds) : Promise.resolve({ data: [], error: null } as any),
    subscriptionIds.length ? supabase.from('tenant_subscriptions').select('id,plan_id,status').in('id', subscriptionIds) : Promise.resolve({ data: [], error: null } as any),
  ])

  if (tenantsRes.error) return NextResponse.json({ error: tenantsRes.error.message }, { status: 400 })
  if (subscriptionsRes.error) return NextResponse.json({ error: subscriptionsRes.error.message }, { status: 400 })

  const tenantById = new Map((tenantsRes.data || []).map((row: any) => [String(row.id), row]))
  const subscriptionById = new Map((subscriptionsRes.data || []).map((row: any) => [String(row.id), row]))

  const rows = (loaded.rows || []).map((row: any) => ({
    ...row,
    tenant: tenantById.get(String(row.tenant_id)) || null,
    subscription: row.subscription_id ? subscriptionById.get(String(row.subscription_id)) || null : null,
  }))

  return NextResponse.json({
    payments: rows,
    paymentTableMissing: loaded.missing,
  })
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-payments-post:${ip}`, 30, 60_000)
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
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment payload' }, { status: 400 })

    const input = parsed.data
    const supabase = getSupabaseAdmin()

    const payload: Record<string, unknown> = {
      tenant_id: input.tenantId,
      subscription_id: input.subscriptionId || null,
      amount: Number(input.amount || 0),
      currency: input.currency,
      status: input.status,
      method: input.method || null,
      reference: input.reference || null,
      payment_date: input.paidAt || null,
      due_date: input.dueDate || null,
      notes: input.notes || null,
      receipt_number: input.receiptNumber || `RCPT-${Date.now()}`,
    }

    let result = await supabase
      .from('platform_tenant_payments')
      .insert(payload)
      .select('*')
      .single()

    if (result.error && isPaymentsTableMissing(result.error.message || '')) {
      return NextResponse.json({ error: 'platform_tenant_payments table is missing. Run latest migration.' }, { status: 400 })
    }

    if (result.error && /column .*subscription_id.* does not exist/i.test(result.error.message || '')) {
      const { subscription_id, ...fallbackPayload } = payload
      result = await supabase
        .from('platform_tenant_payments')
        .insert(fallbackPayload)
        .select('*')
        .single()
    }

    if (result.error && /column .*payment_date.* does not exist|column .*due_date.* does not exist|column .*notes.* does not exist|column .*receipt_number.* does not exist|column .*reference.* does not exist|column .*method.* does not exist/i.test(result.error.message || '')) {
      result = await supabase
        .from('platform_tenant_payments')
        .insert({
          tenant_id: input.tenantId,
          amount: Number(input.amount || 0),
          currency: input.currency,
          status: input.status,
        })
        .select('*')
        .single()
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })

    await auditLog({
      action: 'platform.payment.create',
      entityType: 'platform_tenant_payments',
      entityId: String(result.data.id),
      tenantId: input.tenantId,
      metadata: {
        amount: input.amount,
        status: input.status,
        currency: input.currency,
      },
    })

    return NextResponse.json({ ok: true, payment: normalizeRow(result.data) })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-payments-patch:${ip}`, 30, 60_000)
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
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment update payload' }, { status: 400 })

    const { id, ...input } = parsed.data
    const updates: Record<string, unknown> = {}
    if (input.tenantId !== undefined) updates.tenant_id = input.tenantId
    if (input.subscriptionId !== undefined) updates.subscription_id = input.subscriptionId || null
    if (input.amount !== undefined) updates.amount = Number(input.amount || 0)
    if (input.currency !== undefined) updates.currency = input.currency
    if (input.status !== undefined) updates.status = input.status
    if (input.method !== undefined) updates.method = input.method || null
    if (input.reference !== undefined) updates.reference = input.reference || null
    if (input.paidAt !== undefined) updates.payment_date = input.paidAt || null
    if (input.dueDate !== undefined) updates.due_date = input.dueDate || null
    if (input.notes !== undefined) updates.notes = input.notes || null
    if (input.receiptNumber !== undefined) updates.receipt_number = input.receiptNumber || null

    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    let result = await supabase
      .from('platform_tenant_payments')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (result.error && isPaymentsTableMissing(result.error.message || '')) {
      return NextResponse.json({ error: 'platform_tenant_payments table is missing. Run latest migration.' }, { status: 400 })
    }

    if (result.error && /column .*subscription_id.* does not exist/i.test(result.error.message || '')) {
      const { subscription_id, ...fallbackUpdates } = updates
      result = await supabase
        .from('platform_tenant_payments')
        .update(fallbackUpdates)
        .eq('id', id)
        .select('*')
        .single()
    }

    if (result.error && /column .*payment_date.* does not exist|column .*due_date.* does not exist|column .*notes.* does not exist|column .*receipt_number.* does not exist|column .*reference.* does not exist|column .*method.* does not exist/i.test(result.error.message || '')) {
      result = await supabase
        .from('platform_tenant_payments')
        .update({
          status: updates.status,
          amount: updates.amount,
          currency: updates.currency,
        })
        .eq('id', id)
        .select('*')
        .single()
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })

    await auditLog({
      action: 'platform.payment.update',
      entityType: 'platform_tenant_payments',
      entityId: id,
      tenantId: String((result.data as any).tenant_id || ''),
      metadata: updates,
    })

    return NextResponse.json({ ok: true, payment: normalizeRow(result.data) })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-payments-delete:${ip}`, 20, 60_000)
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
    const { error } = await supabase.from('platform_tenant_payments').delete().eq('id', id)
    if (error) {
      if (isPaymentsTableMissing(error.message || '')) {
        return NextResponse.json({ error: 'platform_tenant_payments table is missing. Run latest migration.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await auditLog({
      action: 'platform.payment.delete',
      entityType: 'platform_tenant_payments',
      entityId: id,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
