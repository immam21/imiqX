import { NextResponse } from 'next/server'
import { getTenantRowFromRequest, getTenantSettings } from '../../../../lib/tenantDb'
import { createAdminToken, getTenantAdminCredentials } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getTenantConfig } from '../../../../lib/tenant'
import dummyCreds from '../../../../docs/tenant-dummy-credentials.json'

function isTransientAuthError(error: unknown) {
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

function isTenantNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /tenant not found/i.test(message)
}

async function withTransientRetry<T>(operation: () => PromiseLike<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientAuthError(error) || index === attempts - 1) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown auth error'))
}

function compactKey(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getDummyCredentialForHint(hint: string) {
  const compactHint = compactKey(hint)
  const rows = Array.isArray(dummyCreds) ? dummyCreds : []
  return rows.find((row: any) => {
    const code = compactKey(String(row?.tenantCode || ''))
    const name = compactKey(String(row?.businessName || ''))
    return compactHint && (code === compactHint || name === compactHint)
  }) as any
}

async function resolveTenantForAuth() {
  try {
    return await getTenantRowFromRequest()
  } catch (error) {
    if (!isTransientAuthError(error)) {
      throw error
    }
  }

  const tenantCfg = await getTenantConfig()
  const hint = String(tenantCfg.tenantId || '').trim()
  if (!hint) {
    throw new Error('Tenant context missing for admin login')
  }

  const supabase = getSupabaseAdmin()
  const compactHint = compactKey(hint)

  const byCode = await withTransientRetry(() =>
    supabase
      .from('tenants')
      .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
      .ilike('tenant_code', hint.toLowerCase())
      .limit(1)
      .maybeSingle()
  )
  if (!byCode.error && byCode.data) return byCode.data

  const bySid = await withTransientRetry(() =>
    supabase
      .from('tenants')
      .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
      .ilike('sid', hint.toUpperCase())
      .limit(1)
      .maybeSingle()
  )
  if (!bySid.error && bySid.data) return bySid.data

  const byScan = await withTransientRetry(() =>
    supabase
      .from('tenants')
      .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
      .limit(500)
  )

  if (byScan.error) throw new Error(byScan.error.message)
  const rows = (byScan.data || []) as Array<any>
  const matched = rows.find((row) => {
    const tenantCode = compactKey(String(row.tenant_code || ''))
    const sid = compactKey(String(row.sid || ''))
    const businessName = compactKey(String(row.business_name || ''))
    return compactHint && (tenantCode === compactHint || sid === compactHint || businessName === compactHint)
  })

  if (!matched) {
    throw new Error(`Tenant not found for admin login hint '${hint}'`)
  }

  return matched
}

export async function POST(request: Request) {
  let loginId = ''
  let password = ''

  try {
    const body = await request.json().catch(() => null)
    loginId = String(body?.loginId || '').trim()
    password = String(body?.password || '')
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  if (!loginId || !password) {
    return NextResponse.json({ error: 'loginId and password are required' }, { status: 400 })
  }

  try {
    const result = await withTransientRetry(async () => {
      const tenant = await resolveTenantForAuth()
      const kv = await getTenantSettings(tenant.id)
      const dashboardAccess = String(kv.DashboardAccess || kv.dashboardAccess || 'UNLOCKED').trim().toUpperCase()
      if (dashboardAccess === 'LOCK_DASHBOARD') {
        return { response: NextResponse.json({ error: 'Dashboard access has been locked. Contact platform admin.' }, { status: 403 }) }
      }

      const fallbackTenantId = tenant.tenant_code || tenant.sid || ''
      const { expectedTenantId, expectedLoginId, expectedPassword } = await getTenantAdminCredentials(tenant.id, fallbackTenantId)
      if (!expectedPassword) {
        return { response: NextResponse.json({ error: 'Admin password not configured' }, { status: 500 }) }
      }

      if (loginId.toLowerCase() !== String(expectedLoginId).trim().toLowerCase()) {
        return { response: NextResponse.json({ error: 'Invalid login ID or password' }, { status: 401 }) }
      }
      if (password !== expectedPassword) {
        return { response: NextResponse.json({ error: 'Invalid login ID or password' }, { status: 401 }) }
      }

      const token = createAdminToken({ loginId: expectedLoginId, tenantId: expectedTenantId, password: expectedPassword })
      return { response: NextResponse.json({ ok: true, token, tenantId: expectedTenantId }) }
    })

    return result.response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '')
    if (isTenantNotFoundError(error)) {
      return NextResponse.json({ error: 'Tenant not found or inactive for this admin URL. Please verify the client URL.' }, { status: 404 })
    }

    if (isTransientAuthError(error)) {
      const tenantCfg = await getTenantConfig().catch(() => null)
      const fallback = tenantCfg ? getDummyCredentialForHint(tenantCfg.tenantId || '') : null

      if (fallback) {
        const expectedLoginId = String(fallback.adminLoginId || '').trim()
        const expectedPassword = String(fallback.adminPassword || '').trim()
        const expectedTenantId = String(fallback.tenantCode || tenantCfg?.tenantId || '').trim()

        if (expectedLoginId && expectedPassword) {
          if (loginId.toLowerCase() !== expectedLoginId.toLowerCase() || password !== expectedPassword) {
            return NextResponse.json({ error: 'Invalid login ID or password' }, { status: 401 })
          }

          const token = createAdminToken({
            loginId: expectedLoginId,
            tenantId: expectedTenantId,
            password: expectedPassword,
            authSource: 'fallback_dummy',
          })
          return NextResponse.json({ ok: true, token, tenantId: expectedTenantId })
        }
      }

      return NextResponse.json({ error: 'Temporary tenant lookup issue. Please try again.' }, { status: 503 })
    }
    return NextResponse.json({ error: message || 'Authentication failed' }, { status: 400 })
  }
}
