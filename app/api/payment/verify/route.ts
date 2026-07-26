import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getTenantEntitlements, getTenantRowFromRequest, getTenantSettings } from '../../../../lib/tenantDb'

function getSetting(kv: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const v = String(kv[key] || '').trim()
    if (v) return v
  }
  return ''
}

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = await request.json()
    const tenant = await getTenantRowFromRequest()
    const entitlements = await getTenantEntitlements(tenant.id)
    if (entitlements.features.online_payments === false) {
      return NextResponse.json({ error: 'Online payment is locked for this subscription plan' }, { status: 403 })
    }
    const kv = await getTenantSettings(tenant.id)

    const keySecret = getSetting(kv, 'RazorpayKeySecret') || (process.env.RAZORPAY_KEY_SECRET ?? '')
    if (!keySecret) {
      return NextResponse.json({ error: 'Razorpay not configured for this tenant' }, { status: 500 })
    }

    // Verify Razorpay signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed — invalid signature' }, { status: 400 })
    }

    // Mark order as paid in Supabase
    if (orderId) {
      const supabase = getSupabaseAdmin()

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          whatsapp_sent: true,
          payment_method: 'razorpay',
        })
        .eq('tenant_id', tenant.id)
        .eq('order_number', String(orderId))

      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ ok: true, paymentId: razorpay_payment_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
