import { getSupabaseAdmin } from '../lib/supabaseAdmin'
import { getTenantRowFromRequest } from '../lib/tenantDb'
import { generateWhatsAppLink } from '../utils/whatsapp'

function mapStatus(input: string) {
  const status = String(input || '').trim().toLowerCase()
  if (status === 'processing') return 'packed'
  if (status === 'paid') return 'confirmed'
  if (['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(status)) return status
  return 'pending'
}

function safeSid(value: string | undefined) {
  if (!value) return null
  return value.length <= 5 ? value : null
}

export async function createOrder(order: any, _tenantKey?: string) {
  const supabase = getSupabaseAdmin()
  const tenant = await getTenantRowFromRequest()

  const products: Array<{ productId?: string; name: string; qty: number; price: number }> = (() => {
    try {
      const parsed = JSON.parse(order.ProductsJSON || '[]')
      if (!Array.isArray(parsed)) return []
      return parsed.map((item: any) => ({
        productId: String(item?.productId || '').trim() || undefined,
        name: String(item?.name || '').trim(),
        qty: Number(item?.qty || 1),
        price: Number(item?.price || 0),
      }))
    } catch {
      return []
    }
  })()

  const normalizedProducts = products
    .map((p) => ({
      productId: p.productId,
      name: String(p.name || '').trim(),
      qty: Number.isFinite(Number(p.qty)) ? Math.max(1, Math.floor(Number(p.qty))) : 1,
      price: Number.isFinite(Number(p.price)) ? Number(p.price) : 0,
    }))
    .filter((p) => p.name)

  const tenantProductsByCode = new Map<string, any>()
  if (normalizedProducts.length > 0) {
    const { data: tenantProducts, error: tenantProductsError } = await supabase
      .from('products')
      .select('id,sid,product_code,name,stock')
      .eq('tenant_id', tenant.id)

    if (tenantProductsError) throw new Error(tenantProductsError.message)

    for (const p of tenantProducts || []) {
      if (p.id) tenantProductsByCode.set(String(p.id), p)
      if (p.sid) tenantProductsByCode.set(String(p.sid), p)
      if (p.product_code) tenantProductsByCode.set(String(p.product_code), p)
      if (p.name) tenantProductsByCode.set(String(p.name).trim().toLowerCase(), p)
    }

    const missingProducts: string[] = []
    const insufficient: string[] = []
    for (const p of normalizedProducts) {
      const matched = (p.productId && tenantProductsByCode.get(String(p.productId))) || tenantProductsByCode.get(String(p.name).trim().toLowerCase())
      if (!matched?.id) {
        missingProducts.push(p.name)
        continue
      }
      const currentStock = Number(matched.stock || 0)
      if (currentStock < p.qty) {
        insufficient.push(`${p.name} (available: ${currentStock}, required: ${p.qty})`)
      }
    }

    if (missingProducts.length > 0) {
      throw new Error(`Product not found for tenant: ${Array.from(new Set(missingProducts)).join(', ')}`)
    }

    if (insufficient.length > 0) {
      throw new Error(`Insufficient stock: ${insufficient.join('; ')}`)
    }
  }

  let customerId: string | null = null
  if (order.CustomerMobile) {
    const existing = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('mobile', String(order.CustomerMobile))
      .limit(1)
      .maybeSingle()

    if (!existing.error && existing.data?.id) {
      customerId = existing.data.id
    } else {
      const inserted = await supabase
        .from('customers')
        .insert({
          sid: safeSid(String(order.CustomerID || '')),
          tenant_id: tenant.id,
          name: String(order.CustomerName || ''),
          mobile: String(order.CustomerMobile || ''),
        })
        .select('id')
        .single()

      if (inserted.error) throw new Error(inserted.error.message)
      customerId = inserted.data.id
    }
  }

  let couponId: string | null = null
  if (order.CouponCode) {
    const coupon = await supabase
      .from('coupons')
      .select('id')
      .eq('tenant_id', tenant.id)
      .ilike('code', String(order.CouponCode))
      .limit(1)
      .maybeSingle()
    if (!coupon.error && coupon.data?.id) couponId = coupon.data.id
  }

  const orderNumber = String(order.OrderID || `O${Date.now()}`)

  const insertedOrder = await supabase
    .from('orders')
    .insert({
      sid: safeSid(orderNumber),
      tenant_id: tenant.id,
      order_number: orderNumber,
      customer_id: customerId,
      customer_name: String(order.CustomerName || ''),
      customer_mobile: String(order.CustomerMobile || ''),
      door_number: String(order.DoorNumber || ''),
      full_address: String(order.FullAddress || ''),
      city: String(order.City || ''),
      pincode: String(order.Pincode || ''),
      subtotal: Number(order.Subtotal || 0),
      delivery_charge: Number(order.DeliveryCharge || 0),
      coupon_id: couponId,
      coupon_code: String(order.CouponCode || ''),
      coupon_discount: Number(order.CouponDiscount || 0),
      grand_total: Number(order.GrandTotal || 0),
      status: mapStatus(order.OrderStatus),
      payment_method: 'whatsapp',
      payment_status: 'unpaid',
      whatsapp_sent: Boolean(order.WhatsAppSent),
      metadata: {
        products: normalizedProducts,
        status_history: [
          {
            status: mapStatus(order.OrderStatus),
            at: new Date().toISOString(),
            source: 'create',
          },
        ],
      },
    })
    .select('id,order_number')
    .single()

  if (insertedOrder.error) throw new Error(insertedOrder.error.message)

  if (normalizedProducts.length > 0) {
    const rows = normalizedProducts.map((p) => {
      const matched = (p.productId && tenantProductsByCode.get(String(p.productId))) || tenantProductsByCode.get(String(p.name).trim().toLowerCase())
      return {
        // Keep sid null for line items to avoid tenant-scoped unique collisions across orders.
        sid: null,
        tenant_id: tenant.id,
        order_id: insertedOrder.data.id,
        product_id: matched?.id || null,
        product_name: String(p.name || ''),
        sku: String(matched?.product_code || matched?.sid || ''),
        quantity: Number(p.qty || 1),
        unit_price: Number(p.price || 0),
        line_total: Number((p.qty || 1) * (p.price || 0)),
      }
    })

    const itemsInsert = await supabase.from('order_items').insert(rows)
    if (itemsInsert.error) throw new Error(itemsInsert.error.message)

    for (const p of normalizedProducts) {
      const matched = (p.productId && tenantProductsByCode.get(String(p.productId))) || tenantProductsByCode.get(String(p.name).trim().toLowerCase())
      if (!matched?.id) continue
      const nextStock = Math.max(0, Number(matched.stock || 0) - p.qty)
      const stockUpdate = await supabase
        .from('products')
        .update({ stock: nextStock })
        .eq('tenant_id', tenant.id)
        .eq('id', matched.id)

      if (stockUpdate.error) throw new Error(stockUpdate.error.message)
      matched.stock = nextStock
    }
  }

  return insertedOrder.data
}

export function createWhatsAppRedirect(order: any, businessNumber: string) {
  const message = buildOrderMessage(order)
  return generateWhatsAppLink(businessNumber, message)
}

export function createCustomerWhatsAppConfirmation(order: any, businessName: string) {
  const products: Array<{ name: string; qty: number; price: number }> = JSON.parse(order.ProductsJSON || '[]')
  const date = order.Date ? new Date(order.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  const productLines = products.map((p) => `  • ${p.name} × ${p.qty}  =  ₹${p.price * p.qty}`).join('\n')

  const msg = [
    `✅ *Order Confirmed!*`,
    ``,
    `Hi ${order.CustomerName}, your order has been received by *${businessName || 'our store'}*.`,
    ``,
    `📦 *Order ID:* ${order.OrderID}`,
    `📅 *Date:* ${date}`,
    ``,
    `*Your Items:*`,
    productLines,
    ``,
    `💳 *Payment Summary*`,
    `Subtotal: ₹${order.Subtotal}`,
    `Delivery: ₹${order.DeliveryCharge}`,
    ...(order.CouponCode && order.CouponDiscount > 0
      ? [`Coupon (${order.CouponCode}): −₹${order.CouponDiscount}`]
      : []),
    `*Total: ₹${order.GrandTotal}*`,
    ``,
    `We will contact you shortly to confirm delivery. Thank you for shopping with us! 🙏`,
  ].join('\n')

  // Send confirmation to customer's own WhatsApp
  const customerPhone = String(order.CustomerMobile || '').trim().replace(/\D/g, '')
  const normalizedPhone = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`
  return generateWhatsAppLink(normalizedPhone, msg)
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
    ...(order.CouponCode && order.CouponDiscount > 0
      ? [`Coupon (${order.CouponCode}): −₹${order.CouponDiscount}`]
      : []),
    `*Total: ₹${order.GrandTotal}*`,
    `Payment: Cash on Delivery (WhatsApp)`,
    ``,
    `Please confirm this order. Thank you! 🙏`,
  ].join('\n')

  return msg
}

export default { createOrder, createWhatsAppRedirect, createCustomerWhatsAppConfirmation }
