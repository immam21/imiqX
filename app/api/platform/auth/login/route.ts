import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  findUserForLogin,
  getUserRoleKeys,
  issueSessionTokens,
  verifyPassword,
} from '../../../../../lib/platformAuth'
import { auditLog } from '../../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../../lib/security'

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(3).max(150),
  password: z.string().min(8).max(200),
})

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`platform-login:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      })
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const { usernameOrEmail, password } = parsed.data
    const user = await findUserForLogin({ usernameOrEmail, scope: 'platform' })
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const roleKeys = await getUserRoleKeys(user.id)
    const { accessToken, refreshToken, expiresAt } = await issueSessionTokens({
      userId: user.id,
      scope: 'platform',
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
      maxAge: 60 * 60 * 4, // 4 hours
    })

    response.cookies.set('platform_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/platform/auth',
      maxAge: 60 * 60 * 24 * 14,
    })

    await auditLog({
      action: 'platform.auth.login',
      entityType: 'users',
      entityId: user.id,
      metadata: { usernameOrEmail },
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    const isTransient = /fetch failed|network|econn|enotfound|etimedout/i.test(message)
    const status = /missing platform_jwt_secret/i.test(message) ? 500 : isTransient ? 503 : 400
    const safeError = isTransient
      ? 'Authentication service is temporarily unavailable. Please retry.'
      : message
    return NextResponse.json({ error: safeError }, { status })
  }
}
