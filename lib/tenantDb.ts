import { getTenantConfig } from './tenant'
import { getSupabaseAdmin } from './supabaseAdmin'
import { toRenderableAssetUrl } from './assetUrl'
import { headers } from 'next/headers'
import { DEFAULT_FEATURES, mergeFeatureMaps, type SubscriptionFeatureMap } from './subscriptionFeatures'

export type TenantRow = {
  id: string
  sid?: string | null
  tenant_code?: string | null
  business_name?: string | null
  whatsapp_number?: string | null
  currency?: string | null
  logo_url?: string | null
  default_delivery_charge?: number | null
}

export type TenantSubscriptionAccess = {
  hasAccess: boolean
  reason: 'no_subscription' | 'expired' | 'inactive' | 'ok'
  status: string | null
  expiryAt: string | null
  planId: string | null
}

export type TenantClient = {
  id: string
  businessName: string
  logoUrl: string
  tenantCode: string
}

export type TenantBusinessProfile = {
  business_name?: string | null
  logo_url?: string | null
}

export type TenantEntitlements = {
  planId: string | null
  planCode: string | null
  planName: string | null
  features: SubscriptionFeatureMap
  limits: Record<string, unknown>
  featureOverrides: Record<string, unknown>
  limitOverrides: Record<string, unknown>
}

const tenantRowCache = new Map<string, TenantRow>()

function normalize(value: string) {
  return String(value || '').trim().toLowerCase()
}

function compactKey(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, '')
}

function cacheTenantRow(row: TenantRow | null | undefined) {
  if (!row?.id) return

  const keys = [
    `id:${normalize(String(row.id || ''))}`,
    `code:${compactKey(String(row.tenant_code || ''))}`,
    `sid:${compactKey(String(row.sid || ''))}`,
    `name:${compactKey(String(row.business_name || ''))}`,
  ].filter((k) => !k.endsWith(':'))

  for (const key of keys) {
    tenantRowCache.set(key, row)
  }
}

function getCachedTenantRow(input: { hint?: string; host?: string }) {
  const hint = String(input.hint || '')
  const host = String(input.host || '')

  const lookupKeys = [
    `code:${compactKey(hint)}`,
    `sid:${compactKey(hint)}`,
    `name:${compactKey(hint)}`,
    `host:${compactKey(host)}`,
  ].filter((k) => !k.endsWith(':'))

  for (const key of lookupKeys) {
    const row = tenantRowCache.get(key)
    if (row?.id) return row
  }

  return null
}

function isTransientDbError(message: string) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('econn') ||
    text.includes('enotfound') ||
    text.includes('etimedout')
  )
}

async function retryOnTransient<T>(operation: () => PromiseLike<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error || '')
      if (!isTransientDbError(message) || index === attempts - 1) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown tenant lookup error'))
}

function fallbackTenantRowFromConfig(tenant: Awaited<ReturnType<typeof getTenantConfig>>): TenantRow {
  const fallbackId = String(tenant.tenantId || process.env.DEFAULT_TENANT_CODE || 'default').trim() || 'default'
  return {
    id: fallbackId,
    sid: fallbackId.toUpperCase(),
    tenant_code: fallbackId,
    business_name: tenant.businessName || 'Storefront',
    whatsapp_number: tenant.whatsappNumber || null,
    currency: tenant.currency || 'INR',
    logo_url: tenant.logoUrl || null,
    default_delivery_charge: Number(tenant.deliveryCharge || 40),
  }
}

async function findTenantByDomain(hostname: string): Promise<TenantRow | null> {
  const host = normalize(hostname)
  if (!host) return null

  const supabase = getSupabaseAdmin()
  let domainLookup = await retryOnTransient(() =>
    supabase
      .from('tenant_domains')
      .select('tenant_id,is_verified')
      .eq('host', host)
      .limit(1)
      .maybeSingle()
  )

  // Compatibility fallback for installations that still use `domain` column.
  if (domainLookup.error && /column .*domain/i.test(domainLookup.error.message || '')) {
    domainLookup = await retryOnTransient(() =>
      supabase
        .from('tenant_domains')
        .select('tenant_id,is_verified')
        .eq('domain', host)
        .limit(1)
        .maybeSingle()
    )
  }

  // Compatibility fallback for schemas that do not yet have is_verified column.
  if (domainLookup.error && /column .*is_verified/i.test(domainLookup.error.message || '')) {
    const fallback = await retryOnTransient(() =>
      supabase
        .from('tenant_domains')
        .select('tenant_id')
        .or(`host.eq.${host},domain.eq.${host}`)
        .limit(1)
        .maybeSingle()
    )
    domainLookup = fallback as typeof domainLookup
  }

  if (domainLookup.error) {
    if (isTransientDbError(domainLookup.error.message || '')) {
      throw new Error(`Transient tenant domain lookup failed: ${domainLookup.error.message}`)
    }
    throw new Error(`Tenant domain lookup failed: ${domainLookup.error.message}`)
  }
  if (!domainLookup.data?.tenant_id) return null

  const resolvedTenantId = domainLookup.data.tenant_id
  const tenantLookup = await retryOnTransient(() =>
    supabase
      .from('tenants')
      .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
      .eq('id', resolvedTenantId)
      .maybeSingle()
  )

  if (tenantLookup.error) {
    if (isTransientDbError(tenantLookup.error.message || '')) {
      throw new Error(`Transient tenant domain target lookup failed: ${tenantLookup.error.message}`)
    }
    throw new Error(`Tenant domain target lookup failed: ${tenantLookup.error.message}`)
  }
  if (!tenantLookup.data) return null
  const row = tenantLookup.data as TenantRow
  cacheTenantRow(row)
  if (host) tenantRowCache.set(`host:${compactKey(host)}`, row)
  return row
}

async function findTenantByHint(hint: string): Promise<TenantRow | null> {
  const supabase = getSupabaseAdmin()
  const code = normalize(hint)
  const compactCode = compactKey(code)

  if (code) {
    const byCode = await retryOnTransient(() =>
      supabase
        .from('tenants')
        .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
        .ilike('tenant_code', code)
        .limit(1)
        .maybeSingle()
    )
    if (byCode.error) {
      if (isTransientDbError(byCode.error.message || '')) {
        throw new Error(`Transient tenant lookup by tenant_code failed for '${code}': ${byCode.error.message}`)
      }
      throw new Error(`Tenant lookup by tenant_code failed for '${code}': ${byCode.error.message}`)
    }
    if (!byCode.error && byCode.data) {
      const row = byCode.data as TenantRow
      cacheTenantRow(row)
      return row
    }

    const bySid = await retryOnTransient(() =>
      supabase
        .from('tenants')
        .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
        .ilike('sid', code.toUpperCase())
        .limit(1)
        .maybeSingle()
    )
    if (bySid.error) {
      if (isTransientDbError(bySid.error.message || '')) {
        throw new Error(`Transient tenant lookup by sid failed for '${code}': ${bySid.error.message}`)
      }
      throw new Error(`Tenant lookup by sid failed for '${code}': ${bySid.error.message}`)
    }
    if (!bySid.error && bySid.data) {
      const row = bySid.data as TenantRow
      cacheTenantRow(row)
      return row
    }

    // Compatibility fallback: normalize tenant identifiers and business names
    // to match path slugs like "fashionhub" with DB values such as
    // "fashion-hub" or "Fashion Hub".
    const byScan = await retryOnTransient(() =>
      supabase
        .from('tenants')
        .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
        .limit(500)
    )

    if (byScan.error) {
      if (isTransientDbError(byScan.error.message || '')) {
        throw new Error(`Transient tenant lookup scan failed for '${code}': ${byScan.error.message}`)
      }
      throw new Error(`Tenant lookup scan failed for '${code}': ${byScan.error.message}`)
    }

    const rows = (byScan.data || []) as TenantRow[]
    const matched = rows.find((row) => {
      const tenantCode = compactKey(String(row.tenant_code || ''))
      const sid = compactKey(String(row.sid || ''))
      const businessName = compactKey(String(row.business_name || ''))
      return compactCode && (tenantCode === compactCode || sid === compactCode || businessName === compactCode)
    })

    if (matched) {
      cacheTenantRow(matched)
      return matched
    }
  }

  return null
}

async function findAnyTenant(): Promise<TenantRow | null> {
  const supabase = getSupabaseAdmin()
  const lookup = await retryOnTransient(() =>
    supabase
      .from('tenants')
      .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge')
      .limit(1)
      .maybeSingle()
  )

  if (lookup.error) {
    if (isTransientDbError(lookup.error.message || '')) {
      throw new Error(`Transient tenant fallback lookup failed: ${lookup.error.message}`)
    }
    throw new Error(`Tenant fallback lookup failed: ${lookup.error.message}`)
  }
  if (!lookup.data) return null
  const row = lookup.data as TenantRow
  cacheTenantRow(row)
  return row
}

export async function getTenantRowFromRequest(): Promise<TenantRow> {
  const tenant = await getTenantConfig()
  const h = await headers()
  const tenantSource = String(h.get('x-tenant-source') || '').trim().toLowerCase()
  const hint = tenant.tenantId
  const host = normalize(tenant.hostName || '')
  const defaultTenant = String(process.env.DEFAULT_TENANT_CODE || process.env.NEXT_PUBLIC_DEFAULT_TENANT_CODE || '').trim().toLowerCase()
  const isStrictRequest = tenantSource === 'path' || tenantSource === 'host'

  try {
    // Priority 1: explicit custom domain mapping
    if (tenant.hostName && tenant.hostName !== 'localhost') {
      const byDomain = await findTenantByDomain(tenant.hostName)
      if (byDomain) return byDomain
    }

    const byHint = await findTenantByHint(hint)
    if (byHint) return byHint

    // For strict path/host tenant requests, never fall back to other tenants.
    if (!isStrictRequest && defaultTenant) {
      const byDefault = await findTenantByHint(defaultTenant)
      if (byDefault) return byDefault
    }

    // Final safety net for local/shared development where hints can be stale.
    if (!isStrictRequest && (host === 'localhost' || host.startsWith('localhost:') || host.endsWith('.localhost'))) {
      if (defaultTenant) {
        const byLocalFallback = await findTenantByHint(defaultTenant)
        if (byLocalFallback) return byLocalFallback
      }

      const anyTenant = await findAnyTenant()
      if (anyTenant) return anyTenant
    }

    if (isStrictRequest) {
      throw new Error(`Tenant not found for ${tenantSource} hint '${hint || host || 'unknown'}'`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '')
    if (isStrictRequest) {
      if (isTransientDbError(message)) {
        const cached = getCachedTenantRow({ hint, host })
        if (cached) return cached
      }
      throw error instanceof Error ? error : new Error(message)
    }
    if (!isTransientDbError(message)) {
      throw error
    }
  }

  // Graceful fallback for local/dev outages so storefront does not crash.
  return fallbackTenantRowFromConfig(tenant)
}

export async function getTenantSettings(tenantDbId: string): Promise<Record<string, string>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_settings')
    .select('key,value')
    .eq('tenant_id', tenantDbId)

  if (error || !data) return {}

  const out: Record<string, string> = {}
  for (const row of data as Array<{ key: string; value: string }>) {
    if (!row?.key) continue
    out[String(row.key).trim()] = String(row.value ?? '').trim()
  }
  return out
}

export async function getTenantSubscriptionAccess(tenantDbId: string): Promise<TenantSubscriptionAccess> {
  const supabase = getSupabaseAdmin()
  const kv = await getTenantSettings(tenantDbId)
  const accessMode = String(kv.StoreAccessMode || kv.storeAccessMode || 'ACTIVE').trim().toUpperCase()
  const dashboardAccess = String(kv.DashboardAccess || kv.dashboardAccess || 'UNLOCKED').trim().toUpperCase()

  if (dashboardAccess === 'LOCK_DASHBOARD') {
    return { hasAccess: false, reason: 'inactive', status: 'LOCK_DASHBOARD', expiryAt: null, planId: null }
  }

  if (accessMode === 'DEACTIVATE' || accessMode === 'HOLD') {
    return { hasAccess: false, reason: 'inactive', status: accessMode, expiryAt: null, planId: null }
  }

  const modern = await supabase
    .from('tenant_subscriptions')
    .select('status,plan_id,current_period_end,created_at')
    .eq('tenant_id', tenantDbId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let status = ''
  let planId = ''
  let expiry = ''

  if (!modern.error && modern.data) {
    status = String((modern.data as any).status || '')
    planId = String((modern.data as any).plan_id || '')
    expiry = String((modern.data as any).current_period_end || '')
  } else {
    const reducedModern = await supabase
      .from('tenant_subscriptions')
      .select('status,plan_id,created_at')
      .eq('tenant_id', tenantDbId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!reducedModern.error && reducedModern.data) {
      status = String((reducedModern.data as any).status || '')
      planId = String((reducedModern.data as any).plan_id || '')
      expiry = ''
    } else {
    const legacy = await supabase
      .from('tenant_subscriptions')
      .select('status,package_id,ends_at,created_at')
      .eq('tenant_id', tenantDbId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

      if (!legacy.error && legacy.data) {
        status = String((legacy.data as any).status || '')
        planId = String((legacy.data as any).package_id || '')
        expiry = String((legacy.data as any).ends_at || '')
      } else {
        const reducedLegacy = await supabase
          .from('tenant_subscriptions')
          .select('status,package_id,created_at')
          .eq('tenant_id', tenantDbId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (reducedLegacy.error) {
          throw new Error(reducedLegacy.error.message)
        }
        if (!reducedLegacy.data) {
          return { hasAccess: false, reason: 'no_subscription', status: null, expiryAt: null, planId: null }
        }

        status = String((reducedLegacy.data as any).status || '')
        planId = String((reducedLegacy.data as any).package_id || '')
        expiry = ''
      }
    }
  }

  if (!status) {
    return { hasAccess: false, reason: 'no_subscription', status: null, expiryAt: expiry || null, planId: planId || null }
  }

  const s = status.toLowerCase()
  if (['canceled', 'cancelled', 'expired', 'inactive'].includes(s)) {
    return { hasAccess: false, reason: s === 'inactive' ? 'inactive' : 'expired', status, expiryAt: expiry || null, planId: planId || null }
  }

  if (expiry) {
    const end = new Date(expiry)
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return { hasAccess: false, reason: 'expired', status, expiryAt: expiry, planId: planId || null }
    }
  }

  return { hasAccess: true, reason: 'ok', status, expiryAt: expiry || null, planId: planId || null }
}

function parseSettingJsonObject(value: unknown): Record<string, unknown> {
  const text = String(value ?? '').trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Ignore invalid JSON and continue with safe defaults.
  }
  return {}
}

export async function getTenantEntitlements(tenantDbId: string): Promise<TenantEntitlements> {
  const supabase = getSupabaseAdmin()
  const kv = await getTenantSettings(tenantDbId)
  const access = await getTenantSubscriptionAccess(tenantDbId)
  const featureOverrides = parseSettingJsonObject(kv.FeatureOverrides || kv.featureOverrides)
  const limitOverrides = parseSettingJsonObject(kv.LimitOverrides || kv.limitOverrides)

  let planCode: string | null = null
  let planName: string | null = null
  let planFeatures: Record<string, unknown> = { ...DEFAULT_FEATURES }
  let planLimits: Record<string, unknown> = {}

  if (access.planId) {
    const modern = await supabase
      .from('subscription_plans')
      .select('id,plan_code,name,features,limits')
      .eq('id', access.planId)
      .limit(1)
      .maybeSingle()

    if (!modern.error && modern.data) {
      planCode = String((modern.data as any).plan_code || '') || null
      planName = String((modern.data as any).name || '') || null
      const features = (modern.data as any).features
      const limits = (modern.data as any).limits
      if (features && typeof features === 'object' && !Array.isArray(features)) {
        planFeatures = features as Record<string, unknown>
      }
      if (limits && typeof limits === 'object' && !Array.isArray(limits)) {
        planLimits = limits as Record<string, unknown>
      }
    } else {
      const legacy = await supabase
        .from('service_packages')
        .select('id,package_code,package_name')
        .eq('id', access.planId)
        .limit(1)
        .maybeSingle()

      if (!legacy.error && legacy.data) {
        planCode = String((legacy.data as any).package_code || '') || null
        planName = String((legacy.data as any).package_name || '') || null
      }
    }
  }

  return {
    planId: access.planId,
    planCode,
    planName,
    // Feature flags inherit from the assigned plan and can be overridden per tenant.
    features: mergeFeatureMaps(planFeatures, featureOverrides),
    limits: { ...(planLimits || {}), ...(limitOverrides || {}) },
    featureOverrides,
    limitOverrides,
  }
}

export async function getTenantBusinessProfile(tenantDbId: string): Promise<TenantBusinessProfile | null> {
  const supabase = getSupabaseAdmin()
  const lookup = await supabase
    .from('business_profiles')
    .select('business_name,logo_url')
    .eq('tenant_id', tenantDbId)
    .limit(1)
    .maybeSingle()

  if (lookup.error) {
    const message = String(lookup.error.message || '')
    if (isTransientDbError(message) || /relation .*business_profiles.* does not exist/i.test(message)) {
      return null
    }
    throw new Error(`Business profile lookup failed: ${message}`)
  }

  if (!lookup.data) return null
  return lookup.data as TenantBusinessProfile
}

export async function listTenantClients(limit = 24): Promise<TenantClient[]> {
  const supabase = getSupabaseAdmin()

  let query = await supabase
    .from('tenants')
    .select('id,business_name,logo_url,tenant_code,is_active,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  // Compatibility fallback for schemas that do not have activity/timestamp columns.
  if (query.error && /column .* does not exist/i.test(query.error.message || '')) {
    const fallbackQuery = await supabase
      .from('tenants')
      .select('id,business_name,logo_url,tenant_code')
      .limit(limit)
    query = fallbackQuery as typeof query
  }

  if (query.error) {
    if (isTransientDbError(query.error.message || '')) return []
    throw new Error(`Tenant clients lookup failed: ${query.error.message}`)
  }

  const rows = (query.data || []) as Array<{
    id?: string
    business_name?: string | null
    logo_url?: string | null
    tenant_code?: string | null
    is_active?: boolean | null
  }>

  const tenantIds = rows.map((row) => String(row.id || '')).filter(Boolean)

  let profileLogoByTenant = new Map<string, string>()
  if (tenantIds.length > 0) {
    const profiles = await supabase
      .from('business_profiles')
      .select('tenant_id,logo_url')
      .in('tenant_id', tenantIds)

    if (!profiles.error && Array.isArray(profiles.data)) {
      profileLogoByTenant = new Map(
        profiles.data
          .map((row: any) => [String(row.tenant_id || ''), String(row.logo_url || '').trim()] as const)
          .filter(([tenantId, logoUrl]) => tenantId && logoUrl)
      )
    }
  }

  let settingsLogoByTenant = new Map<string, string>()
  if (tenantIds.length > 0) {
    const settings = await supabase
      .from('tenant_settings')
      .select('tenant_id,key,value')
      .in('tenant_id', tenantIds)
      .eq('key', 'LogoURL')

    if (!settings.error && Array.isArray(settings.data)) {
      settingsLogoByTenant = new Map(
        settings.data
          .map((row: any) => [String(row.tenant_id || ''), String(row.value || '').trim()] as const)
          .filter(([tenantId, logoUrl]) => tenantId && logoUrl)
      )
    }
  }

  return rows
    .filter((row) => row && row.id)
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const businessName = String(row.business_name || '').trim()
      const tenantCode = String(row.tenant_code || '').trim()
      const tenantId = String(row.id || '')
      const resolvedLogo =
        settingsLogoByTenant.get(tenantId) ||
        profileLogoByTenant.get(tenantId) ||
        String(row.logo_url || '').trim()

      return {
        id: tenantId,
        businessName: businessName || tenantCode || 'Tenant Store',
        logoUrl: toRenderableAssetUrl(resolvedLogo),
        tenantCode,
      }
    })
}
