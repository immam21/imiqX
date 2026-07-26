import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requirePlatformAdmin } from '../../../../lib/platformGuards'

function normalizeOrderStatus(value: string) {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'cancelled') return 'cancelled'
  if (status === 'confirmed' || status === 'packed' || status === 'processing') return 'processing'
  if (status === 'shipped') return 'shipped'
  if (status === 'delivered') return 'delivered'
  return 'pending'
}

async function loadPlanMap(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const plansRes = await supabase
    .from('subscription_plans')
    .select('id,plan_code,name,price,currency,billing_cycle,is_active')

  if (!plansRes.error) {
    return {
      plansById: new Map((plansRes.data || []).map((plan: any) => [plan.id, plan])),
      error: null,
    }
  }

  const packagesRes = await supabase
    .from('service_packages')
    .select('id,package_code,package_name,price_amount,currency,billing_cycle,is_active')

  if (packagesRes.error) {
    return { plansById: new Map<string, any>(), error: plansRes.error }
  }

  return {
    plansById: new Map((packagesRes.data || []).map((pkg: any) => [pkg.id, {
      id: pkg.id,
      plan_code: pkg.package_code,
      name: pkg.package_name,
      price: Number(pkg.price_amount || 0),
      currency: pkg.currency || 'INR',
      billing_cycle: pkg.billing_cycle,
      is_active: pkg.is_active !== false,
    }])),
    error: null,
  }
}

async function loadSubscriptionRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const subsRes = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id,plan_id,status,current_period_end,created_at')
    .order('created_at', { ascending: false })

  if (!subsRes.error) {
    return { subscriptions: subsRes.data || [], error: null }
  }

  const reducedModernRes = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id,plan_id,status,created_at')
    .order('created_at', { ascending: false })

  if (!reducedModernRes.error) {
    return {
      subscriptions: (reducedModernRes.data || []).map((row: any) => ({
        tenant_id: row.tenant_id,
        plan_id: row.plan_id,
        status: row.status,
        current_period_end: null,
        created_at: row.created_at,
      })),
      error: null,
    }
  }

  const legacySubsRes = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id,package_id,status,ends_at,created_at')
    .order('created_at', { ascending: false })

  if (legacySubsRes.error) {
    const reducedLegacyRes = await supabase
      .from('tenant_subscriptions')
      .select('tenant_id,package_id,status,created_at')
      .order('created_at', { ascending: false })

    if (reducedLegacyRes.error) {
      return { subscriptions: [], error: subsRes.error }
    }

    return {
      subscriptions: (reducedLegacyRes.data || []).map((row: any) => ({
        tenant_id: row.tenant_id,
        plan_id: row.package_id,
        status: row.status,
        current_period_end: null,
        created_at: row.created_at,
      })),
      error: null,
    }
  }

  return {
    subscriptions: (legacySubsRes.data || []).map((row: any) => ({
      tenant_id: row.tenant_id,
      plan_id: row.package_id,
      status: row.status,
      current_period_end: row.ends_at || null,
      created_at: row.created_at,
    })),
    error: null,
  }
}

async function loadTenantStatsRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  let tenantsRes = await supabase
    .from('tenants')
    .select('id,tenant_code,business_name,is_active,created_at')
    .order('created_at', { ascending: false })

  if (!tenantsRes.error) return tenantsRes

  tenantsRes = await supabase
    .from('tenants')
    .select('id,tenant_code,business_name,is_active')

  if (!tenantsRes.error) {
    return {
      data: (tenantsRes.data || []).map((row: any) => ({ ...row, created_at: null })),
      error: null,
    }
  }

  return tenantsRes
}

async function loadOrderStatsRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  let ordersRes = await supabase
    .from('orders')
    .select('tenant_id,grand_total,status,created_at')

  if (!ordersRes.error) {
    return {
      data: (ordersRes.data || []).map((row: any) => ({ ...row, amount_value: Number(row.grand_total || 0) })),
      error: null,
    }
  }

  ordersRes = await supabase
    .from('orders')
    .select('tenant_id,total_amount,status,created_at')

  if (!ordersRes.error) {
    return {
      data: (ordersRes.data || []).map((row: any) => ({
        tenant_id: row.tenant_id,
        status: row.status,
        created_at: row.created_at,
        amount_value: Number(row.total_amount || 0),
      })),
      error: null,
    }
  }

  ordersRes = await supabase
    .from('orders')
    .select('tenant_id,status,created_at')

  if (!ordersRes.error) {
    return {
      data: (ordersRes.data || []).map((row: any) => ({ ...row, amount_value: 0 })),
      error: null,
    }
  }

  return ordersRes
}

async function loadPaymentRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const paymentsRes = await supabase
    .from('platform_tenant_payments')
    .select('tenant_id,amount,status,payment_date,created_at')

  if (!paymentsRes.error) {
    return {
      data: (paymentsRes.data || []).map((row: any) => ({
        tenant_id: row.tenant_id,
        amount_value: Number(row.amount || 0),
        status: String(row.status || 'pending'),
        payment_date: row.payment_date || null,
        created_at: row.created_at || null,
      })),
      error: null,
      tableMissing: false,
    }
  }

  if (/relation .*platform_tenant_payments.* does not exist|schema cache/i.test(String(paymentsRes.error.message || ''))) {
    return { data: [], error: null, tableMissing: true }
  }

  return { data: [], error: paymentsRes.error, tableMissing: false }
}

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const supabase = getSupabaseAdmin()

    const [tenantsRes, ordersRes, subscriptionResult, planResult, paymentRowsResult] = await Promise.all([
      loadTenantStatsRows(supabase),
      loadOrderStatsRows(supabase),
      loadSubscriptionRows(supabase),
      loadPlanMap(supabase),
      loadPaymentRows(supabase),
    ])

    if (tenantsRes.error) return NextResponse.json({ error: tenantsRes.error.message }, { status: 400 })
    if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 400 })
    if (subscriptionResult.error) return NextResponse.json({ error: subscriptionResult.error.message }, { status: 400 })
    if (planResult.error) return NextResponse.json({ error: planResult.error.message }, { status: 400 })
    if (paymentRowsResult.error) return NextResponse.json({ error: paymentRowsResult.error.message }, { status: 400 })

    const plansById = planResult.plansById
    const latestSubByTenant = new Map<string, any>()
    for (const subscription of subscriptionResult.subscriptions || []) {
      if (!latestSubByTenant.has(subscription.tenant_id)) latestSubByTenant.set(subscription.tenant_id, subscription)
    }

    const orderAgg = new Map<string, { totalOrders: number; totalRevenue: number; lastOrderAt: string | null }>()
    const statusCounts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 }

    for (const row of ordersRes.data || []) {
      const tenantId = String(row.tenant_id || '')
      if (!tenantId) continue

      const status = normalizeOrderStatus(String(row.status || ''))
      statusCounts[status as keyof typeof statusCounts] += 1

      const current = orderAgg.get(tenantId) || { totalOrders: 0, totalRevenue: 0, lastOrderAt: null }
      current.totalOrders += 1
      if (status !== 'cancelled') current.totalRevenue += Number((row as any).amount_value || 0)
      if (!current.lastOrderAt || String(row.created_at || '') > current.lastOrderAt) current.lastOrderAt = String(row.created_at || '')
      orderAgg.set(tenantId, current)
    }

    let totalRevenue = 0
    let totalOrders = 0
    let activeSubscriptions = 0
    let monthlyRecurringRevenue = 0
    const todayIso = new Date().toISOString().slice(0, 10)
    const totalClients = (tenantsRes.data || []).length
    const todayClients = (tenantsRes.data || []).filter((tenant: any) => String(tenant.created_at || '').slice(0, 10) === todayIso).length
    const activeClients = (tenantsRes.data || []).filter((tenant: any) => Boolean(tenant.is_active)).length
    let clientsWithOrders = 0
    let activeClientRevenue = 0
    let activeClientOrders = 0
    let topClientRevenue = 0

    const paidStatuses = new Set(['paid', 'success', 'captured', 'completed'])
    const paymentAgg = new Map<string, { paidRevenue: number; paidCount: number; lastPaidAt: string | null; pendingAmount: number }>()
    let totalPaidRevenue = 0
    let totalPaymentRecords = 0
    let totalPaidRecords = 0
    let totalPendingAmount = 0

    for (const paymentRow of paymentRowsResult.data || []) {
      const tenantId = String((paymentRow as any).tenant_id || '')
      if (!tenantId) continue
      const amount = Number((paymentRow as any).amount_value || 0)
      const status = String((paymentRow as any).status || '').trim().toLowerCase()
      const paidAt = String((paymentRow as any).payment_date || (paymentRow as any).created_at || '') || null
      const current = paymentAgg.get(tenantId) || { paidRevenue: 0, paidCount: 0, lastPaidAt: null, pendingAmount: 0 }

      totalPaymentRecords += 1
      if (paidStatuses.has(status)) {
        current.paidRevenue += amount
        current.paidCount += 1
        if (!current.lastPaidAt || String(paidAt || '') > current.lastPaidAt) current.lastPaidAt = paidAt
        totalPaidRevenue += amount
        totalPaidRecords += 1
      } else if (status === 'pending' || status === 'overdue') {
        current.pendingAmount += amount
        totalPendingAmount += amount
      }

      paymentAgg.set(tenantId, current)
    }

    const revenueByTenant = (tenantsRes.data || []).map((tenant: any) => {
      const orderStats = orderAgg.get(tenant.id) || { totalOrders: 0, totalRevenue: 0, lastOrderAt: null }
      const subscription = latestSubByTenant.get(tenant.id) || null
      const plan = subscription ? plansById.get(subscription.plan_id) || null : null

      totalRevenue += orderStats.totalRevenue
      totalOrders += orderStats.totalOrders
      if (orderStats.totalOrders > 0) clientsWithOrders += 1
      if (Boolean(tenant.is_active)) {
        activeClientRevenue += orderStats.totalRevenue
        activeClientOrders += orderStats.totalOrders
      }
      if (orderStats.totalRevenue > topClientRevenue) topClientRevenue = orderStats.totalRevenue

      if (subscription && ['active', 'trialing', 'past_due'].includes(String(subscription.status || ''))) {
        activeSubscriptions += 1
      }
      if (plan && subscription && ['active', 'trialing', 'past_due'].includes(String(subscription.status || ''))) {
        monthlyRecurringRevenue += Number(plan.price || 0)
      }

      const paymentStats = paymentAgg.get(tenant.id) || { paidRevenue: 0, paidCount: 0, lastPaidAt: null, pendingAmount: 0 }

      return {
        tenantId: tenant.id,
        tenantCode: tenant.tenant_code || '',
        businessName: tenant.business_name || '',
        isActive: Boolean(tenant.is_active),
        totalOrders: orderStats.totalOrders,
        totalRevenue: orderStats.totalRevenue,
        paidRevenue: paymentStats.paidRevenue,
        paidCount: paymentStats.paidCount,
        pendingAmount: paymentStats.pendingAmount,
        lastPaidAt: paymentStats.lastPaidAt,
        lastOrderAt: orderStats.lastOrderAt,
        planName: plan?.name || null,
        planCode: plan?.plan_code || null,
        planStatus: subscription?.status || null,
        currentPeriodEnd: subscription?.current_period_end || null,
      }
    }).sort((a, b) => (b.paidRevenue || 0) - (a.paidRevenue || 0))

      const averageRevenuePerClient = totalClients > 0 ? totalRevenue / totalClients : 0
      const averageRevenuePerActiveClient = activeClients > 0 ? activeClientRevenue / activeClients : 0
      const averageOrdersPerClient = totalClients > 0 ? totalOrders / totalClients : 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const clientsWithPaidRevenue = revenueByTenant.filter((row: any) => Number(row.paidRevenue || 0) > 0).length

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      totalPaidRevenue,
      totalPaymentRecords,
      totalPaidRecords,
      totalPendingAmount,
      clientsWithPaidRevenue,
      activeSubscriptions,
      monthlyRecurringRevenue,
      totalClients,
      todayClients,
      activeClients,
        clientMetrics: {
          clientsWithOrders,
          averageRevenuePerClient,
          averageRevenuePerActiveClient,
          averageOrdersPerClient,
          averageOrderValue,
          activeClientRevenue,
          activeClientOrders,
          topClientRevenue,
        },
      statusCounts,
      revenueByTenant,
      paymentTableMissing: paymentRowsResult.tableMissing,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load platform stats' }, { status: 500 })
  }
}