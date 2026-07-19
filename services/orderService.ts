import gs from '../lib/googleSheets'
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
  // simple formatter — can be expanded
  const addr = order.FullAddress || ''
  let msg = `Hello,%0A%0AI would like to place an order.%0A%0ACustomer Details%0AName: ${order.CustomerName}%0AMobile: ${order.CustomerMobile}%0A%0ADelivery Address%0A${addr}%0A%0AProducts:%0A`
  const products = JSON.parse(order.ProductsJSON || '[]')
  products.forEach((p: any) => {
    msg += `${p.name} x ${p.qty} - ₹${p.price}%0A`
  })
  msg += `%0AGrand Total: ₹${order.GrandTotal}%0A%0AThank you.`
  return msg
}

export default { createOrder, createWhatsAppRedirect }
