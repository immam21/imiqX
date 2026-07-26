import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { auditLog, requirePlatformAdmin } from '../../../../lib/platformGuards'
import { getClientIp, rateLimit, verifyCsrf } from '../../../../lib/security'

const planSchema = z.object({
  planCode: z.string().trim().min(2).max(60).regex(/^[a-z0-9_\-]+$/),
  sid: z.string().trim().max(80).optional(),
  name: z.string().trim().min(2).max(120),
  billingCycle: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']),
  price: z.number().min(0),
  currency: z.string().trim().min(3).max(10).default('INR'),
  features: z.record(z.string(), z.any()).default({}),
  limits: z.record(z.string(), z.any()).default({}),
  isActive: z.boolean().default(true),
})

const tenantAssignSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  status: z.enum(['trialing', 'active', 'past_due', 'canceled', 'expired', 'hold', 'deactivate']).default('active'),
  provider: z.string().trim().max(80).optional(),
  providerCustomerId: z.string().trim().max(160).optional(),
  providerSubscriptionId: z.string().trim().max(160).optional(),
  canceledAt: z.string().datetime().optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  trialEndsAt: z.string().datetime().optional(),
  dashboardLock: z.boolean().optional(),
  featureOverrides: z.record(z.string(), z.any()).optional(),
  limitOverrides: z.record(z.string(), z.any()).optional(),
}).refine((value) => Boolean(value.planId || value.packageId), {
  message: 'planId or packageId is required',
})

const updatePlanSchema = planSchema.partial().extend({
  id: z.string().uuid(),
})

async function loadTenantMetaByIds(supabase: ReturnType<typeof getSupabaseAdmin>, tenantIds: string[]) {
  if (!tenantIds.length) {
    return {
      byId: new Map<string, any>(),
      settingsByTenant: new Map<string, { storeAccessMode: string; dashboardAccess: string; featureOverrides: Record<string, unknown>; limitOverrides: Record<string, unknown> }>(),
    }
  }

  const [tenantsRes, settingsRes] = await Promise.all([
    supabase.from('tenants').select('id,tenant_code,business_name,whatsapp_number,currency,is_active').in('id', tenantIds),
    supabase.from('tenant_settings').select('tenant_id,key,value').in('tenant_id', tenantIds).in('key', ['StoreAccessMode', 'DashboardAccess', 'FeatureOverrides', 'LimitOverrides']),
  ])

  const byId = new Map<string, any>((tenantsRes.data || []).map((row: any) => [String(row.id), row]))
  const settingsByTenant = new Map<string, { storeAccessMode: string; dashboardAccess: string; featureOverrides: Record<string, unknown>; limitOverrides: Record<string, unknown> }>()

  for (const row of settingsRes.data || []) {
    const tenantId = String((row as any).tenant_id || '')
    const key = String((row as any).key || '')
    const value = String((row as any).value || '')
    const current = settingsByTenant.get(tenantId) || { storeAccessMode: 'ACTIVE', dashboardAccess: 'UNLOCKED', featureOverrides: {}, limitOverrides: {} }
    if (key === 'StoreAccessMode') current.storeAccessMode = value || 'ACTIVE'
    if (key === 'DashboardAccess') current.dashboardAccess = value || 'UNLOCKED'
    if (key === 'FeatureOverrides') {
      try {
        const parsed = JSON.parse(value || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) current.featureOverrides = parsed
      } catch {
        current.featureOverrides = {}
      }
    }
    if (key === 'LimitOverrides') {
      try {
        const parsed = JSON.parse(value || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) current.limitOverrides = parsed
      } catch {
        current.limitOverrides = {}
      }
    }
    settingsByTenant.set(tenantId, current)
  }

  return { byId, settingsByTenant }
}

async function upsertTenantModeSettings(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  status: string,
  dashboardLock?: boolean,
) {
  const normalized = String(status || '').trim().toUpperCase()
  const rows: Array<{ tenant_id: string; key: string; value: string }> = []

  if (normalized === 'HOLD') rows.push({ tenant_id: tenantId, key: 'StoreAccessMode', value: 'HOLD' })
  else if (normalized === 'DEACTIVATE') rows.push({ tenant_id: tenantId, key: 'StoreAccessMode', value: 'DEACTIVATE' })
  else rows.push({ tenant_id: tenantId, key: 'StoreAccessMode', value: 'ACTIVE' })

  if (dashboardLock !== undefined) {
    rows.push({ tenant_id: tenantId, key: 'DashboardAccess', value: dashboardLock ? 'LOCK_DASHBOARD' : 'UNLOCKED' })
  }

  const { error } = await supabase.from('tenant_settings').upsert(rows, { onConflict: 'tenant_id,key' })
  if (error) throw new Error(error.message)
}

async function upsertTenantEntitlementOverrides(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  featureOverrides?: Record<string, unknown>,
  limitOverrides?: Record<string, unknown>,
) {
  const rows: Array<{ tenant_id: string; key: string; value: string }> = []
  if (featureOverrides !== undefined) {
    rows.push({ tenant_id: tenantId, key: 'FeatureOverrides', value: JSON.stringify(featureOverrides || {}) })
  }
  if (limitOverrides !== undefined) {
    rows.push({ tenant_id: tenantId, key: 'LimitOverrides', value: JSON.stringify(limitOverrides || {}) })
  }
  if (!rows.length) return

  const { error } = await supabase.from('tenant_settings').upsert(rows, { onConflict: 'tenant_id,key' })
  if (error) throw new Error(error.message)
}

async function loadPlanRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const plansRes = await supabase
    .from('subscription_plans')
    .select('id,sid,plan_code,name,billing_cycle,price,currency,features,limits,is_active,created_at')
    .order('created_at', { ascending: false })

  const packagesRes = await supabase
    .from('service_packages')
    .select('id,package_code,package_name,billing_cycle,price_amount,currency,is_active,sort_order')
    .order('sort_order', { ascending: true })

  if (plansRes.error && packagesRes.error) {
    return { plans: [], planMode: 'plan' as const, error: plansRes.error }
  }

  const modernPlans = (plansRes.data || []).map((plan: any) => ({
    id: plan.id,
    sid: plan.sid || null,
    plan_code: plan.plan_code,
    name: plan.name,
    billing_cycle: plan.billing_cycle,
    price: Number(plan.price || 0),
    currency: plan.currency || 'INR',
    features: plan.features || {},
    limits: plan.limits || {},
    is_active: plan.is_active !== false,
    created_at: plan.created_at || null,
  }))

  const packagePlans = (packagesRes.data || []).map((pkg: any) => ({
    id: pkg.id,
    sid: null,
    plan_code: pkg.package_code,
    name: pkg.package_name,
    billing_cycle: pkg.billing_cycle,
    price: Number(pkg.price_amount || 0),
    currency: pkg.currency || 'INR',
    features: {},
    limits: {},
    is_active: pkg.is_active !== false,
    created_at: null,
  }))

  const merged = [...modernPlans]
  const seen = new Set(modernPlans.map((row: any) => String(row.id)))
  for (const pkg of packagePlans) {
    const id = String((pkg as any).id || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    merged.push(pkg)
  }

  if (merged.length === 0) {
    return { plans: [], planMode: 'plan' as const, error: plansRes.error || packagesRes.error || null }
  }

  return {
    plans: merged,
    planMode: plansRes.error ? 'package' as const : 'plan' as const,
    error: null,
  }
}

function mapPackageToPlanRow(pkg: any) {
  return {
    id: pkg.id,
    sid: null,
    plan_code: pkg.package_code,
    name: pkg.package_name,
    billing_cycle: pkg.billing_cycle,
    price: Number(pkg.price_amount || 0),
    currency: pkg.currency || 'INR',
    features: {},
    limits: {},
    is_active: pkg.is_active !== false,
    created_at: null,
  }
}

async function createPlanRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: z.infer<typeof planSchema>,
) {
  const planInsert = await supabase
    .from('subscription_plans')
    .insert({
      sid: input.sid || null,
      plan_code: input.planCode,
      name: input.name,
      billing_cycle: input.billingCycle,
      price: input.price,
      currency: input.currency,
      features: input.features,
      limits: input.limits,
      is_active: input.isActive,
    })
    .select('*')
    .single()

  if (!planInsert.error) {
    return { data: planInsert.data, mode: 'plan' as const, error: null as any }
  }

  const packageInsert = await supabase
    .from('service_packages')
    .insert({
      package_code: input.planCode,
      package_name: input.name,
      billing_cycle: input.billingCycle,
      price_amount: input.price,
      currency: input.currency,
      is_active: input.isActive,
    })
    .select('id,package_code,package_name,billing_cycle,price_amount,currency,is_active,sort_order')
    .single()

  if (packageInsert.error) {
    return { data: null, mode: 'plan' as const, error: planInsert.error }
  }

  return { data: mapPackageToPlanRow(packageInsert.data), mode: 'package' as const, error: null as any }
}

async function updatePlanRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  id: string,
  rest: Omit<z.infer<typeof updatePlanSchema>, 'id'>,
) {
  const updates: Record<string, unknown> = {}
  if (rest.planCode !== undefined) updates.plan_code = rest.planCode
  if (rest.sid !== undefined) updates.sid = rest.sid
  if (rest.name !== undefined) updates.name = rest.name
  if (rest.billingCycle !== undefined) updates.billing_cycle = rest.billingCycle
  if (rest.price !== undefined) updates.price = rest.price
  if (rest.currency !== undefined) updates.currency = rest.currency
  if (rest.features !== undefined) updates.features = rest.features
  if (rest.limits !== undefined) updates.limits = rest.limits
  if (rest.isActive !== undefined) updates.is_active = rest.isActive

  const planUpdate = await supabase
    .from('subscription_plans')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (!planUpdate.error) {
    return { data: planUpdate.data, mode: 'plan' as const, auditUpdates: updates, error: null as any }
  }

  const packageUpdates: Record<string, unknown> = {}
  if (rest.planCode !== undefined) packageUpdates.package_code = rest.planCode
  if (rest.name !== undefined) packageUpdates.package_name = rest.name
  if (rest.billingCycle !== undefined) packageUpdates.billing_cycle = rest.billingCycle
  if (rest.price !== undefined) packageUpdates.price_amount = rest.price
  if (rest.currency !== undefined) packageUpdates.currency = rest.currency
  if (rest.isActive !== undefined) packageUpdates.is_active = rest.isActive

  const packageUpdate = await supabase
    .from('service_packages')
    .update(packageUpdates)
    .eq('id', id)
    .select('id,package_code,package_name,billing_cycle,price_amount,currency,is_active,sort_order')
    .single()

  if (packageUpdate.error) {
    return { data: null, mode: 'plan' as const, auditUpdates: updates, error: planUpdate.error }
  }

  return { data: mapPackageToPlanRow(packageUpdate.data), mode: 'package' as const, auditUpdates: packageUpdates, error: null as any }
}

async function deletePlanRow(supabase: ReturnType<typeof getSupabaseAdmin>, id: string) {
  // Check if any active subscriptions reference this plan before trying to delete
  const refCheck = await supabase
    .from('tenant_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id)
    .limit(1)

  if (!refCheck.error && (refCheck.count ?? 0) > 0) {
    return {
      mode: 'plan' as const,
      error: { message: `Cannot delete this plan — ${refCheck.count} active subscription(s) are using it. Remove those subscriptions first.` } as any,
    }
  }

  const planDelete = await supabase.from('subscription_plans').delete().eq('id', id)
  if (!planDelete.error) {
    return { mode: 'plan' as const, error: null as any }
  }

  // Only try service_packages if subscription_plans didn't have this id (not a FK violation)
  const isForeignKeyError = /foreign key|violates foreign key constraint|referenced from table/i.test(planDelete.error.message || '')
  if (isForeignKeyError) {
    return { mode: 'plan' as const, error: planDelete.error }
  }

  const packageDelete = await supabase.from('service_packages').delete().eq('id', id)
  if (packageDelete.error) {
    return { mode: 'plan' as const, error: planDelete.error }
  }

  // Verify something was actually deleted — Supabase DELETE with no matching rows is not an error
  // so we must confirm by checking if the row is still there
  const stillExists = await supabase.from('service_packages').select('id', { count: 'exact', head: true }).eq('id', id).limit(1)
  // If count is 0, deletion succeeded; if it errors, assume success
  if (!stillExists.error && (stillExists.count ?? 0) > 0) {
    return { mode: 'plan' as const, error: { message: 'Plan could not be deleted.' } as any }
  }

  return { mode: 'package' as const, error: null as any }
}

async function loadSubscriptionRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const attempts: Array<{ select: string; mode: 'plan' | 'package'; map: (row: any) => any }> = [
    {
      select: 'id,tenant_id,plan_id,status,provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end,trial_ends_at,canceled_at,created_at,updated_at',
      mode: 'plan',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.plan_id,
        status: row.status,
        provider: row.provider || null,
        provider_customer_id: row.provider_customer_id || null,
        provider_subscription_id: row.provider_subscription_id || null,
        current_period_start: row.current_period_start || null,
        current_period_end: row.current_period_end || null,
        trial_ends_at: row.trial_ends_at || null,
        canceled_at: row.canceled_at || null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,plan_id,status,current_period_start,current_period_end,trial_ends_at,canceled_at,created_at,updated_at',
      mode: 'plan',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.plan_id,
        status: row.status,
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: row.current_period_start || null,
        current_period_end: row.current_period_end || null,
        trial_ends_at: row.trial_ends_at || null,
        canceled_at: row.canceled_at || null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,plan_id,status,provider,provider_customer_id,provider_subscription_id,created_at,updated_at',
      mode: 'plan',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.plan_id,
        status: row.status,
        provider: row.provider || null,
        provider_customer_id: row.provider_customer_id || null,
        provider_subscription_id: row.provider_subscription_id || null,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
        canceled_at: null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,plan_id,status,created_at,updated_at',
      mode: 'plan',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.plan_id,
        status: row.status,
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
        canceled_at: null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,package_id,status,provider,provider_customer_id,provider_subscription_id,starts_at,ends_at,canceled_at,created_at,updated_at',
      mode: 'package',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.package_id,
        status: row.status,
        provider: row.provider || null,
        provider_customer_id: row.provider_customer_id || null,
        provider_subscription_id: row.provider_subscription_id || null,
        current_period_start: row.starts_at || null,
        current_period_end: row.ends_at || null,
        trial_ends_at: null,
        canceled_at: row.canceled_at || null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,package_id,status,starts_at,ends_at,canceled_at,created_at,updated_at',
      mode: 'package',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.package_id,
        status: row.status,
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: row.starts_at || null,
        current_period_end: row.ends_at || null,
        trial_ends_at: null,
        canceled_at: row.canceled_at || null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,package_id,status,provider,provider_customer_id,provider_subscription_id,created_at,updated_at',
      mode: 'package',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.package_id,
        status: row.status,
        provider: row.provider || null,
        provider_customer_id: row.provider_customer_id || null,
        provider_subscription_id: row.provider_subscription_id || null,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
        canceled_at: null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,package_id,status,created_at,updated_at',
      mode: 'package',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: row.package_id,
        status: row.status,
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
        canceled_at: null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,status,created_at,updated_at',
      mode: 'plan',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: null,
        status: row.status,
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
        canceled_at: null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }),
    },
    {
      select: 'id,tenant_id,status',
      mode: 'plan',
      map: (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        plan_id: null,
        status: row.status,
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
        canceled_at: null,
        created_at: null,
        updated_at: null,
      }),
    },
  ]

  let lastError: any = null

  for (const attempt of attempts) {
    const res = await supabase
      .from('tenant_subscriptions')
      .select(attempt.select)

    if (res.error) {
      lastError = res.error
      continue
    }

    return {
      subscriptions: (res.data || []).map(attempt.map),
      subscriptionMode: attempt.mode,
      error: null,
    }
  }

  return { subscriptions: [], subscriptionMode: 'plan' as const, error: lastError }
}

function isMissingCanceledAt(errorMessage: string) {
  return /(column tenant_subscriptions\.canceled_at does not exist|Could not find the 'canceled_at' column)/i.test(errorMessage || '')
}

function isNotNullViolation(errorMessage: string, field: string) {
  return new RegExp(`null value in column .${field}. of relation .tenant_subscriptions. violates not-null constraint`, 'i').test(errorMessage || '')
}

function isPackageIdNotNullViolation(errorMessage: string) {
  return isNotNullViolation(errorMessage, 'package_id')
}

function isPlanIdNotNullViolation(errorMessage: string) {
  return isNotNullViolation(errorMessage, 'plan_id')
}

function isMissingSubscriptionField(errorMessage: string, field: 'plan_id' | 'current_period_start' | 'current_period_end' | 'trial_ends_at' | 'starts_at' | 'ends_at' | 'package_id' | 'auto_renew' | 'provider' | 'provider_customer_id' | 'provider_subscription_id') {
  return new RegExp(`(column tenant_subscriptions\\.${field} does not exist|Could not find the '${field}' column)`, 'i').test(errorMessage || '')
}

function isMissingProviderFieldsError(errorMessage: string) {
  return (
    isMissingSubscriptionField(errorMessage, 'provider') ||
    isMissingSubscriptionField(errorMessage, 'provider_customer_id') ||
    isMissingSubscriptionField(errorMessage, 'provider_subscription_id')
  )
}

function withoutProviderFields<T extends Record<string, unknown>>(payload: T) {
  const { provider, provider_customer_id, provider_subscription_id, ...rest } = payload
  return rest
}

function withoutCanceledAt<T extends Record<string, unknown>>(payload: T) {
  const { canceled_at, ...rest } = payload
  return rest
}

async function resolveLegacyPackageId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  planOrPackageId?: string,
) {
  const candidate = String(planOrPackageId || '').trim()
  if (!candidate) return ''

  const packageById = await supabase
    .from('service_packages')
    .select('id')
    .eq('id', candidate)
    .limit(1)
    .maybeSingle()

  if (!packageById.error && packageById.data?.id) {
    return String(packageById.data.id)
  }

  const planById = await supabase
    .from('subscription_plans')
    .select('id,plan_code,name')
    .eq('id', candidate)
    .limit(1)
    .maybeSingle()

  if (planById.error || !planById.data) {
    return candidate
  }

  const planCode = String((planById.data as any).plan_code || '').trim()
  const planName = String((planById.data as any).name || '').trim()

  if (planCode) {
    const packageByCode = await supabase
      .from('service_packages')
      .select('id')
      .eq('package_code', planCode)
      .limit(1)
      .maybeSingle()

    if (!packageByCode.error && packageByCode.data?.id) {
      return String(packageByCode.data.id)
    }
  }

  if (planName) {
    const packageByName = await supabase
      .from('service_packages')
      .select('id')
      .eq('package_name', planName)
      .limit(1)
      .maybeSingle()

    if (!packageByName.error && packageByName.data?.id) {
      return String(packageByName.data.id)
    }
  }

  return candidate
}

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = getSupabaseAdmin()

  const [planResult, subscriptionResult] = await Promise.all([
    loadPlanRows(supabase),
    loadSubscriptionRows(supabase),
  ])

  if (planResult.error) return NextResponse.json({ error: planResult.error.message }, { status: 400 })
  if (subscriptionResult.error) return NextResponse.json({ error: subscriptionResult.error.message }, { status: 400 })

  const tenantIds = Array.from(new Set((subscriptionResult.subscriptions || []).map((row: any) => String(row.tenant_id || '')).filter(Boolean)))
  const subscriptionPlanIds = Array.from(new Set((subscriptionResult.subscriptions || []).map((row: any) => String(row.plan_id || '')).filter(Boolean)))
  const { byId, settingsByTenant } = await loadTenantMetaByIds(supabase, tenantIds)

  const [plansByIdRes, packagesByIdRes] = await Promise.all([
    subscriptionPlanIds.length
      ? supabase.from('subscription_plans').select('id,name,plan_code,billing_cycle').in('id', subscriptionPlanIds)
      : Promise.resolve({ data: [], error: null } as any),
    subscriptionPlanIds.length
      ? supabase.from('service_packages').select('id,package_name,package_code,billing_cycle').in('id', subscriptionPlanIds)
      : Promise.resolve({ data: [], error: null } as any),
  ])

  const planMetaById = new Map<string, { id: string; name: string; plan_code: string; billing_cycle?: string | null }>()
  for (const plan of plansByIdRes.data || []) {
    const id = String((plan as any).id || '')
    if (!id) continue
    planMetaById.set(id, {
      id,
      name: String((plan as any).name || ''),
      plan_code: String((plan as any).plan_code || ''),
      billing_cycle: String((plan as any).billing_cycle || '') || null,
    })
  }
  for (const pkg of packagesByIdRes.data || []) {
    const id = String((pkg as any).id || '')
    if (!id || planMetaById.has(id)) continue
    planMetaById.set(id, {
      id,
      name: String((pkg as any).package_name || ''),
      plan_code: String((pkg as any).package_code || ''),
      billing_cycle: String((pkg as any).billing_cycle || '') || null,
    })
  }

  const subscriptions = (subscriptionResult.subscriptions || []).map((sub: any) => {
    const t = byId.get(String(sub.tenant_id)) || null
    const planMeta = planMetaById.get(String(sub.plan_id || '')) || null
    const settings = settingsByTenant.get(String(sub.tenant_id)) || { storeAccessMode: 'ACTIVE', dashboardAccess: 'UNLOCKED', featureOverrides: {}, limitOverrides: {} }
    return {
      ...sub,
      tenant: t ? {
        id: t.id,
        tenant_code: t.tenant_code,
        business_name: t.business_name,
        whatsapp_number: t.whatsapp_number,
        currency: t.currency,
        is_active: t.is_active,
      } : null,
      store_access_mode: settings.storeAccessMode,
      dashboard_access: settings.dashboardAccess,
      feature_overrides: settings.featureOverrides,
      limit_overrides: settings.limitOverrides,
      plan: planMeta,
    }
  })

  return NextResponse.json({
    plans: planResult.plans,
    subscriptions,
    meta: {
      planMode: planResult.planMode,
      subscriptionMode: subscriptionResult.subscriptionMode,
    },
  })
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-subscriptions-post:${ip}`, 30, 60_000)
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

    if (body?.mode === 'assign') {
      const parsedAssign = tenantAssignSchema.safeParse(body)
      if (!parsedAssign.success) return NextResponse.json({ error: 'Invalid assign payload' }, { status: 400 })

      const input = parsedAssign.data
      const supabase = getSupabaseAdmin()
      const modernInsert: Record<string, unknown> = {
        tenant_id: input.tenantId,
        plan_id: input.planId || input.packageId,
        status: input.status,
        current_period_start: input.currentPeriodStart || null,
        current_period_end: input.currentPeriodEnd || null,
        trial_ends_at: input.trialEndsAt || null,
        canceled_at: input.canceledAt || null,
      }

      let modernInsertPayload: Record<string, unknown> = modernInsert
      let result = await supabase
        .from('tenant_subscriptions')
        .insert(modernInsertPayload)
        .select('*')
        .single()

      if (result.error && isMissingProviderFieldsError(result.error.message || '')) {
        modernInsertPayload = withoutProviderFields(modernInsertPayload)
        result = await supabase
          .from('tenant_subscriptions')
          .insert(modernInsertPayload)
          .select('*')
          .single()
      }

      if (result.error && isMissingCanceledAt(result.error.message || '')) {
        modernInsertPayload = withoutCanceledAt(modernInsertPayload)
        result = await supabase
          .from('tenant_subscriptions')
          .insert(modernInsertPayload)
          .select('*')
          .single()
      }

      // Detect when DB uses legacy schema (package_id NOT NULL) and switch to legacy insert
      const needsLegacyInsert = result.error && (
        isPackageIdNotNullViolation(result.error.message || '') ||
        isMissingSubscriptionField(result.error.message || '', 'plan_id') ||
        isMissingSubscriptionField(result.error.message || '', 'current_period_start') ||
        isMissingSubscriptionField(result.error.message || '', 'current_period_end') ||
        isMissingSubscriptionField(result.error.message || '', 'trial_ends_at')
      )

        if (needsLegacyInsert) {
          const legacyPackageId = await resolveLegacyPackageId(supabase, input.packageId || input.planId)
          if (!legacyPackageId) {
            return NextResponse.json({ error: 'Could not resolve a valid package/plan ID for legacy schema. Please ensure a matching plan exists.' }, { status: 400 })
          }
        const legacyInsert: Record<string, unknown> = {
          tenant_id: input.tenantId,
          package_id: legacyPackageId,
          status: input.status,
          starts_at: input.currentPeriodStart || null,
          ends_at: input.currentPeriodEnd || null,
          canceled_at: input.canceledAt || null,
          auto_renew: true,
        }

        let legacyInsertPayload: Record<string, unknown> = legacyInsert

        result = await supabase
          .from('tenant_subscriptions')
          .insert(legacyInsertPayload)
          .select('*')
          .single()

        if (result.error && isMissingProviderFieldsError(result.error.message || '')) {
          legacyInsertPayload = withoutProviderFields(legacyInsertPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .insert(legacyInsertPayload)
            .select('*')
            .single()
        }

        if (result.error && isMissingCanceledAt(result.error.message || '')) {
          legacyInsertPayload = withoutCanceledAt(legacyInsertPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .insert(legacyInsertPayload)
            .select('*')
            .single()
        }
      }

        if (result.error && (
          isMissingSubscriptionField(result.error.message || '', 'package_id') ||
          isMissingSubscriptionField(result.error.message || '', 'starts_at') ||
          isMissingSubscriptionField(result.error.message || '', 'ends_at') ||
          isMissingSubscriptionField(result.error.message || '', 'auto_renew')
        )) {
        const reducedInsert: Record<string, unknown> = {
          tenant_id: input.tenantId,
          plan_id: input.planId || input.packageId,
          status: input.status,
          canceled_at: input.canceledAt || null,
        }

        let reducedInsertPayload: Record<string, unknown> = reducedInsert

        result = await supabase
          .from('tenant_subscriptions')
          .insert(reducedInsertPayload)
          .select('*')
          .single()

        if (result.error && isMissingProviderFieldsError(result.error.message || '')) {
          reducedInsertPayload = withoutProviderFields(reducedInsertPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .insert(reducedInsertPayload)
            .select('*')
            .single()
        }

        if (result.error && isMissingCanceledAt(result.error.message || '')) {
          reducedInsertPayload = withoutCanceledAt(reducedInsertPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .insert(reducedInsertPayload)
            .select('*')
            .single()
        }
      }

      const { data, error } = result

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      await upsertTenantModeSettings(supabase, input.tenantId, input.status, input.dashboardLock)
      await upsertTenantEntitlementOverrides(supabase, input.tenantId, input.featureOverrides, input.limitOverrides)

      await auditLog({
        action: 'platform.subscription.assign',
        entityType: 'tenant_subscriptions',
        entityId: data.id,
        tenantId: input.tenantId,
      })

      return NextResponse.json({ ok: true, subscription: data })
    }

    const parsedPlan = planSchema.safeParse(body)
    if (!parsedPlan.success) return NextResponse.json({ error: 'Invalid plan payload' }, { status: 400 })

    const input = parsedPlan.data
    const supabase = getSupabaseAdmin()
    const { data, error, mode } = await createPlanRow(supabase, input)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.plan.create',
      entityType: mode === 'package' ? 'service_packages' : 'subscription_plans',
      entityId: data.id,
      metadata: { planCode: input.planCode },
    })

    return NextResponse.json({ ok: true, plan: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-subscriptions-patch:${ip}`, 30, 60_000)
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

    if (body?.mode === 'subscription') {
      const id = String(body?.id || '').trim()
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const updates: Record<string, unknown> = {}
      if (body.planId !== undefined) updates.plan_id = body.planId
      if (body.status !== undefined) updates.status = body.status
      if (body.currentPeriodStart !== undefined) updates.current_period_start = body.currentPeriodStart
      if (body.currentPeriodEnd !== undefined) updates.current_period_end = body.currentPeriodEnd
      if (body.trialEndsAt !== undefined) updates.trial_ends_at = body.trialEndsAt
      if (body.canceledAt !== undefined) updates.canceled_at = body.canceledAt

      const supabase = getSupabaseAdmin()
      let updatesPayload: Record<string, unknown> = updates
      let result = await supabase
        .from('tenant_subscriptions')
        .update(updatesPayload)
        .eq('id', id)
        .select('*')
        .single()

      if (result.error && isMissingProviderFieldsError(result.error.message || '')) {
        updatesPayload = withoutProviderFields(updatesPayload)
        result = await supabase
          .from('tenant_subscriptions')
          .update(updatesPayload)
          .eq('id', id)
          .select('*')
          .single()
      }

      if (result.error && isMissingCanceledAt(result.error.message || '')) {
        updatesPayload = withoutCanceledAt(updatesPayload)
        result = await supabase
          .from('tenant_subscriptions')
          .update(updatesPayload)
          .eq('id', id)
          .select('*')
          .single()
      }

      if (result.error && (
        isMissingSubscriptionField(result.error.message || '', 'current_period_start') ||
        isMissingSubscriptionField(result.error.message || '', 'current_period_end') ||
        isMissingSubscriptionField(result.error.message || '', 'trial_ends_at')
      )) {
        const legacyPackageId = body.planId !== undefined
          ? await resolveLegacyPackageId(supabase, String(body.planId || ''))
          : ''
        const legacyUpdates: Record<string, unknown> = {}
        if (body.planId !== undefined) legacyUpdates.package_id = legacyPackageId
        if (body.status !== undefined) legacyUpdates.status = body.status
        if (body.currentPeriodStart !== undefined) legacyUpdates.starts_at = body.currentPeriodStart
        if (body.currentPeriodEnd !== undefined) legacyUpdates.ends_at = body.currentPeriodEnd
        if (body.canceledAt !== undefined) legacyUpdates.canceled_at = body.canceledAt

        let legacyUpdatesPayload: Record<string, unknown> = legacyUpdates

        result = await supabase
          .from('tenant_subscriptions')
          .update(legacyUpdatesPayload)
          .eq('id', id)
          .select('*')
          .single()

        if (result.error && isMissingProviderFieldsError(result.error.message || '')) {
          legacyUpdatesPayload = withoutProviderFields(legacyUpdatesPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .update(legacyUpdatesPayload)
            .eq('id', id)
            .select('*')
            .single()
        }

        if (result.error && isMissingCanceledAt(result.error.message || '')) {
          legacyUpdatesPayload = withoutCanceledAt(legacyUpdatesPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .update(legacyUpdatesPayload)
            .eq('id', id)
            .select('*')
            .single()
        }
      }

      if (result.error && (
        isMissingSubscriptionField(result.error.message || '', 'starts_at') ||
        isMissingSubscriptionField(result.error.message || '', 'ends_at')
      )) {
        const reducedUpdates: Record<string, unknown> = {}
        if (body.planId !== undefined) reducedUpdates.plan_id = body.planId
        if (body.status !== undefined) reducedUpdates.status = body.status
        if (body.canceledAt !== undefined) reducedUpdates.canceled_at = body.canceledAt

        let reducedUpdatesPayload: Record<string, unknown> = reducedUpdates

        result = await supabase
          .from('tenant_subscriptions')
          .update(reducedUpdatesPayload)
          .eq('id', id)
          .select('*')
          .single()

        if (result.error && isMissingProviderFieldsError(result.error.message || '')) {
          reducedUpdatesPayload = withoutProviderFields(reducedUpdatesPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .update(reducedUpdatesPayload)
            .eq('id', id)
            .select('*')
            .single()
        }

        if (result.error && isMissingCanceledAt(result.error.message || '')) {
          reducedUpdatesPayload = withoutCanceledAt(reducedUpdatesPayload)
          result = await supabase
            .from('tenant_subscriptions')
            .update(reducedUpdatesPayload)
            .eq('id', id)
            .select('*')
            .single()
        }
      }

      const { data, error } = result

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      const tenantId = String((data as any).tenant_id || '')
      await upsertTenantModeSettings(supabase, tenantId, String(body.status || data.status || ''), body.dashboardLock)
      await upsertTenantEntitlementOverrides(supabase, tenantId, body.featureOverrides, body.limitOverrides)

      await auditLog({
        action: 'platform.subscription.update',
        entityType: 'tenant_subscriptions',
        entityId: id,
        tenantId: data.tenant_id,
        metadata: updates,
      })

      return NextResponse.json({ ok: true, subscription: data })
    }

    const parsed = updatePlanSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid plan update payload' }, { status: 400 })

    const { id, ...rest } = parsed.data
    const supabase = getSupabaseAdmin()
    const { data, error, mode, auditUpdates } = await updatePlanRow(supabase, id, rest)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.plan.update',
      entityType: mode === 'package' ? 'service_packages' : 'subscription_plans',
      entityId: id,
      metadata: auditUpdates,
    })

    return NextResponse.json({ ok: true, plan: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request)
  const rl = rateLimit(`platform-subscriptions-delete:${ip}`, 20, 60_000)
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
    const mode = String(body?.mode || 'plan')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    if (mode === 'subscription') {
      const { error } = await supabase.from('tenant_subscriptions').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      await auditLog({
        action: 'platform.subscription.delete',
        entityType: 'tenant_subscriptions',
        entityId: id,
      })

      return NextResponse.json({ ok: true })
    }

    const { error, mode: planStorageMode } = await deletePlanRow(supabase, id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'platform.plan.delete',
      entityType: planStorageMode === 'package' ? 'service_packages' : 'subscription_plans',
      entityId: id,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
