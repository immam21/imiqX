import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { getTenantRowFromRequest } from '../../../lib/tenantDb'
import { verifyAdminRequest } from '../../../lib/adminAuth'

function isTransientLeadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  const text = message.toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('econn') ||
    text.includes('enotfound') ||
    text.includes('etimedout')
  )
}

async function withTransientRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientLeadError(error) || index === attempts - 1) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown leads error'))
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('leads')
      .select('id,sid,name,whatsapp,source,created_at,browser_id')
      .eq('tenant_id', auth.tenantDbId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ leads: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, mobile } = await request.json()

    if (!name || !mobile) {
      return NextResponse.json({ error: 'Name and mobile are required' }, { status: 400 })
    }

    await withTransientRetry(async () => {
      const tenant = await getTenantRowFromRequest()
      const supabase = getSupabaseAdmin()
      const sid = `L${Date.now().toString().slice(-4)}`
      const { error } = await supabase.from('leads').insert({
        sid: sid.length <= 5 ? sid : null,
        tenant_id: tenant.id,
        name: String(name).slice(0, 100),
        whatsapp: String(mobile).slice(0, 20),
        source: 'popup',
        browser_id: request.headers.get('x-forwarded-for') || 'web',
      })

      if (error) throw new Error(error.message)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lead API error:', error)
    if (isTransientLeadError(error)) {
      return NextResponse.json({ error: 'Temporary issue while saving lead. Please try again.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }
}
