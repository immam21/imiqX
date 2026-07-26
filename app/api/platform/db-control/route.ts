import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requirePlatformAdmin } from '../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../lib/security'

type DbColumn = {
  column_name: string
  data_type: string
  is_nullable: 'YES' | 'NO'
  column_default: string | null
  ordinal_position: number
}

type RowPayload = Record<string, unknown>

const MAX_ROWS = 200

function toSafeTableName(value: string) {
  const table = String(value || '').trim()
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) throw new Error('Invalid table name')
  return table
}

function normalizePrimaryKey(columns: DbColumn[], inputPk?: string) {
  const candidate = String(inputPk || '').trim()
  if (candidate) return candidate
  const idColumn = columns.find((col) => col.column_name === 'id')
  return idColumn?.column_name || columns[0]?.column_name || 'id'
}

function sanitizeRowForInsert(row: RowPayload, columns: DbColumn[]) {
  const colSet = new Set(columns.map((col) => col.column_name))
  const clean: RowPayload = {}

  for (const [key, value] of Object.entries(row || {})) {
    if (!colSet.has(key)) continue
    clean[key] = value
  }

  if ('id' in clean && (clean.id === '' || clean.id === null)) {
    delete clean.id
  }

  return clean
}

function sanitizeRowForPatch(row: RowPayload, columns: DbColumn[]) {
  const clean = sanitizeRowForInsert(row, columns)
  delete clean.id
  return clean
}

async function listTables() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE')
    .order('table_name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []).map((row: any) => String(row.table_name || '')).filter(Boolean)
}

async function getColumns(tableName: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name,data_type,is_nullable,column_default,ordinal_position')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .order('ordinal_position', { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []) as DbColumn[]
}

async function loadRows(tableName: string, pk: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order(pk, { ascending: false })
    .limit(MAX_ROWS)

  if (!error) return { rows: data || [], warning: null as string | null }

  const fallback = await supabase
    .from(tableName)
    .select('*')
    .limit(MAX_ROWS)

  if (fallback.error) throw new Error(fallback.error.message)
  return { rows: fallback.data || [], warning: `Ordered by ${pk} failed. Showing unsorted rows.` }
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(['super_admin', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const url = new URL(request.url)
    const tableParam = String(url.searchParams.get('table') || '').trim()

    const tables = await listTables()
    if (!tableParam) {
      return NextResponse.json({ tables, defaultTable: tables[0] || null })
    }

    const table = toSafeTableName(tableParam)
    if (!tables.includes(table)) {
      return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 400 })
    }

    const columns = await getColumns(table)
    const primaryKey = normalizePrimaryKey(columns, url.searchParams.get('primaryKey') || undefined)
    const { rows, warning } = await loadRows(table, primaryKey)

    return NextResponse.json({
      table,
      primaryKey,
      tables,
      columns,
      rows,
      warning,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load table data' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-db-control-post:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin(['super_admin', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const action = String(body?.action || '').trim()
    const table = toSafeTableName(String(body?.table || ''))

    const tables = await listTables()
    if (!tables.includes(table)) return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 400 })

    const columns = await getColumns(table)
    const pk = normalizePrimaryKey(columns, body?.primaryKey)
    const supabase = getSupabaseAdmin()

    if (action === 'insert') {
      const row = sanitizeRowForInsert((body?.row || {}) as RowPayload, columns)
      const { data, error } = await supabase.from(table).insert(row).select('*').limit(1)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, row: (data || [])[0] || null })
    }

    if (action === 'update') {
      const row = sanitizeRowForPatch((body?.row || {}) as RowPayload, columns)
      const pkValue = body?.primaryKeyValue
      if (pkValue === undefined || pkValue === null || pkValue === '') {
        return NextResponse.json({ error: `primaryKeyValue is required for update (${pk})` }, { status: 400 })
      }

      const { data, error } = await supabase
        .from(table)
        .update(row)
        .eq(pk, pkValue)
        .select('*')
        .limit(1)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, row: (data || [])[0] || null })
    }

    if (action === 'delete') {
      const pkValue = body?.primaryKeyValue
      if (pkValue === undefined || pkValue === null || pkValue === '') {
        return NextResponse.json({ error: `primaryKeyValue is required for delete (${pk})` }, { status: 400 })
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq(pk, pkValue)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 })
  }
}
