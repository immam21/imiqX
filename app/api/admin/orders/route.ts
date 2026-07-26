import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

const STATUS_ORDER = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'delivered']
const TERMINAL_STATUSES = ['delivered', 'returned', 'cancelled']

function canTransition(fromStatus: string, toStatus: string) {
  const from = String(fromStatus || '').toLowerCase().trim()
  const to = String(toStatus || '').toLowerCase().trim()
  if (!from || from === to) return true

  if (from === 'delivered') return ['returned'].includes(to)
  if (from === 'returned' || from === 'cancelled') return false

  if (to === 'cancelled') return !TERMINAL_STATUSES.includes(from)

  const fromIdx = STATUS_ORDER.indexOf(from)
  const toIdx = STATUS_ORDER.indexOf(to)
  if (fromIdx >= 0 && toIdx >= 0) return toIdx >= fromIdx

  return true
}

function toTitleStatus(value: string) {
  const raw = String(value || '').toLowerCase()
  if (raw === 'packed' || raw === 'processing') return 'Processing'
  if (raw === 'confirmed') return 'Confirmed'
  if (raw === 'in_transit') return 'In Transit'
  if (raw === 'returned') return 'Returned'
  if (!raw) return 'Pending'
  return raw[0].toUpperCase() + raw.slice(1)
}

function parseOrderRow(r: any, itemsByOrder: Record<string, any[]>) {
  const addressParts = [r.door_number, r.full_address, r.city, r.pincode].filter(Boolean)
  const products = (itemsByOrder[r.id] || []).map((it) => ({
    name: it.product_name,
    qty: Number(it.quantity || 1),
    price: Number(it.unit_price || 0),
  }))

  return {
    orderId: r.order_number ?? '',
    dbId: r.id ?? '',
    date: r.created_at ?? '',
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_mobile ?? '',
    doorNumber: r.door_number ?? '',
    city: r.city ?? '',
    pincode: r.pincode ?? '',
    address: addressParts.length ? addressParts.join(', ') : (r.full_address ?? ''),
    productsJSON: JSON.stringify(products),
    subtotal: Number(r.subtotal) || 0,
    deliveryCharge: Number(r.delivery_charge) || 0,
    grandTotal: Number(r.grand_total) || 0,
    status: toTitleStatus(String(r.status || 'pending')),
    paymentMethod: r.payment_method ?? '',
    paymentStatus: r.payment_status ?? '',
    trackingId: r.tracking_id ?? '',
    courierName: r.courier_name ?? '',
    trackingBarcode: r.tracking_barcode ?? '',
    couponCode: r.coupon_code ?? '',
    couponDiscount: Number(r.coupon_discount) || 0,
  }
}

async function loadOrderRowsWithFallback(supabase: ReturnType<typeof getSupabaseAdmin>, tenantDbId: string) {
  const full = await supabase
    .from('orders')
    .select('id,order_number,created_at,customer_name,customer_mobile,door_number,full_address,city,pincode,subtotal,delivery_charge,grand_total,status,payment_method,payment_status,tracking_id,courier_name,tracking_barcode,coupon_code,coupon_discount')
    .eq('tenant_id', tenantDbId)
    .order('created_at', { ascending: false })

  if (!full.error) return { rows: full.data || [], error: null }

  const basic = await supabase
    .from('orders')
    .select('id,order_number,created_at,customer_name,customer_mobile,door_number,full_address,city,pincode,subtotal,delivery_charge,grand_total,status,coupon_code,coupon_discount')
    .eq('tenant_id', tenantDbId)
    .order('created_at', { ascending: false })

  if (basic.error) return { rows: [], error: full.error }

  return {
    rows: (basic.data || []).map((r: any) => ({
      ...r,
      payment_method: '',
      payment_status: '',
      tracking_id: '',
      courier_name: '',
      tracking_barcode: '',
    })),
    error: null,
  }
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const supabase = getSupabaseAdmin()
    const ordersRes = await loadOrderRowsWithFallback(supabase, auth.tenantDbId)
    if (ordersRes.error) throw new Error(ordersRes.error.message)
    const rows = ordersRes.rows

    const orderIds = (rows || []).map((r: any) => r.id)
    const { data: items } = orderIds.length
      ? await supabase
          .from('order_items')
          .select('order_id,product_name,quantity,unit_price')
          .eq('tenant_id', auth.tenantDbId)
          .in('order_id', orderIds)
      : { data: [] as any[] }

    const itemsByOrder: Record<string, any[]> = {}
    for (const item of items || []) {
      const key = String(item.order_id)
      if (!itemsByOrder[key]) itemsByOrder[key] = []
      itemsByOrder[key].push(item)
    }

    const orders = (rows || [])
      .map((r: any) => parseOrderRow(r, itemsByOrder))
      .filter((o) => o.orderId)
    return NextResponse.json({ orders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { orderId, status, updates } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    const rowUpdates: Record<string, any> = {}
    if (status) {
      const raw = String(status).toLowerCase().replace(/\s+/g, '_')
      const statusMap: Record<string, string> = {
        pending: 'pending',
        confirmed: 'confirmed',
        processing: 'processing',
        packed: 'packed',
        shipped: 'shipped',
        in_transit: 'in_transit',
        delivered: 'delivered',
        returned: 'returned',
        cancelled: 'cancelled',
      }
      rowUpdates.status = statusMap[raw] || raw
    }
    if (updates) {
      if (updates.customerName  !== undefined) rowUpdates.customer_name = updates.customerName
      if (updates.customerPhone !== undefined) rowUpdates.customer_mobile = updates.customerPhone
      if (updates.address       !== undefined) rowUpdates.full_address = updates.address
      if (updates.doorNumber    !== undefined) rowUpdates.door_number = updates.doorNumber
      if (updates.city          !== undefined) rowUpdates.city = updates.city
      if (updates.pincode       !== undefined) rowUpdates.pincode = updates.pincode
      if (updates.paymentMethod !== undefined) rowUpdates.payment_method = updates.paymentMethod
      if (updates.paymentStatus !== undefined) rowUpdates.payment_status = updates.paymentStatus
      if (updates.trackingId    !== undefined) rowUpdates.tracking_id = updates.trackingId
      if (updates.courierName   !== undefined) rowUpdates.courier_name = updates.courierName
      if (updates.trackingBarcode !== undefined) rowUpdates.tracking_barcode = updates.trackingBarcode
    }
    if (Object.keys(rowUpdates).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const existingRes = await supabase
      .from('orders')
      .select('id,status,metadata')
      .eq('tenant_id', auth.tenantDbId)
      .eq('order_number', orderId)
      .limit(1)
      .maybeSingle()

    if (!existingRes.data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const currentStatus = String((existingRes.data as any).status || '').toLowerCase()
    const nextStatus = String(rowUpdates.status || '').toLowerCase()
    if (nextStatus && !canTransition(currentStatus, nextStatus)) {
      return NextResponse.json({ error: `Invalid status transition: ${currentStatus || 'unknown'} -> ${nextStatus}` }, { status: 400 })
    }

    const existingMeta = (existingRes.data as any)?.metadata || {}
    const statusHistory = Array.isArray((existingMeta as any)?.status_history) ? [...(existingMeta as any).status_history] : []
    if (rowUpdates.status) {
      statusHistory.push({
        status: String(rowUpdates.status),
        at: new Date().toISOString(),
        source: 'admin',
      })
      rowUpdates.metadata = {
        ...existingMeta,
        status_history: statusHistory.slice(-50),
      }
    }

    let { error } = await supabase
      .from('orders')
      .update(rowUpdates)
      .eq('tenant_id', auth.tenantDbId)
      .eq('order_number', orderId)

    if (error && /column .*tracking_id.* does not exist|column .*courier_name.* does not exist|column .*tracking_barcode.* does not exist|column .*payment_status.* does not exist|column .*payment_method.* does not exist/i.test(error.message || '')) {
      const fallbackUpdates = { ...rowUpdates }
      delete fallbackUpdates.tracking_id
      delete fallbackUpdates.courier_name
      delete fallbackUpdates.tracking_barcode
      delete fallbackUpdates.payment_method
      delete fallbackUpdates.payment_status
      const retry = await supabase
        .from('orders')
        .update(fallbackUpdates)
        .eq('tenant_id', auth.tenantDbId)
        .eq('order_number', orderId)
      error = retry.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    const orderId = String(body?.orderId || '').trim()
    const orderDbId = String(body?.orderDbId || '').trim()

    if (!orderId && !orderDbId) {
      return NextResponse.json({ error: 'orderId or orderDbId required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    let lookup = supabase
      .from('orders')
      .select('id,order_number')
      .eq('tenant_id', auth.tenantDbId)
      .limit(1)

    lookup = orderDbId ? lookup.eq('id', orderDbId) : lookup.eq('order_number', orderId)

    const existing = await lookup.maybeSingle()
    if (existing.error) throw new Error(existing.error.message)
    if (!existing.data?.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const deleteItems = await supabase
      .from('order_items')
      .delete()
      .eq('tenant_id', auth.tenantDbId)
      .eq('order_id', existing.data.id)

    if (deleteItems.error) throw new Error(deleteItems.error.message)

    const deleteOrder = await supabase
      .from('orders')
      .delete()
      .eq('tenant_id', auth.tenantDbId)
      .eq('id', existing.data.id)

    if (deleteOrder.error) throw new Error(deleteOrder.error.message)

    return NextResponse.json({ ok: true, orderId: existing.data.order_number || orderId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete order' }, { status: 500 })
  }
}
