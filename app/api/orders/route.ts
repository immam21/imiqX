import { NextResponse } from 'next/server'
import orderService from '../../../services/orderService'
import { getTenantConfig } from '../../../lib/tenant'
import { getTenantRowFromRequest, getTenantSettings } from '../../../lib/tenantDb'

export async function POST(request: Request) {
  try {
    const tenantSource = String(request.headers.get('x-tenant-source') || '').trim().toLowerCase()
    if (tenantSource !== 'path' && tenantSource !== 'host') {
      return NextResponse.json({ error: 'Tenant context missing for order creation.' }, { status: 400 })
    }

    const tenant = await getTenantConfig()
    // Always use the DB tenant row's WhatsApp number — never fall back to env-var defaults
    const tenantRow = await getTenantRowFromRequest().catch(() => null)
    const tenantKv  = tenantRow ? await getTenantSettings(tenantRow.id).catch(() => ({} as Record<string,string>)) : {}
    const whatsappNumber =
      String(tenantKv.WhatsAppNumber || tenantKv.whatsappNumber || '').trim() ||
      String(tenantRow?.whatsapp_number || '').trim() ||
      tenant.whatsappNumber
    const businessName =
      String(tenantKv.BusinessName || '').trim() ||
      String(tenantRow?.business_name || '').trim() ||
      tenant.businessName

    const body = await request.json()
    const order = body.order
    order.OrderID = `O${Date.now()}`
    order.Date = new Date().toISOString()
    await orderService.createOrder(order, tenant.gsheetId)
    const waLink = orderService.createWhatsAppRedirect(order, whatsappNumber)
    const customerConfirmLink = orderService.createCustomerWhatsAppConfirmation(order, businessName)
    return NextResponse.json({ ok: true, waLink, customerConfirmLink, orderId: order.OrderID })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create order' }, { status: 500 })
  }
}
