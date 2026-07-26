import { cookies, headers } from 'next/headers'
import { verifyToken } from './platformAuth'
import { getSupabaseAdmin } from './supabaseAdmin'

export type SessionContext = {
  userId: string
  scope: 'platform' | 'tenant'
  tenantId?: string
  roleKeys: string[]
}

function hasRole(roleKeys: string[], expected: string[]) {
  const set = new Set(roleKeys)
  return expected.some((r) => set.has(r))
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const h = await headers()
  const c = await cookies()

  const bearer = h.get('authorization')
  const tokenFromHeader = bearer?.startsWith('Bearer ') ? bearer.slice(7).trim() : ''
  const token = tokenFromHeader || c.get('platform_access_token')?.value || ''
  if (!token) return null

  try {
    const payload = await verifyToken(token)
    if (payload.typ !== 'access') return null

    return {
      userId: payload.uid,
      scope: payload.scope,
      tenantId: payload.tenant_id,
      roleKeys: payload.role_keys || [],
    }
  } catch {
    return null
  }
}

export async function requirePlatformAdmin(expectedRoles: string[] = ['super_admin', 'admin']) {
  const session = await getSessionContext()
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' }
  if (session.scope !== 'platform') return { ok: false as const, status: 403, error: 'Forbidden' }
  if (!hasRole(session.roleKeys, expectedRoles)) return { ok: false as const, status: 403, error: 'Insufficient role' }
  return { ok: true as const, session }
}

export async function requireTenantUser() {
  const session = await getSessionContext()
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' }
  if (session.scope !== 'tenant' || !session.tenantId) return { ok: false as const, status: 403, error: 'Forbidden' }
  return { ok: true as const, session }
}

export async function assertTenantAccessOrAdmin(targetTenantId: string) {
  const session = await getSessionContext()
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' }

  if (session.scope === 'platform') {
    if (hasRole(session.roleKeys, ['super_admin', 'admin', 'support', 'operations'])) {
      return { ok: true as const, session }
    }
    return { ok: false as const, status: 403, error: 'Insufficient role' }
  }

  if (session.scope === 'tenant' && session.tenantId === targetTenantId) {
    return { ok: true as const, session }
  }

  return { ok: false as const, status: 403, error: 'Forbidden' }
}

export async function auditLog(input: {
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
  tenantId?: string
}) {
  try {
    const supabase = getSupabaseAdmin()
    const session = await getSessionContext()
    const h = await headers()

    await supabase.from('audit_logs').insert({
      tenant_id: input.tenantId || session?.tenantId || null,
      actor_user_id: session?.userId || null,
      actor_type: session?.scope || 'system',
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      metadata: input.metadata || {},
      ip_address: h.get('x-forwarded-for') || null,
      user_agent: h.get('user-agent') || null,
    })
  } catch {
    // Best effort audit logging; do not fail API responses.
  }
}
