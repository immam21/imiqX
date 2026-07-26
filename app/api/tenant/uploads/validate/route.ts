import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantUser } from '../../../../../lib/platformGuards'
import { getClientIp, rateLimit, validateUploadMeta, verifyCsrf } from '../../../../../lib/security'

const schema = z.object({
  filename: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(3).max(120),
  sizeBytes: z.number().int().positive(),
})

const imagePolicy = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxSizeBytes: 5 * 1024 * 1024,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`tenant-upload-validate:${ip}`, 120, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requireTenantUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const verdict = validateUploadMeta(parsed.data, imagePolicy)
    if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 })

    return NextResponse.json({ ok: true, allowed: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
