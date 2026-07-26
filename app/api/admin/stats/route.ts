import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

function statusToTitle(value: string) {
  const s = String(value || '').toLowerCase()
  if (s === 'packed' || s === 'processing') return 'Processing'
  if (s === 'confirmed') return 'Confirmed'
  if (s === 'in_transit') return 'In Transit'
  if (s === 'returned') return 'Returned'
  if (!s) return 'Pending'
  return s[0].toUpperCase() + s.slice(1)
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const supabase = getSupabaseAdmin()
    const { data: rows, error } = await supabase
      .from('orders')
      .select('grand_total,status,created_at')
      .eq('tenant_id', auth.tenantDbId)

    if (error) throw new Error(error.message)

    const orders = (rows || []).map((r: any) => ({
      grandTotal: Number(r.grand_total ?? 0) || 0,
      status: statusToTitle(String(r.status ?? '')),
      date: String(r.created_at ?? '').trim(),
    }))

    const today = new Date().toDateString()
    const todayOrders = orders.filter(o => o.date && new Date(o.date).toDateString() === today)
    const todayRevenue = todayOrders
      .filter(o => o.status !== 'Cancelled')
      .reduce((s: number, o: any) => s + o.grandTotal, 0)
    const totalRevenue = orders
      .filter(o => o.status !== 'Cancelled')
      .reduce((s: number, o: any) => s + o.grandTotal, 0)

    const statuses = orders.reduce((acc: Record<string, number>, o: any) => {
      acc[o.status] = (acc[o.status] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      todayRevenue,
      totalRevenue,
      pendingOrders:    statuses['Pending']    || 0,
      processingOrders: statuses['Processing'] || 0,
      shippedOrders:    statuses['Shipped']    || 0,
      deliveredOrders:  statuses['Delivered']  || 0,
      confirmedOrders:  statuses['Confirmed']  || 0,
      inTransitOrders:  statuses['In Transit'] || 0,
      returnedOrders:   statuses['Returned']   || 0,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
