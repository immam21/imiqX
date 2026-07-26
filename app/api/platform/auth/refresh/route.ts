import { NextResponse } from 'next/server'
import { getUserRoleKeys, hashOpaqueToken, issueSessionTokens, revokeRefreshToken, verifyToken } from '../../../../../lib/platformAuth'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../../lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`platform-refresh:${ip}`, 30, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      })
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    }

    const headerToken = request.headers.get('x-refresh-token') || ''
    const cookie = request.headers.get('cookie') || ''
    const cookieToken = cookie
      .split(';')
      .map((s) => s.trim())
      .find((c) => c.startsWith('platform_refresh_token='))
      ?.split('=')[1] || ''

    const token = headerToken || decodeURIComponent(cookieToken)
    if (!token) return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 })

    const payload = await verifyToken(token)
    if (payload.typ !== 'refresh') return NextResponse.json({ error: 'Invalid token type' }, { status: 401 })

    const roleKeys = await getUserRoleKeys(payload.uid)
    const { accessToken, refreshToken, expiresAt } = await issueSessionTokens({
      userId: payload.uid,
      tenantId: payload.tenant_id,
      scope: payload.scope,
      roleKeys,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })

    await revokeRefreshToken(token)
    await hashOpaqueToken(refreshToken)

    const response = NextResponse.json({ ok: true, expiresAt })
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

    return response
  } catch {
    return NextResponse.json({ error: 'Unable to refresh token' }, { status: 401 })
  }
}
