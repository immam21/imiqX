import { NextResponse } from 'next/server'
import { newCsrfToken } from '../../../../../lib/security'

export async function GET() {
  const token = newCsrfToken()
  const response = NextResponse.json({ csrfToken: token })

  response.cookies.set('csrf_token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })

  return response
}
