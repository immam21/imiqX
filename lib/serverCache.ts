/**
 * Shared in-memory cache for server-side API responses.
 * Keyed by tenant ID + endpoint name.
 * TTL-based: entries expire after `ttlMs` milliseconds.
 *
 * This avoids hammering Supabase on every concurrent request —
 * the first request fetches from DB, all subsequent requests within
 * the TTL window are served from memory.
 */

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function invalidateTenant(tenantId: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${tenantId}:`)) store.delete(key)
  }
}

/** Cache TTLs */
export const TTL = {
  SETTINGS: 60_000,   // 60 s — business settings, rarely change
  PRODUCTS: 30_000,   // 30 s — product catalog
  BANNERS:  120_000,  // 2 min — banners, very rarely change
  MANIFEST: 120_000,  // 2 min — PWA manifest
}
