import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

function isTransientPlanError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  const text = message.toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('econn') ||
    text.includes('enotfound') ||
    text.includes('etimedout')
  )
}

async function withTransientRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientPlanError(error) || index === attempts - 1) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown plan lookup error'))
}

async function loadPlanRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const plansRes = await supabase
    .from('subscription_plans')
    .select('id,sid,plan_code,name,billing_cycle,price,currency,features,limits,is_active,created_at')
    .eq('is_active', true)
    .order('price', { ascending: true })

  if (!plansRes.error) return { plans: plansRes.data || [], error: null }

  const packagesRes = await supabase
    .from('service_packages')
    .select('id,package_code,package_name,billing_cycle,price_amount,currency,is_active,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (packagesRes.error) return { plans: [], error: plansRes.error }

  return {
    plans: (packagesRes.data || []).map((pkg: any) => ({
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
    })),
    error: null,
  }
}

async function loadTenantSubscription(supabase: ReturnType<typeof getSupabaseAdmin>, tenantId: string) {
  const subscriptionRes = await supabase
    .from('tenant_subscriptions')
    .select('id,tenant_id,plan_id,status,current_period_start,current_period_end,trial_ends_at,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!subscriptionRes.error) return { subscription: subscriptionRes.data || null, error: null }

  const reducedModernRes = await supabase
    .from('tenant_subscriptions')
    .select('id,tenant_id,plan_id,status,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!reducedModernRes.error) {
    return {
      subscription: reducedModernRes.data ? {
        ...reducedModernRes.data,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
      } : null,
      error: null,
    }
  }

  const legacyRes = await supabase
    .from('tenant_subscriptions')
    .select('id,tenant_id,package_id,status,starts_at,ends_at,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (legacyRes.error) {
    const reducedLegacyRes = await supabase
      .from('tenant_subscriptions')
      .select('id,tenant_id,package_id,status,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reducedLegacyRes.error) return { subscription: null, error: subscriptionRes.error }

    return {
      subscription: reducedLegacyRes.data ? {
        ...reducedLegacyRes.data,
        plan_id: reducedLegacyRes.data.package_id,
        current_period_start: null,
        current_period_end: null,
        trial_ends_at: null,
      } : null,
      error: null,
    }
  }

  return {
    subscription: legacyRes.data ? {
      ...legacyRes.data,
      plan_id: legacyRes.data.package_id,
      current_period_start: legacyRes.data.starts_at || null,
      current_period_end: legacyRes.data.ends_at || null,
      trial_ends_at: null,
    } : null,
    error: null,
  }
}

async function loadPlanById(supabase: ReturnType<typeof getSupabaseAdmin>, planId?: string | null) {
  const id = String(planId || '').trim()
  if (!id) return null

  const modern = await supabase
    .from('subscription_plans')
    .select('id,sid,plan_code,name,billing_cycle,price,currency,features,limits,is_active,created_at')
    .eq('id', id)
    .limit(1)
    .maybeSingle()

  if (!modern.error && modern.data) {
    return modern.data
  }

  // Compatibility fallback: some legacy subscriptions store plan_code/sid
  // in plan_id instead of the subscription_plans.id UUID.
  const modernByCode = await supabase
    .from('subscription_plans')
    .select('id,sid,plan_code,name,billing_cycle,price,currency,features,limits,is_active,created_at')
    .or(`plan_code.eq.${id},sid.eq.${id}`)
    .limit(1)
    .maybeSingle()

  if (!modernByCode.error && modernByCode.data) {
    return modernByCode.data
  }

  const legacy = await supabase
    .from('service_packages')
    .select('id,package_code,package_name,billing_cycle,price_amount,currency,is_active,sort_order')
    .eq('id', id)
    .limit(1)
    .maybeSingle()

  if (!legacy.error && legacy.data) {
    return {
      id: legacy.data.id,
      sid: null,
      plan_code: legacy.data.package_code,
      name: legacy.data.package_name,
      billing_cycle: legacy.data.billing_cycle,
      price: Number((legacy.data as any).price_amount || 0),
      currency: (legacy.data as any).currency || 'INR',
      features: {},
      limits: {},
      is_active: (legacy.data as any).is_active !== false,
      created_at: null,
    }
  }

  const legacyByCode = await supabase
    .from('service_packages')
    .select('id,package_code,package_name,billing_cycle,price_amount,currency,is_active,sort_order')
    .eq('package_code', id)
    .limit(1)
    .maybeSingle()

  if (!legacyByCode.error && legacyByCode.data) {
    return {
      id: legacyByCode.data.id,
      sid: null,
      plan_code: legacyByCode.data.package_code,
      name: legacyByCode.data.package_name,
      billing_cycle: legacyByCode.data.billing_cycle,
      price: Number((legacyByCode.data as any).price_amount || 0),
      currency: (legacyByCode.data as any).currency || 'INR',
      features: {},
      limits: {},
      is_active: (legacyByCode.data as any).is_active !== false,
      created_at: null,
    }
  }

  return null
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [subscriptionRes, plansRes] = await withTransientRetry(async () => {
      const supabase = getSupabaseAdmin()
      return Promise.all([
        loadTenantSubscription(supabase, auth.tenantDbId),
        loadPlanRows(supabase),
      ])
    })

    if (subscriptionRes.error) {
      return NextResponse.json({ error: subscriptionRes.error.message }, { status: 400 })
    }
    if (plansRes.error) {
      return NextResponse.json({ error: plansRes.error.message }, { status: 400 })
    }

    const plans = plansRes.plans || []
    const subscription = subscriptionRes.subscription
      ? {
          ...subscriptionRes.subscription,
          plan:
            plans.find((plan: any) => plan.id === subscriptionRes.subscription?.plan_id) ||
            (await loadPlanById(getSupabaseAdmin(), subscriptionRes.subscription?.plan_id)) ||
            null,
        }
      : null

    return NextResponse.json({
      subscription,
      plans,
    })
  } catch (err: any) {
    if (isTransientPlanError(err)) {
      return NextResponse.json({ error: 'Temporary issue loading plan details. Please refresh.' }, { status: 503 })
    }
    return NextResponse.json({ error: err.message || 'Failed to load plan details' }, { status: 500 })
  }
}