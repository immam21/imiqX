import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { auditLog, requirePlatformAdmin } from '../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../lib/security'

function slugify(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const createSchema = z.object({
  tenantCode: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/),
  businessName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional(),
  whatsappNumber: z.string().trim().min(8).max(30).optional(),
  currency: z.string().trim().min(3).max(10).default('INR'),
  logoUrl: z.string().url().optional(),
  deliveryCharge: z.number().min(0).max(100000).default(40),
  isActive: z.boolean().default(true),
  planId: z.string().uuid().optional(),
  expiryDate: z.string().datetime().optional(),
  adminLoginId: z.string().trim().min(3).max(120).optional(),
  adminPassword: z.string().min(6).max(200).optional(),
  customDomain: z.string().trim().optional(),
  customDomainType: z.enum(['custom', 'subdomain']).default('custom'),
  customDomainIsPrimary: z.boolean().default(true),
  customDomainIsVerified: z.boolean().default(true),
  customDomainSslStatus: z.string().trim().max(80).optional(),
  clientStatus: z.enum(['active', 'inactive', 'expired', 'deleted']).optional(),
  paymentGateway: z.string().trim().optional(),
  paymentModes: z.array(z.string().trim()).default([]),
  razorpayKeyId: z.string().trim().optional(),
  razorpayEnabled: z.boolean().default(false),
  businessType: z.enum(['ecommerce_product', 'ecommerce_services']).default('ecommerce_product'),
})

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
  currentPeriodStart: z.string().datetime().optional(),
  status: z.enum(['trialing', 'active', 'past_due', 'canceled', 'expired']).optional(),
})

function addDaysIso(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

async function loadTenantRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  let rowsRes: any = await supabase
    .from('tenants')
    .select('id,sid,tenant_code,business_name,whatsapp_number,currency,logo_url,default_delivery_charge,is_active,created_at')
    .order('created_at', { ascending: false })

  if (!rowsRes.error) return rowsRes

  // Fallback for schemas where optional columns (for example sid/logo_url/default_delivery_charge) do not exist.
  rowsRes = await supabase
    .from('tenants')
    .select('id,tenant_code,business_name,whatsapp_number,currency,is_active,created_at')
    .order('created_at', { ascending: false })

  if (!rowsRes.error) {
    return {
      data: (rowsRes.data || []).map((row: any) => ({
        ...row,
        sid: null,
        logo_url: null,
        default_delivery_charge: 0,
      })),
      error: null,
    }
  }

  return rowsRes
}

async function loadBusinessProfiles(supabase: ReturnType<typeof getSupabaseAdmin>, tenantIds: string[]) {
  const empty = new Map<string, any>()
  if (tenantIds.length === 0) return empty

  const profilesRes = await supabase
    .from('business_profiles')
    .select('tenant_id,email,client_status,payment_gateway,payment_modes,razorpay_key_id,razorpay_enabled')
    .in('tenant_id', tenantIds)

  if (profilesRes.error) return empty

  return new Map((profilesRes.data || []).map((row: any) => [String(row.tenant_id), row]))
}

async function resolvePlanMeta(supabase: ReturnType<typeof getSupabaseAdmin>, planId: string) {
  const modern = await supabase
    .from('subscription_plans')
    .select('id,plan_code,name,billing_cycle,price,currency,features')
    .eq('id', planId)
    .limit(1)
    .maybeSingle()

  if (!modern.error && modern.data) {
    const features = (modern.data as any).features || {}
    const trialDays = Number((features as any).trial_days || 0)
    return {
      mode: 'plan' as const,
      id: modern.data.id,
      billingCycle: String((modern.data as any).billing_cycle || 'monthly'),
      price: Number((modern.data as any).price || 0),
      currency: String((modern.data as any).currency || 'INR'),
      trialDays: Number.isFinite(trialDays) && trialDays > 0 ? trialDays : 0,
      planCode: String((modern.data as any).plan_code || ''),
      planName: String((modern.data as any).name || ''),
    }
  }

  const legacy = await supabase
    .from('service_packages')
    .select('id,package_code,package_name,billing_cycle,price_amount,currency')
    .eq('id', planId)
    .limit(1)
    .maybeSingle()

  if (!legacy.error && legacy.data) {
    const code = String((legacy.data as any).package_code || '')
    const name = String((legacy.data as any).package_name || '')
    const trialDays = /trial|7day|7-day/i.test(`${code} ${name}`) ? 7 : 0
    return {
      mode: 'package' as const,
      id: legacy.data.id,
      billingCycle: String((legacy.data as any).billing_cycle || 'monthly'),
      price: Number((legacy.data as any).price_amount || 0),
      currency: String((legacy.data as any).currency || 'INR'),
      trialDays,
      planCode: code,
      planName: name,
    }
  }

  const fallbackErr = modern.error || legacy.error
  throw new Error(fallbackErr?.message || 'Selected plan was not found')
}

function inferPlanDays(billingCycle: string, trialDays: number) {
  if (trialDays > 0) return trialDays
  if (billingCycle === 'quarterly') return 90
  if (billingCycle === 'half_yearly') return 180
  if (billingCycle === 'yearly') return 365
  return 30
}

async function upsertTenantAdminSettings(supabase: ReturnType<typeof getSupabaseAdmin>, tenantId: string, tenantCode: string, loginId?: string, password?: string) {
  const rows: Array<{ tenant_id: string; key: string; value: string }> = [
    { tenant_id: tenantId, key: 'AdminTenantID', value: String(tenantCode || '').trim() },
    { tenant_id: tenantId, key: 'AdminTenantId', value: String(tenantCode || '').trim() },
  ]

  if (loginId && loginId.trim()) {
    rows.push({ tenant_id: tenantId, key: 'AdminLoginID', value: loginId.trim() })
    rows.push({ tenant_id: tenantId, key: 'AdminLoginId', value: loginId.trim() })
  }
  if (password && password.trim()) {
    rows.push({ tenant_id: tenantId, key: 'AdminPassword', value: password.trim() })
    rows.push({ tenant_id: tenantId, key: 'adminpassword', value: password.trim() })
  }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert(rows, { onConflict: 'tenant_id,key' })

  if (error) throw new Error(error.message)
}

async function upsertTenantBusinessTypeSettings(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  businessType?: 'ecommerce_product' | 'ecommerce_services'
) {
  const value = businessType === 'ecommerce_services' ? 'ecommerce_services' : 'ecommerce_product'
  const rows: Array<{ tenant_id: string; key: string; value: string }> = [
    { tenant_id: tenantId, key: 'BusinessType', value },
    { tenant_id: tenantId, key: 'businessType', value },
  ]

  const { error } = await supabase
    .from('tenant_settings')
    .upsert(rows, { onConflict: 'tenant_id,key' })

  if (error) throw new Error(error.message)
}

async function upsertBusinessProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  input: {
    businessName?: string
    tenantCode?: string
    email?: string
    status?: 'active' | 'inactive' | 'expired' | 'deleted'
    paymentGateway?: string
    paymentModes?: string[]
    razorpayKeyId?: string
    razorpayEnabled?: boolean
  }
) {
  const resolvedBusinessName = String(input.businessName || input.tenantCode || '').trim()
  const payload = {
    tenant_id: tenantId,
    business_name: resolvedBusinessName,
    business_slug: slugify(resolvedBusinessName) || null,
    email: input.email || null,
    client_status: input.status || 'active',
    payment_gateway: input.paymentGateway || null,
    payment_modes: input.paymentModes || [],
    razorpay_key_id: input.razorpayKeyId || null,
    razorpay_enabled: Boolean(input.razorpayEnabled),
  }

  let result = await supabase
    .from('business_profiles')
    .upsert(payload, { onConflict: 'tenant_id' })

  if (result.error && /column .*business_slug.* does not exist|Could not find the 'business_slug' column/i.test(result.error.message || '')) {
    const { business_slug, ...withoutSlug } = payload
    result = await supabase
      .from('business_profiles')
      .upsert(withoutSlug, { onConflict: 'tenant_id' })
  }

  if (result.error) throw new Error(result.error.message)
}

function normalizeDomain(value?: string) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  const withoutProto = raw.replace(/^https?:\/\//, '')
  const hostOnly = withoutProto.split('/')[0]?.trim() || ''
  return hostOnly.replace(/:\d+$/, '')
}

async function upsertTenantDomain(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  input: {
    customDomain?: string
    type?: 'custom' | 'subdomain'
    isPrimary?: boolean
    isVerified?: boolean
    sslStatus?: string
  }
) {
  const host = normalizeDomain(input.customDomain)
  const type = input.type === 'subdomain' ? 'subdomain' : 'custom'
  const isPrimary = input.isPrimary !== false
  const isVerified = input.isVerified !== false
  const sslStatus = String(input.sslStatus || '').trim() || null

  // Remove existing domain mappings if domain is cleared.
  if (!host) {
    let delRes = await supabase
      .from('tenant_domains')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('type', type)

    if (delRes.error && /column .*type.* does not exist/i.test(delRes.error.message || '')) {
      delRes = await supabase
        .from('tenant_domains')
        .delete()
        .eq('tenant_id', tenantId)
    }

    if (delRes.error && !/relation .*tenant_domains.* does not exist/i.test(delRes.error.message || '')) {
      throw new Error(delRes.error.message)
    }

    return
  }

  // Clear previous custom domain rows for this tenant (one custom domain per tenant for now).
  let clearExisting = await supabase
    .from('tenant_domains')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('type', type)

  if (clearExisting.error && /column .*type.* does not exist/i.test(clearExisting.error.message || '')) {
    clearExisting = await supabase
      .from('tenant_domains')
      .delete()
      .eq('tenant_id', tenantId)
  }

  if (clearExisting.error && !/relation .*tenant_domains.* does not exist/i.test(clearExisting.error.message || '')) {
    throw new Error(clearExisting.error.message)
  }

  // Prefer modern `host` column, fallback to legacy `domain` column.
  let insert = await supabase
    .from('tenant_domains')
    .insert({
      tenant_id: tenantId,
      host,
      type,
      is_primary: isPrimary,
      is_verified: isVerified,
      verified_at: isVerified ? new Date().toISOString() : null,
      ssl_status: sslStatus,
    })

  if (insert.error && /column .*type.* does not exist/i.test(insert.error.message || '')) {
    insert = await supabase
      .from('tenant_domains')
      .insert({
        tenant_id: tenantId,
        host,
        is_primary: isPrimary,
        is_verified: isVerified,
        verified_at: isVerified ? new Date().toISOString() : null,
        ssl_status: sslStatus,
      })
  }

  if (insert.error && /column .*host.* does not exist/i.test(insert.error.message || '')) {
    let legacyPayload: Record<string, unknown> = {
      tenant_id: tenantId,
      domain: host,
      type,
      is_primary: isPrimary,
      is_verified: isVerified,
      verified_at: isVerified ? new Date().toISOString() : null,
      ssl_status: sslStatus,
    }

    if (/column .*type.* does not exist/i.test(insert.error.message || '')) {
      const { type: _unused, ...withoutType } = legacyPayload
      legacyPayload = withoutType
    }

    insert = await supabase
      .from('tenant_domains')
      .insert(legacyPayload)

    if (insert.error && /column .*type.* does not exist/i.test(insert.error.message || '')) {
      const { type: _unused, ...withoutType } = legacyPayload
      insert = await supabase
        .from('tenant_domains')
        .insert(withoutType)
    }
  }

  if (insert.error && !/relation .*tenant_domains.* does not exist/i.test(insert.error.message || '')) {
    throw new Error(insert.error.message)
  }
}

async function upsertTenantSubscription(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    tenantId: string
    planId: string
    expiryDate?: string
    currentPeriodStart?: string
    status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  }
) {
  const plan = await resolvePlanMeta(supabase, input.planId)
  const start = input.currentPeriodStart || new Date().toISOString()
  const days = inferPlanDays(plan.billingCycle, plan.trialDays)
  const end = input.expiryDate || addDaysIso(days, new Date(start))
  const status = input.status || (plan.trialDays > 0 ? 'trialing' : 'active')

  const existing = await supabase
    .from('tenant_subscriptions')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing.error) throw new Error(existing.error.message)

  const modernPayload = {
    tenant_id: input.tenantId,
    plan_id: plan.id,
    status,
    current_period_start: start,
    current_period_end: end,
    trial_ends_at: plan.trialDays > 0 ? end : null,
  }

  let modernRes = existing.data?.id
    ? await supabase.from('tenant_subscriptions').update(modernPayload).eq('id', existing.data.id).select('*').single()
    : await supabase.from('tenant_subscriptions').insert(modernPayload).select('*').single()

  if (!modernRes.error) return modernRes.data

  if (!/column tenant_subscriptions\.(plan_id|current_period_start|current_period_end|trial_ends_at) does not exist/i.test(modernRes.error.message || '')) {
    throw new Error(modernRes.error.message)
  }

  let legacyPackageId = plan.id
  if (plan.mode === 'plan') {
    const byCode = plan.planCode
      ? await supabase
          .from('service_packages')
          .select('id')
          .eq('package_code', plan.planCode)
          .limit(1)
          .maybeSingle()
      : { data: null, error: null } as any

    if (!byCode.error && byCode.data?.id) {
      legacyPackageId = String(byCode.data.id)
    } else if (plan.planName) {
      const byName = await supabase
        .from('service_packages')
        .select('id')
        .eq('package_name', plan.planName)
        .limit(1)
        .maybeSingle()

      if (!byName.error && byName.data?.id) {
        legacyPackageId = String(byName.data.id)
      }
    }
  }

  const legacyPayload = {
    tenant_id: input.tenantId,
    package_id: legacyPackageId,
    status,
    starts_at: start,
    ends_at: end,
    auto_renew: true,
    seats: 1,
    amount: plan.price,
    currency: plan.currency,
  }

  const legacyRes = existing.data?.id
    ? await supabase.from('tenant_subscriptions').update(legacyPayload).eq('id', existing.data.id).select('*').single()
    : await supabase.from('tenant_subscriptions').insert(legacyPayload).select('*').single()

  if (legacyRes.error) throw new Error(legacyRes.error.message)
  return legacyRes.data
}

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = getSupabaseAdmin()
  const { data, error } = await loadTenantRows(supabase)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const tenantIds = (data || []).map((t: any) => t.id)
  const businessProfiles = await loadBusinessProfiles(supabase, tenantIds)
  let loginByTenant = new Map<string, string>()
  let businessTypeByTenant = new Map<string, 'ecommerce_product' | 'ecommerce_services'>()
  let domainByTenant = new Map<string, { host: string; type: string; isPrimary: boolean; isVerified: boolean; sslStatus: string }>()

  if (tenantIds.length > 0) {
    const settingsRes = await supabase
      .from('tenant_settings')
      .select('tenant_id,key,value')
      .in('tenant_id', tenantIds)
      .in('key', ['AdminLoginID', 'AdminLoginId', 'BusinessType', 'businessType'])

    if (!settingsRes.error) {
      for (const row of settingsRes.data || []) {
        const key = String((row as any)?.key || '').trim()
        const tenantId = String((row as any)?.tenant_id || '')
        const value = String((row as any)?.value || '').trim()
        if (key === 'AdminLoginID' || key === 'AdminLoginId') {
          loginByTenant.set(tenantId, value)
          continue
        }
        if (key === 'BusinessType' || key === 'businessType') {
          businessTypeByTenant.set(tenantId, value.toLowerCase() === 'ecommerce_services' ? 'ecommerce_services' : 'ecommerce_product')
        }
      }

      const currentRows = data || []
      for (const tenant of currentRows) {
        if (!businessTypeByTenant.has(String((tenant as any).id))) {
          businessTypeByTenant.set(String((tenant as any).id), 'ecommerce_product')
        }
      }

    }

    let domainsRes: any = await supabase
      .from('tenant_domains')
      .select('tenant_id,host,type,is_primary,is_verified,ssl_status')
      .in('tenant_id', tenantIds)
      .order('is_primary', { ascending: false })

    if (domainsRes.error) {
      const msg = String(domainsRes.error.message || '')
      const missingHost = /column .*host.* does not exist/i.test(msg)
      const missingType = /column .*type.* does not exist/i.test(msg)

      if (missingHost && missingType) {
        domainsRes = await supabase
          .from('tenant_domains')
          .select('tenant_id,domain,is_primary,is_verified,ssl_status')
          .in('tenant_id', tenantIds)
          .order('is_primary', { ascending: false })
      } else if (missingHost) {
        domainsRes = await supabase
          .from('tenant_domains')
          .select('tenant_id,domain,type,is_primary,is_verified,ssl_status')
          .in('tenant_id', tenantIds)
          .order('is_primary', { ascending: false })
      } else if (missingType) {
        domainsRes = await supabase
          .from('tenant_domains')
          .select('tenant_id,host,is_primary,is_verified,ssl_status')
          .in('tenant_id', tenantIds)
          .order('is_primary', { ascending: false })
      }
    }

    if (!domainsRes.error) {
      domainByTenant = new Map(
        (domainsRes.data || []).map((row: any) => [
          String(row.tenant_id),
          {
            host: String(row.host || row.domain || ''),
            type: String(row.type || 'custom'),
            isPrimary: Boolean(row.is_primary),
            isVerified: Boolean(row.is_verified),
            sslStatus: String(row.ssl_status || ''),
          },
        ])
      )
    }
  }

  const tenants = (data || []).map((tenant: any) => ({
    profile: businessProfiles.get(String(tenant.id)) || null,
    domainConfig: domainByTenant.get(String(tenant.id)) || null,
    ...tenant,
    admin_login_id: loginByTenant.get(String(tenant.id)) || '',
    email: businessProfiles.get(String(tenant.id))?.email || '',
    client_status: businessProfiles.get(String(tenant.id))?.client_status || (tenant.is_active ? 'active' : 'inactive'),
    payment_gateway: businessProfiles.get(String(tenant.id))?.payment_gateway || '',
    payment_modes: businessProfiles.get(String(tenant.id))?.payment_modes || [],
    razorpay_key_id: businessProfiles.get(String(tenant.id))?.razorpay_key_id || '',
    razorpay_enabled: Boolean(businessProfiles.get(String(tenant.id))?.razorpay_enabled),
    custom_domain: domainByTenant.get(String(tenant.id))?.host || '',
    custom_domain_type: domainByTenant.get(String(tenant.id))?.type || 'custom',
    custom_domain_is_primary: domainByTenant.get(String(tenant.id))?.isPrimary ?? true,
    custom_domain_is_verified: domainByTenant.get(String(tenant.id))?.isVerified ?? true,
    custom_domain_ssl_status: domainByTenant.get(String(tenant.id))?.sslStatus || '',
    business_type: (businessTypeByTenant.get(String(tenant.id)) || 'ecommerce_product') as 'ecommerce_product' | 'ecommerce_services',
  }))

  return NextResponse.json({ tenants })
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-tenants-post:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      return NextResponse.json({ error: `Invalid payload: ${details || 'validation failed'}` }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const input = parsed.data
    const tenantInsert = {
      tenant_code: input.tenantCode,
      business_name: input.businessName,
      business_slug: slugify(input.businessName) || slugify(input.tenantCode),
      whatsapp_number: input.whatsappNumber || null,
      currency: input.currency,
      logo_url: input.logoUrl || null,
      default_delivery_charge: input.deliveryCharge,
      is_active: input.isActive,
    }

    let insertQuery = supabase.from('tenants').insert(tenantInsert)
    let result = await insertQuery.select('id,sid,tenant_code,business_name,is_active').single()

    if (result.error && /column .*business_slug.* does not exist/i.test(result.error.message)) {
      const { business_slug, ...withoutSlug } = tenantInsert
      result = await supabase
        .from('tenants')
        .insert(withoutSlug)
        .select('id,sid,tenant_code,business_name,is_active')
        .single()
    }

    const { data, error } = result
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await upsertTenantAdminSettings(
      supabase,
      data.id,
      input.tenantCode,
      input.adminLoginId,
      input.adminPassword,
    )

    await upsertTenantBusinessTypeSettings(
      supabase,
      data.id,
      input.businessType,
    )

    await upsertBusinessProfile(supabase, data.id, {
      businessName: input.businessName,
      tenantCode: input.tenantCode,
      email: input.email,
      status: input.clientStatus || (input.isActive ? 'active' : 'inactive'),
      paymentGateway: input.paymentGateway,
      paymentModes: input.paymentModes,
      razorpayKeyId: input.razorpayKeyId,
      razorpayEnabled: input.razorpayEnabled,
    })

    await upsertTenantDomain(supabase, data.id, {
      customDomain: input.customDomain,
      type: input.customDomainType,
      isPrimary: input.customDomainIsPrimary,
      isVerified: input.customDomainIsVerified,
      sslStatus: input.customDomainSslStatus,
    })

    if (input.planId) {
      await upsertTenantSubscription(supabase, {
        tenantId: data.id,
        planId: input.planId,
        expiryDate: input.expiryDate,
      })
    }

    await auditLog({
      action: 'platform.tenant.create',
      entityType: 'tenants',
      entityId: data.id,
      metadata: { tenantCode: input.tenantCode },
    })

    return NextResponse.json({ ok: true, tenant: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || 'Invalid request') }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-tenants-patch:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      return NextResponse.json({ error: `Invalid payload: ${details || 'validation failed'}` }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { id, ...rest } = parsed.data
    const existingBusinessProfiles = await loadBusinessProfiles(supabase, [id])

    const updates: Record<string, unknown> = {}
    if (rest.tenantCode !== undefined) updates.tenant_code = rest.tenantCode
    if (rest.businessName !== undefined) updates.business_name = rest.businessName
    if (rest.businessName !== undefined || rest.tenantCode !== undefined) {
      updates.business_slug = slugify(rest.businessName || rest.tenantCode || '')
    }
    if (rest.whatsappNumber !== undefined) updates.whatsapp_number = rest.whatsappNumber
    if (rest.currency !== undefined) updates.currency = rest.currency
    if (rest.logoUrl !== undefined) updates.logo_url = rest.logoUrl
    if (rest.deliveryCharge !== undefined) updates.default_delivery_charge = rest.deliveryCharge
    if (rest.isActive !== undefined) updates.is_active = rest.isActive

    let result = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select('id,sid,tenant_code,business_name,is_active')
      .single()

    if (result.error && /column .*business_slug.* does not exist/i.test(result.error.message)) {
      const { business_slug, ...withoutSlug } = updates
      result = await supabase
        .from('tenants')
        .update(withoutSlug)
        .eq('id', id)
        .select('id,sid,tenant_code,business_name,is_active')
        .single()
    }

    const { data, error } = result
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (rest.adminLoginId !== undefined || rest.adminPassword !== undefined) {
      await upsertTenantAdminSettings(
        supabase,
        id,
        String((data as any).tenant_code || ''),
        rest.adminLoginId,
        rest.adminPassword,
      )
    }

    if ((rest as any).businessType !== undefined) {
      await upsertTenantBusinessTypeSettings(
        supabase,
        id,
        (rest as any).businessType,
      )
    }

    if (
      rest.email !== undefined ||
      (rest as any).paymentGateway !== undefined ||
      (rest as any).paymentModes !== undefined ||
      (rest as any).razorpayKeyId !== undefined ||
      (rest as any).razorpayEnabled !== undefined ||
      rest.isActive !== undefined
    ) {
      await upsertBusinessProfile(supabase, id, {
        businessName: String((rest as any).businessName || (data as any).business_name || ''),
        tenantCode: String((rest as any).tenantCode || (data as any).tenant_code || ''),
        email: rest.email,
        status: (rest as any).clientStatus || (rest.isActive === undefined ? (existingBusinessProfiles.get(id)?.client_status || 'active') : (rest.isActive ? 'active' : 'inactive')),
        paymentGateway: (rest as any).paymentGateway,
        paymentModes: (rest as any).paymentModes,
        razorpayKeyId: (rest as any).razorpayKeyId,
        razorpayEnabled: (rest as any).razorpayEnabled,
      })
    }

    if (
      (rest as any).customDomain !== undefined ||
      (rest as any).customDomainType !== undefined ||
      (rest as any).customDomainIsPrimary !== undefined ||
      (rest as any).customDomainIsVerified !== undefined ||
      (rest as any).customDomainSslStatus !== undefined
    ) {
      await upsertTenantDomain(supabase, id, {
        customDomain: (rest as any).customDomain,
        type: (rest as any).customDomainType,
        isPrimary: (rest as any).customDomainIsPrimary,
        isVerified: (rest as any).customDomainIsVerified,
        sslStatus: (rest as any).customDomainSslStatus,
      })
    }

    if (rest.planId) {
      await upsertTenantSubscription(supabase, {
        tenantId: id,
        planId: rest.planId,
        expiryDate: rest.expiryDate,
        currentPeriodStart: rest.currentPeriodStart,
        status: rest.status,
      })
    }

    await auditLog({
      action: 'platform.tenant.update',
      entityType: 'tenants',
      entityId: id,
      metadata: updates,
    })

    return NextResponse.json({ ok: true, tenant: data })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || 'Invalid request') }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-tenants-delete:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('tenants').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.tenant.delete',
      entityType: 'tenants',
      entityId: id,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
