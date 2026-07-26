import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { getTenantRowFromRequest } from '../../../lib/tenantDb'

const NO_ORDER_MESSAGE = 'No order updates found for this mobile number yet. Please check the number used at checkout and try again.'

function normalizeMobile(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeStatus(value: string) {
  const raw = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  if (!raw) return 'Pending'
  const map: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    'in transit': 'In Transit',
    delivered: 'Delivered',
    returned: 'Returned',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
  }
  return map[raw] || raw.replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')?.trim()

  if (!phone) {
    return NextResponse.json({ error: 'Please enter your mobile number to track your order.' }, { status: 400 })
  }

  const normalizedPhone = normalizeMobile(phone)
  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: 'Please enter a valid mobile number (at least 10 digits).' }, { status: 400 })
  }

  const tenant = await getTenantRowFromRequest()
  const supabase = getSupabaseAdmin()

  try {
    let query = supabase
      .from('orders')
      .select('id,order_number,created_at,customer_name,status,subtotal,delivery_charge,grand_total,full_address,customer_mobile,metadata,payment_method,payment_status,tracking_id,courier_name,tracking_barcode')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(30)

    let { data: orders, error } = await query

    if (error && /column .*tracking_id.* does not exist|column .*courier_name.* does not exist|column .*tracking_barcode.* does not exist|column .*payment_status.* does not exist|column .*payment_method.* does not exist/i.test(error.message || '')) {
      const fallback = await supabase
        .from('orders')
        .select('id,order_number,created_at,customer_name,status,subtotal,delivery_charge,grand_total,full_address,customer_mobile,metadata')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(30)
      orders = (fallback.data || []) as any
      error = fallback.error as any
      if (Array.isArray(orders)) {
        orders = orders.map((order: any) => ({
          ...order,
          payment_method: order.payment_method || '',
          payment_status: order.payment_status || '',
          tracking_id: order.tracking_id || '',
          courier_name: order.courier_name || '',
          tracking_barcode: order.tracking_barcode || '',
        }))
      }
    }

    if (error || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: NO_ORDER_MESSAGE },
        { status: 404 }
      )
    }

    const match = orders.find((o: any) => {
      const orderMobile = normalizeMobile(String(o.customer_mobile || ''))
      if (!orderMobile) return false
      // Support local numbers and country-code variants.
      return orderMobile === normalizedPhone || orderMobile.endsWith(normalizedPhone) || normalizedPhone.endsWith(orderMobile)
    })

    if (!match) {
      return NextResponse.json(
        { error: NO_ORDER_MESSAGE },
        { status: 404 }
      )
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name,quantity,unit_price')
      .eq('tenant_id', tenant.id)
      .eq('order_id', match.id)

    const products = (items || []).map((i: any) => ({
      name: i.product_name,
      qty: Number(i.quantity || 1),
      price: Number(i.unit_price || 0),
    }))

    // Return a safe subset — never expose internal fields like WhatsAppSent
    return NextResponse.json({
      order: {
        orderId: match.order_number,
        date: match.created_at,
        customerName: match.customer_name,
        status: normalizeStatus(match.status || 'pending'),
        subtotal: match.subtotal,
        deliveryCharge: match.delivery_charge,
        grandTotal: match.grand_total,
        address: match.full_address,
        paymentMethod: (match as any).payment_method || '',
        paymentStatus: (match as any).payment_status || '',
        trackingId: (match as any).tracking_id || '',
        courierName: (match as any).courier_name || '',
        trackingBarcode: (match as any).tracking_barcode || '',
        statusHistory: Array.isArray((match as any)?.metadata?.status_history) ? (match as any).metadata.status_history : [],
        products: products.length > 0
          ? products
          : (() => {
              try { return (match.metadata as any)?.products || [] }
              catch { return [] }
            })(),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: NO_ORDER_MESSAGE },
      { status: 404 }
    )
  }
}
