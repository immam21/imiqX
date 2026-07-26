import { NextResponse } from 'next/server'
import { getTenantEntitlements, getTenantRowFromRequest, getTenantSettings } from '../../../../lib/tenantDb'

function getSetting(kv: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const v = String(kv[key] || '').trim()
    if (v) return v
  }
  return ''
}

function extractErrorMessage(err: unknown) {
  if (!err) return 'Unable to create payment order'
  if (typeof err === 'string') return err

  const anyErr = err as any
  const nested =
    anyErr?.error?.description ||
    anyErr?.error?.reason ||
    anyErr?.description ||
    anyErr?.message

  if (nested && String(nested).trim()) return String(nested).trim()
  return 'Unable to create payment order'
}

function isPlaceholderKey(value: string) {
  const v = String(value || '').trim()
  if (!v) return true
  return /X{6,}/.test(v)
}

export async function POST(request: Request) {
  try {
    const tenant = await getTenantRowFromRequest()
    const entitlements = await getTenantEntitlements(tenant.id)
    if (entitlements.features.online_payments === false) {
      return NextResponse.json({ error: 'Online payment is locked for this subscription plan' }, { status: 403 })
    }
    const kv = await getTenantSettings(tenant.id)

    const keyId = getSetting(kv, 'RazorpayKeyID', 'RazorpayKeyId') || (process.env.RAZORPAY_KEY_ID ?? '')
    const keySecret = getSetting(kv, 'RazorpayKeySecret') || (process.env.RAZORPAY_KEY_SECRET ?? '')

    if (!keyId || !keySecret || isPlaceholderKey(keyId) || isPlaceholderKey(keySecret)) {
      return NextResponse.json({ error: 'Razorpay keys are missing or placeholder values. Add valid test/live keys for this tenant.' }, { status: 500 })
    }

    const { amount } = await request.json()
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const payload = {
      amount: Math.round(numericAmount * 100), // paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const rpRaw = await rpRes.text()
    let rpData: any = null
    try {
      rpData = rpRaw ? JSON.parse(rpRaw) : null
    } catch {
      rpData = null
    }

    if (!rpRes.ok) {
      const message =
        String(rpData?.error?.description || rpData?.error?.reason || rpData?.error?.code || '').trim() ||
        `Razorpay request failed (${rpRes.status})`
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const orderId = String(rpData?.id || '')
    const orderAmount = Number(rpData?.amount || payload.amount)
    const orderCurrency = String(rpData?.currency || 'INR')
    if (!orderId) {
      return NextResponse.json({ error: 'Razorpay returned an invalid order response' }, { status: 500 })
    }

    return NextResponse.json({
      razorpayOrderId: orderId,
      amount: orderAmount,
      currency: orderCurrency,
      keyId,
    })
  } catch (err: unknown) {
    const message = extractErrorMessage(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
