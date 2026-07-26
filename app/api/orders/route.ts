import { NextResponse } from 'next/server'
import orderService from '../../../services/orderService'
import { getTenantConfig } from '../../../lib/tenant'

export async function POST(request: Request) {
  try {
    const tenantSource = String(request.headers.get('x-tenant-source') || '').trim().toLowerCase()
    if (tenantSource !== 'path' && tenantSource !== 'host') {
      return NextResponse.json({ error: 'Tenant context missing for order creation.' }, { status: 400 })
    }

    const tenant = await getTenantConfig()
    const body = await request.json()
    const order = body.order
    order.OrderID = `O${Date.now()}`
    order.Date = new Date().toISOString()
    await orderService.createOrder(order, tenant.gsheetId)
    const waLink = orderService.createWhatsAppRedirect(order, tenant.whatsappNumber)
    const customerConfirmLink = orderService.createCustomerWhatsAppConfirmation(order, tenant.businessName)
    return NextResponse.json({ ok: true, waLink, customerConfirmLink, orderId: order.OrderID })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create order' }, { status: 500 })
  }
}
