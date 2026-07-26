export type SubscriptionFeatureKey =
  | 'custom_domain'
  | 'online_payments'
  | 'cash_on_delivery'
  | 'whatsapp_order_confirmation'
  | 'whatsapp_shipping_updates'
  | 'email_notifications'
  | 'coupons'
  | 'banners'
  | 'inventory_management'
  | 'customer_reviews'
  | 'analytics_dashboard'
  | 'sales_reports'
  | 'mobile_app_support'
  | 'api_access'
  | 'priority_support'

export type SubscriptionFeatureMap = Record<SubscriptionFeatureKey, boolean>

export const FEATURE_DEFINITIONS: Array<{ key: SubscriptionFeatureKey; label: string }> = [
  { key: 'custom_domain', label: 'Custom Domain' },
  { key: 'online_payments', label: 'Online Payments' },
  { key: 'cash_on_delivery', label: 'Cash on Delivery' },
  { key: 'whatsapp_order_confirmation', label: 'WhatsApp Order Confirmation' },
  { key: 'whatsapp_shipping_updates', label: 'WhatsApp Shipping Updates' },
  { key: 'email_notifications', label: 'Email Notifications' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'banners', label: 'Banners' },
  { key: 'inventory_management', label: 'Inventory Management' },
  { key: 'customer_reviews', label: 'Customer Reviews' },
  { key: 'analytics_dashboard', label: 'Analytics Dashboard' },
  { key: 'sales_reports', label: 'Sales Reports' },
  { key: 'mobile_app_support', label: 'Mobile App Support' },
  { key: 'api_access', label: 'API Access' },
  { key: 'priority_support', label: 'Priority Support' },
]

export const DEFAULT_FEATURES: SubscriptionFeatureMap = {
  custom_domain: true,
  online_payments: true,
  cash_on_delivery: true,
  whatsapp_order_confirmation: true,
  whatsapp_shipping_updates: true,
  email_notifications: true,
  coupons: true,
  banners: true,
  inventory_management: true,
  customer_reviews: true,
  analytics_dashboard: true,
  sales_reports: true,
  mobile_app_support: false,
  api_access: false,
  priority_support: false,
}

function toBool(value: unknown) {
  if (typeof value === 'boolean') return value
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return false
  return ['1', 'true', 'yes', 'y', 'enabled', 'on'].includes(text)
}

export function normalizeFeatureMap(input: unknown): SubscriptionFeatureMap {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out: SubscriptionFeatureMap = { ...DEFAULT_FEATURES }

  for (const feature of FEATURE_DEFINITIONS) {
    if (Object.prototype.hasOwnProperty.call(source, feature.key)) {
      out[feature.key] = toBool(source[feature.key])
    }
  }

  return out
}

export function mergeFeatureMaps(base: unknown, overrides: unknown): SubscriptionFeatureMap {
  const normalizedBase = normalizeFeatureMap(base)
  const source = (overrides && typeof overrides === 'object' ? overrides : {}) as Record<string, unknown>
  const out: SubscriptionFeatureMap = { ...normalizedBase }

  for (const feature of FEATURE_DEFINITIONS) {
    if (Object.prototype.hasOwnProperty.call(source, feature.key)) {
      out[feature.key] = toBool(source[feature.key])
    }
  }

  return out
}

export function hasExplicitFeatureOverrides(input: unknown): boolean {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return FEATURE_DEFINITIONS.some((feature) => Object.prototype.hasOwnProperty.call(source, feature.key))
}

export function normalizeStrictOverrideMap(input: unknown): SubscriptionFeatureMap {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out = FEATURE_DEFINITIONS.reduce((acc, feature) => {
    acc[feature.key] = false
    return acc
  }, {} as SubscriptionFeatureMap)

  for (const feature of FEATURE_DEFINITIONS) {
    if (Object.prototype.hasOwnProperty.call(source, feature.key)) {
      out[feature.key] = toBool(source[feature.key])
    }
  }

  return out
}

export function parseJsonObject(input: string): Record<string, unknown> {
  const text = String(input || '').trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}
