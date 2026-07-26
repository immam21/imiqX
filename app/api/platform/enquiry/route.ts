import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

type EnquiryInput = {
  name?: string
  businessName?: string
  whatsapp?: string
  city?: string
  message?: string
}

function clean(value: unknown, max = 160) {
  return String(value || '').trim().slice(0, max)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EnquiryInput

    const name = clean(body.name, 100)
    const businessName = clean(body.businessName, 120)
    const whatsapp = clean(body.whatsapp, 25)
    const city = clean(body.city, 80)
    const message = clean(body.message, 500)

    const missing: string[] = []
    if (!name) missing.push('name')
    if (!businessName) missing.push('businessName')
    if (!whatsapp) missing.push('whatsapp')
    if (!city) missing.push('city')
    if (!message) missing.push('message')

    if (missing.length > 0) {
      return NextResponse.json({ error: 'All fields are mandatory.', missing }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const payload = {
      name,
      business_name: businessName,
      whatsapp,
      city,
      message,
      source: 'platform_enquiry',
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
    }

    const { error } = await supabase.from('platform_sales_enquiries').insert(payload)
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Platform enquiry API error:', error)
    return NextResponse.json({ error: 'Failed to save enquiry' }, { status: 500 })
  }
}