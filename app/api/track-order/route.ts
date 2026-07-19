import { NextResponse } from 'next/server'
import { findSheetRow } from '../../../lib/googleSheets'

const SHEET_ID = process.env.GSHEET_ID ?? ''

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderNumber = searchParams.get('orderNumber')?.trim()
  const phone = searchParams.get('phone')?.trim()

  if (!orderNumber || !phone) {
    return NextResponse.json(
      { error: 'Order number and phone number are required.' },
      { status: 400 }
    )
  }

  if (!SHEET_ID) {
    return NextResponse.json({ error: 'Store not configured.' }, { status: 503 })
  }

  try {
    const row = await findSheetRow(SHEET_ID, 'Orders', {
      OrderID: orderNumber,
      CustomerMobile: phone,
    })

    if (!row) {
      return NextResponse.json(
        { error: 'No order found with that order number and phone number.' },
        { status: 404 }
      )
    }

    // Return a safe subset — never expose internal fields like WhatsAppSent
    return NextResponse.json({
      order: {
        orderId: row.OrderID,
        date: row.Date,
        customerName: row.CustomerName,
        status: row.OrderStatus ?? 'Pending',
        subtotal: row.Subtotal,
        deliveryCharge: row.DeliveryCharge,
        grandTotal: row.GrandTotal,
        address: row.FullAddress,
        products: (() => {
          try { return JSON.parse(row.ProductsJSON || '[]') }
          catch { return [] }
        })(),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch order.' },
      { status: 500 }
    )
  }
}
