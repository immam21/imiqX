import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { auditLog, requirePlatformAdmin } from '../../../../lib/platformGuards'

function normalizeStatus(value: string) {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (raw === 'inprogress') return 'in_progress'
  return raw
}

async function loadSupportTickets(supabase: ReturnType<typeof getSupabaseAdmin>) {
  let ticketsRes: any = await supabase
    .from('support_tickets')
    .select('id,sid,tenant_id,created_by_user_id,subject,description,status,priority,assigned_to_user_id,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (!ticketsRes.error) return ticketsRes

  ticketsRes = await supabase
    .from('support_tickets')
    .select('id,tenant_id,subject,description,status,priority,created_at')
    .order('created_at', { ascending: false })

  if (!ticketsRes.error) {
    return {
      data: (ticketsRes.data || []).map((row: any) => ({
        ...row,
        sid: null,
        created_by_user_id: null,
        assigned_to_user_id: null,
        updated_at: row.created_at || null,
      })),
      error: null,
    }
  }

  return ticketsRes
}

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const supabase = getSupabaseAdmin()
    const ticketsRes = await loadSupportTickets(supabase)

    if (ticketsRes.error) return NextResponse.json({ error: ticketsRes.error.message }, { status: 400 })

    const tenantIds = Array.from(new Set((ticketsRes.data || []).map((t: any) => String(t.tenant_id || '')).filter(Boolean)))
    const [tenantsRes, commentsRes] = await Promise.all([
      tenantIds.length
        ? supabase.from('tenants').select('id,tenant_code,business_name').in('id', tenantIds)
        : Promise.resolve({ data: [], error: null } as any),
      supabase.from('support_ticket_comments').select('id,ticket_id,tenant_id,author_type,author_user_id,comment,created_at').order('created_at', { ascending: false }),
    ])

    if (tenantsRes.error) return NextResponse.json({ error: tenantsRes.error.message }, { status: 400 })

    const tenantsById = new Map<string, any>((tenantsRes.data || []).map((r: any) => [String(r.id), r]))
    const commentsByTicket = new Map<string, any[]>()

    if (!commentsRes.error) {
      for (const row of commentsRes.data || []) {
        const key = String((row as any).ticket_id || '')
        const arr = commentsByTicket.get(key) || []
        arr.push(row)
        commentsByTicket.set(key, arr)
      }
    }

    const tickets = (ticketsRes.data || []).map((ticket: any) => ({
      ...ticket,
      tenant: tenantsById.get(String(ticket.tenant_id || '')) || null,
      comments: commentsByTicket.get(String(ticket.id || '')) || [],
      latestComment: (commentsByTicket.get(String(ticket.id || '')) || [])[0]?.comment || null,
      comments_unavailable: Boolean(commentsRes.error),
    }))

    return NextResponse.json({ tickets })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load support tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const ticketId = String(body?.ticketId || '').trim()
    const comment = String(body?.comment || '').trim()
    if (!ticketId || !comment) return NextResponse.json({ error: 'ticketId and comment required' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const ticketRes = await supabase.from('support_tickets').select('id,tenant_id').eq('id', ticketId).limit(1).maybeSingle()
    if (ticketRes.error || !ticketRes.data) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    const insertRes = await supabase.from('support_ticket_comments').insert({
      ticket_id: ticketId,
      tenant_id: ticketRes.data.tenant_id,
      author_type: 'platform',
      author_user_id: auth.session.userId,
      comment,
    })

    if (insertRes.error && /relation .*support_ticket_comments.* does not exist/i.test(insertRes.error.message || '')) {
      return NextResponse.json({ error: 'support_ticket_comments table is missing. Run latest Supabase migration.' }, { status: 400 })
    }
    if (insertRes.error) return NextResponse.json({ error: insertRes.error.message }, { status: 400 })

    await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)

    await auditLog({
      action: 'platform.support.comment',
      entityType: 'support_tickets',
      entityId: ticketId,
      tenantId: ticketRes.data.tenant_id,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to add support comment' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (body.status !== undefined) updates.status = normalizeStatus(String(body.status || ''))
    if (body.priority !== undefined) updates.priority = String(body.priority || '').trim().toLowerCase()
    if (body.assignedToUserId !== undefined) updates.assigned_to_user_id = body.assignedToUserId || null

    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,tenant_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.support.update',
      entityType: 'support_tickets',
      entityId: id,
      tenantId: data.tenant_id,
      metadata: updates,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update ticket' }, { status: 500 })
  }
}