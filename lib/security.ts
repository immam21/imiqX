import crypto from 'crypto'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function nowMs() {
  return Date.now()
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const first = forwarded.split(',')[0]?.trim()
  if (first) return first
  return request.headers.get('x-real-ip') || 'unknown'
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = nowMs()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    const next: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, next)
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    }
  }

  current.count += 1
  buckets.set(key, current)

  const allowed = current.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  }
}

function parseCookieValue(cookieHeader: string, key: string) {
  return (
    cookieHeader
      .split(';')
      .map((s) => s.trim())
      .find((c) => c.startsWith(`${key}=`))
      ?.slice(key.length + 1) || ''
  )
}

function parseCookieValues(cookieHeader: string, key: string) {
  return cookieHeader
    .split(';')
    .map((s) => s.trim())
    .filter((c) => c.startsWith(`${key}=`))
    .map((c) => c.slice(key.length + 1))
    .filter(Boolean)
}

export function newCsrfToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function extractCsrfFromCookie(request: Request) {
  const rawCookie = request.headers.get('cookie') || ''
  return decodeURIComponent(parseCookieValue(rawCookie, 'csrf_token'))
}

export function verifyCsrf(request: Request) {
  const header = request.headers.get('x-csrf-token') || ''
  if (!header) return false

  const rawCookie = request.headers.get('cookie') || ''
  const cookies = parseCookieValues(rawCookie, 'csrf_token').map((value) => decodeURIComponent(value))
  if (!cookies.length) return false

  const enc = new TextEncoder()
  const headerBuf = enc.encode(header)

  for (const cookie of cookies) {
    const cookieBuf = enc.encode(cookie)
    if (headerBuf.byteLength !== cookieBuf.byteLength) continue
    if (crypto.timingSafeEqual(headerBuf, cookieBuf)) return true
  }

  return false
}

export type UploadMeta = {
  filename: string
  mimeType: string
  sizeBytes: number
}

export type UploadPolicy = {
  allowedMimeTypes: string[]
  maxSizeBytes: number
  allowedExtensions: string[]
}

export function validateUploadMeta(meta: UploadMeta, policy: UploadPolicy) {
  const filename = String(meta.filename || '').trim()
  const mime = String(meta.mimeType || '').trim().toLowerCase()
  const size = Number(meta.sizeBytes || 0)

  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''

  if (!filename || !mime || !size) return { ok: false as const, error: 'Invalid file metadata' }
  if (size <= 0 || size > policy.maxSizeBytes) return { ok: false as const, error: 'File size exceeds allowed limit' }
  if (!policy.allowedMimeTypes.includes(mime)) return { ok: false as const, error: 'Unsupported file type' }
  if (!policy.allowedExtensions.includes(ext)) return { ok: false as const, error: 'Unsupported file extension' }

  return { ok: true as const }
}
