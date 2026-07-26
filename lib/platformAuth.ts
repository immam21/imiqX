import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from './supabaseAdmin'

const ACCESS_TOKEN_TTL_SEC = Number(process.env.PLATFORM_ACCESS_TOKEN_TTL_SEC || 900)
const REFRESH_TOKEN_TTL_SEC = Number(process.env.PLATFORM_REFRESH_TOKEN_TTL_SEC || 60 * 60 * 24 * 14)
const ISSUER = 'imiqx-platform'

type PlatformTokenType = 'access' | 'refresh'

type PlatformClaims = JWTPayload & {
  typ: PlatformTokenType
  uid: string
  tenant_id?: string
  scope: 'platform' | 'tenant'
  role_keys: string[]
}

function isTransientDbError(message: string) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('econn') ||
    text.includes('enotfound') ||
    text.includes('etimedout')
  )
}

async function retryOnTransient<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error || '')
      if (!isTransientDbError(message) || index === attempts - 1) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown auth data error'))
}

function getJwtSecret() {
  const secret = process.env.PLATFORM_JWT_SECRET || process.env.JWT_SECRET || ''
  if (!secret.trim()) throw new Error('Missing PLATFORM_JWT_SECRET')
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function createAccessToken(input: {
  userId: string
  tenantId?: string
  scope: 'platform' | 'tenant'
  roleKeys: string[]
}) {
  const now = Math.floor(Date.now() / 1000)
  const claims: PlatformClaims = {
    iss: ISSUER,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SEC,
    typ: 'access',
    uid: input.userId,
    tenant_id: input.tenantId,
    scope: input.scope,
    role_keys: input.roleKeys,
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SEC)
    .sign(getJwtSecret())
}

export async function createRefreshToken(input: {
  userId: string
  tenantId?: string
  scope: 'platform' | 'tenant'
  roleKeys: string[]
}) {
  const now = Math.floor(Date.now() / 1000)
  const claims: PlatformClaims = {
    iss: ISSUER,
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SEC,
    typ: 'refresh',
    uid: input.userId,
    tenant_id: input.tenantId,
    scope: input.scope,
    role_keys: input.roleKeys,
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_TTL_SEC)
    .sign(getJwtSecret())
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), { issuer: ISSUER })
  const claims = payload as PlatformClaims
  if (!claims.uid || !claims.typ || !claims.scope) throw new Error('Invalid token payload')
  return claims
}

export async function hashOpaqueToken(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Buffer.from(bytes).toString('hex')
}

export async function issueSessionTokens(input: {
  userId: string
  tenantId?: string
  scope: 'platform' | 'tenant'
  roleKeys: string[]
  userAgent?: string
  ipAddress?: string
}) {
  return retryOnTransient(async () => {
    const supabase = getSupabaseAdmin()

    const accessToken = await createAccessToken(input)
    const refreshToken = await createRefreshToken(input)
    const refreshHash = await hashOpaqueToken(refreshToken)

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000).toISOString()

    const { error } = await supabase.from('refresh_tokens').insert({
      user_id: input.userId,
      tenant_id: input.tenantId || null,
      token_hash: refreshHash,
      expires_at: expiresAt,
      user_agent: input.userAgent || null,
      ip_address: input.ipAddress || null,
    })

    if (error) throw new Error(error.message)

    return { accessToken, refreshToken, expiresAt }
  })
}

export async function revokeRefreshToken(refreshToken: string) {
  await retryOnTransient(async () => {
    const supabase = getSupabaseAdmin()
    const tokenHash = await hashOpaqueToken(refreshToken)

    const { error } = await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)

    if (error) throw new Error(error.message)
  })
}

export async function findUserForLogin(input: { usernameOrEmail: string; scope: 'platform' | 'tenant'; tenantId?: string }) {
  return retryOnTransient(async () => {
    const supabase = getSupabaseAdmin()
    const value = String(input.usernameOrEmail || '').trim().toLowerCase()

    const q = supabase
      .from('users')
      .select('id,tenant_id,user_type,username,email,password_hash,is_active')
      .eq('is_active', true)

    if (input.scope === 'platform') {
      q.is('tenant_id', null).eq('user_type', 'platform')
    } else {
      if (!input.tenantId) throw new Error('tenantId required for tenant login')
      q.eq('tenant_id', input.tenantId).eq('user_type', 'tenant')
    }

    const { data, error } = await q.or(`username.ilike.${value},email.ilike.${value}`).limit(1).maybeSingle()

    if (error) throw new Error(error.message)
    return data || null
  })
}

export async function getUserRoleKeys(userId: string) {
  return retryOnTransient(async () => {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_roles')
      .select('roles(key)')
      .eq('user_id', userId)

    if (error) throw new Error(error.message)

    const keys = new Set<string>()
    for (const row of (data || []) as Array<{ roles?: { key?: string } | null }>) {
      if (row.roles?.key) keys.add(row.roles.key)
    }

    return Array.from(keys)
  })
}
