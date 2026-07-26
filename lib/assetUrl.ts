export function normalizeAssetUrl(input?: string | null): string {
  const value = String(input || '').trim()
  if (!value) return ''

  // Already proxied by our own asset endpoint.
  if (value.startsWith('/api/asset?')) return value

  if (value.includes('drive.usercontent.google.com')) return value
  if (!value.includes('drive.google.com')) return value

  try {
    const url = new URL(value)
    const idFromQuery = url.searchParams.get('id')?.trim()
    const idFromPath = url.pathname.match(/\/d\/([^/]+)/)?.[1]?.trim()
    const fileId = idFromQuery || idFromPath

    if (fileId) {
      return `https://drive.usercontent.google.com/download?id=${fileId}&export=view`
    }
  } catch {
    return value
  }

  return value
}

export function toRenderableAssetUrl(input?: string | null): string {
  const normalized = normalizeAssetUrl(input)
  if (!normalized) return ''

  // Keep idempotent when upstream already stored the proxied URL.
  if (normalized.startsWith('/api/asset?')) return normalized

  if (normalized.includes('drive.google.com') || normalized.includes('drive.usercontent.google.com')) {
    return `/api/asset?url=${encodeURIComponent(normalized)}`
  }

  return normalized
}