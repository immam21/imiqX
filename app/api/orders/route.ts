import { NextResponse } from 'next/server'
import orderService from '../../../services/orderService'
import config from '../../../config'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // basic validation omitted for brevity
    const order = body.order
    // assign order id and date server-side
    order.OrderID = `O${Date.now()}`
    order.Date = new Date().toISOString()
    const added = await orderService.createOrder(order)
    // generate whatsapp link
    const waLink = orderService.createWhatsAppRedirect(order, config.whatsappNumber)
    return NextResponse.json({ ok: true, waLink })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create order' }, { status: 500 })
  }
}
