import { NextResponse } from 'next/server'
import { revokeRefreshToken } from '../../../../../lib/platformAuth'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../../lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`platform-logout:${ip}`, 60, 60_000)
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

    const refreshToken = headerToken || decodeURIComponent(cookieToken)
    if (refreshToken) {
      await revokeRefreshToken(refreshToken)
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('platform_access_token', '', { httpOnly: true, path: '/', maxAge: 0 })
    response.cookies.set('platform_refresh_token', '', { httpOnly: true, path: '/api/platform/auth', maxAge: 0 })
    return response
  } catch {
    return NextResponse.json({ ok: true })
  }
}
