import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

type TicketRow = {
  id: string
  sid?: string | null
  tenant_id: string
  subject: string
  description: string
  status: string
  priority: string
  created_at?: string
  updated_at?: string
}

type CommentRow = {
  id: string
  ticket_id: string
  tenant_id: string
  author_type: 'tenant' | 'platform'
  author_user_id?: string | null
  comment: string
  created_at?: string
}

async function loadTicketsWithComments(supabase: ReturnType<typeof getSupabaseAdmin>, tenantId: string) {
  const ticketsRes = await supabase
    .from('support_tickets')
    .select('id,sid,tenant_id,subject,description,status,priority,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (ticketsRes.error) throw new Error(ticketsRes.error.message)

  const tickets = (ticketsRes.data || []) as TicketRow[]
  const ticketIds = tickets.map((t) => t.id)
  if (!ticketIds.length) return []

  const commentsRes = await supabase
    .from('support_ticket_comments')
    .select('id,ticket_id,tenant_id,author_type,author_user_id,comment,created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: false })

  if (commentsRes.error && /relation .*support_ticket_comments.* does not exist/i.test(commentsRes.error.message || '')) {
    return tickets.map((t) => ({ ...t, comments: [], latestComment: null, comments_unavailable: true }))
  }

  if (commentsRes.error) throw new Error(commentsRes.error.message)

  const comments = (commentsRes.data || []) as CommentRow[]
  const commentsByTicket = comments.reduce<Record<string, CommentRow[]>>((acc, c) => {
    const key = String(c.ticket_id)
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  return tickets.map((t) => ({
    ...t,
    comments: commentsByTicket[t.id] || [],
    latestComment: (commentsByTicket[t.id] || [])[0]?.comment || null,
  }))
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const supabase = getSupabaseAdmin()
    const tickets = await loadTicketsWithComments(supabase, auth.tenantDbId)
    return NextResponse.json({ tickets })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load support tickets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const mode = String(body?.mode || 'ticket')
    const supabase = getSupabaseAdmin()

    if (mode === 'comment') {
      const ticketId = String(body?.ticketId || '').trim()
      const comment = String(body?.comment || '').trim()
      if (!ticketId || !comment) return NextResponse.json({ error: 'ticketId and comment required' }, { status: 400 })

      const insertRes = await supabase.from('support_ticket_comments').insert({
        ticket_id: ticketId,
        tenant_id: auth.tenantDbId,
        author_type: 'tenant',
        comment,
      })

      if (insertRes.error && /relation .*support_ticket_comments.* does not exist/i.test(insertRes.error.message || '')) {
        return NextResponse.json({ error: 'support_ticket_comments table is missing. Run latest Supabase migration.' }, { status: 400 })
      } else if (insertRes.error) {
        throw new Error(insertRes.error.message)
      }

      await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId).eq('tenant_id', auth.tenantDbId)
      return NextResponse.json({ ok: true })
    }

    const subject = String(body?.subject || '').trim()
    const description = String(body?.description || '').trim()
    const priority = String(body?.priority || 'medium').trim().toLowerCase()
    const category = String(body?.category || '').trim()

    if (!subject || !description) return NextResponse.json({ error: 'subject and description required' }, { status: 400 })

    const { error } = await supabase.from('support_tickets').insert({
      sid: `T${Date.now().toString().slice(-4)}`,
      tenant_id: auth.tenantDbId,
      subject: category ? `[${category}] ${subject}` : subject,
      description,
      status: 'open',
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
    })

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create support ticket' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ error: 'Ticket status updates are managed by platform support only.' }, { status: 403 })
}