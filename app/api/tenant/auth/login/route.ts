import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findUserForLogin, getUserRoleKeys, issueSessionTokens, verifyPassword } from '../../../../../lib/platformAuth'
import { getTenantRowFromRequest } from '../../../../../lib/tenantDb'
import { auditLog } from '../../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../../lib/security'

const schema = z.object({
  usernameOrEmail: z.string().trim().min(3).max(150),
  password: z.string().min(8).max(200),
})

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`tenant-login:${ip}`, 20, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      })
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    }

    const tenant = await getTenantRowFromRequest()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const user = await findUserForLogin({
      usernameOrEmail: parsed.data.usernameOrEmail,
      scope: 'tenant',
      tenantId: tenant.id,
    })

    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const ok = await verifyPassword(parsed.data.password, user.password_hash)
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const roleKeys = await getUserRoleKeys(user.id)
    const { accessToken, refreshToken, expiresAt } = await issueSessionTokens({
      userId: user.id,
      tenantId: tenant.id,
      scope: 'tenant',
      roleKeys,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })

    const response = NextResponse.json({ ok: true, expiresAt, roleKeys })
    response.cookies.set('platform_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    })

    response.cookies.set('platform_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/platform/auth',
      maxAge: 60 * 60 * 24 * 14,
    })

    await auditLog({
      action: 'tenant.auth.login',
      entityType: 'users',
      entityId: user.id,
      tenantId: tenant.id,
      metadata: { usernameOrEmail: parsed.data.usernameOrEmail },
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 400 })
  }
}
