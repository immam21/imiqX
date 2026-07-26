import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

let cached: SupabaseClient | null = null

function pickFirstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim()) return value.trim()
  }

  // Fallback for environments where Next does not hydrate process.env from .env.local as expected.
  const fromFile = pickFromDotEnvLocal(keys)
  if (fromFile) return fromFile

  return ''
}

function pickFromDotEnvLocal(keys: string[]) {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const raw = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '')
    const lines = raw.split(/\r?\n/)

    for (const key of keys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const matcher = new RegExp(`^\\s*${escapedKey}\\s*=\\s*(.*)\\s*$`)
      const line = lines.find((l) => matcher.test(l))
      if (!line) continue
      const value = (line.match(matcher)?.[1] || '').trim()
      if (!value) continue
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1)
      }
      return value
    }
  } catch {
    // Ignore file-read issues and fall back to normal missing-env handling.
  }

  return ''
}

export function getSupabaseAdmin() {
  if (cached) return cached

  const url = pickFirstEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
  const serviceKey = pickFirstEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')

  if (!url || !serviceKey) {
    const missing: string[] = []
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    throw new Error(`Supabase server credentials are not configured. Missing: ${missing.join(', ')}`)
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
    global: { headers: { 'x-application-name': 'imiqx-nextjs' } },
  })

  return cached
}
