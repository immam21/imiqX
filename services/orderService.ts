import * as gs from '../lib/googleSheets'
import { generateWhatsAppLink } from '../utils/whatsapp'

const SHEET_ID = process.env.GSHEET_ID ?? ''

export async function createOrder(order: any) {
  if (!SHEET_ID) throw new Error('GSHEET_ID not configured')
  // order should include: OrderID, Date, CustomerName, CustomerMobile, FullAddress, ProductsJSON, Subtotal, DeliveryCharge, GrandTotal, OrderStatus, WhatsAppSent
  const added = await gs.appendSheetRow(SHEET_ID, 'Orders', order)
  return added
}

export function createWhatsAppRedirect(order: any, businessNumber: string) {
  const message = buildOrderMessage(order)
  return generateWhatsAppLink(businessNumber, message)
}

function buildOrderMessage(order: any) {
  const products: Array<{ name: string; qty: number; price: number }> = JSON.parse(order.ProductsJSON || '[]')
  const date = order.Date ? new Date(order.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  const productLines = products.map((p) => `  • ${p.name} × ${p.qty}  =  ₹${p.price * p.qty}`).join('\n')

  const addressParts = [order.DoorNumber, order.FullAddress, order.City, order.Pincode].filter(Boolean).join(', ')

  const msg = [
    `🛍️ *NEW ORDER*`,
    ``,
    `📦 *Order ID:* ${order.OrderID}`,
    `📅 *Date:* ${date}`,
    ``,
    `*Items:*`,
    productLines,
    ``,
    `👤 *Customer Details*`,
    `Name: ${order.CustomerName}`,
    `Phone: ${order.CustomerMobile}`,
    `Address: ${addressParts}`,
    ``,
    `💳 *Payment Details*`,
    `Subtotal: ₹${order.Subtotal}`,
    `Delivery: ₹${order.DeliveryCharge}`,
    `*Total: ₹${order.GrandTotal}*`,
    `Payment: Cash on Delivery (WhatsApp)`,
    ``,
    `Please confirm this order. Thank you! 🙏`,
  ].join('\n')

  return msg
}

export default { createOrder, createWhatsAppRedirect }
