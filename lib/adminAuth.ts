import { getTenantSettings, getTenantRowFromRequest } from './tenantDb'
import { getTenantConfig } from './tenant'
import dummyCreds from '../docs/tenant-dummy-credentials.json'

type TokenPayload = {
  loginId: string
  tenantId?: string
  password: string
  authSource?: 'primary' | 'fallback_dummy'
}

function normalizeId(value: string) {
  return String(value || '').trim().toLowerCase()
}

function compactKey(value: string) {
  return normalizeId(value).replace(/[^a-z0-9]/g, '')
}

export function createAdminToken(payload: TokenPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function parseAdminToken(token: string): TokenPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    if (!parsed?.password) return null

    // Backward compatible: old tokens stored tenantId only.
    const loginId = String(parsed.loginId || parsed.tenantId || '')
    if (!loginId) return null

    return {
      loginId,
      tenantId: parsed.tenantId ? String(parsed.tenantId) : undefined,
      password: String(parsed.password),
      authSource: parsed.authSource === 'fallback_dummy' ? 'fallback_dummy' : 'primary',
    }
  } catch {
    return null
  }
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

function isDummyCredentialMatch(parsed: TokenPayload, hint: string) {
  const dummy = getDummyCredentialForHint(hint)
  if (!dummy) return false
  const expectedLoginId = String(dummy.adminLoginId || '').trim()
  const expectedPassword = String(dummy.adminPassword || '').trim()
  if (!expectedLoginId || !expectedPassword) return false
  return normalizeId(parsed.loginId) === normalizeId(expectedLoginId) && parsed.password === expectedPassword
}

export async function getTenantAdminCredentials(tenantDbId: string, fallbackTenantId: string) {
  const kv = await getTenantSettings(tenantDbId)
  const expectedTenantId = (kv.AdminTenantID || kv.AdminTenantId || kv.admintenantid || fallbackTenantId || '').trim()
  const expectedLoginId = (kv.AdminLoginID || kv.AdminLoginId || kv.adminloginid || expectedTenantId || '').trim()
  const expectedPassword = (kv.AdminPassword || kv.adminpassword || process.env.ADMIN_PASSWORD || '').trim()
  return { expectedTenantId, expectedLoginId, expectedPassword }
}

export async function verifyAdminRequest(request: Request): Promise<{ ok: true; tenantDbId: string; tenantId: string } | { ok: false; status: number; error: string }> {
  const token = request.headers.get('x-admin-token') || ''
  const parsed = parseAdminToken(token)
  if (!parsed) return { ok: false, status: 401, error: 'Unauthorized' }

  // Admin APIs must execute with explicit tenant context to avoid cross-tenant fallback.
  const tenantSource = String(request.headers.get('x-tenant-source') || '').trim().toLowerCase()
  if (tenantSource !== 'path' && tenantSource !== 'host') {
    return { ok: false, status: 401, error: 'Tenant context missing. Open admin via tenant URL.' }
  }

  const tenant = await getTenantRowFromRequest()
  const fallbackTenantId = tenant.tenant_code || tenant.sid || ''

  const { expectedTenantId, expectedLoginId, expectedPassword } = await getTenantAdminCredentials(tenant.id, fallbackTenantId)
  if (!expectedPassword) return { ok: false, status: 500, error: 'Admin password not configured for tenant' }

  const primaryMatch =
    normalizeId(parsed.loginId) === normalizeId(expectedLoginId) &&
    parsed.password === expectedPassword

  if (!primaryMatch) {
    // Dev-only compatibility path for tokens issued during transient DB outages.
    if (process.env.NODE_ENV !== 'production' && parsed.authSource === 'fallback_dummy') {
      const tenantHint = String(parsed.tenantId || tenant.tenant_code || tenant.business_name || '').trim()
      if (!isDummyCredentialMatch(parsed, tenantHint)) {
        return { ok: false, status: 401, error: 'Unauthorized' }
      }
    } else {
      return { ok: false, status: 401, error: 'Unauthorized' }
    }
  }

  // Keep tenantId from DB for normal tokens; fallback token can carry tenant slug.
  const effectiveTenantId = String(parsed.tenantId || expectedTenantId || fallbackTenantId).trim() || expectedTenantId
  return { ok: true, tenantDbId: tenant.id, tenantId: effectiveTenantId }
}
