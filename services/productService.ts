import { getSupabaseAdmin } from '../lib/supabaseAdmin'
import { getTenantRowFromRequest, getTenantSettings } from '../lib/tenantDb'
import { getTenantConfig } from '../lib/tenant'
import { toRenderableAssetUrl } from '../lib/assetUrl'

function isTransientServiceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  const text = message.toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('econn') ||
    text.includes('enotfound') ||
    text.includes('etimedout') ||
    text.includes('tenant not found')
  )
}

async function withTransientRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientServiceError(error) || index === attempts - 1) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown service error'))
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean)
    } catch {}
    return value ? [value] : []
  }
  return []
}

function mapProduct(row: any) {
  const images = asArray(row.image_urls).map((image) => toRenderableAssetUrl(image)).filter(Boolean)
  return {
    productId: row.sid || row.product_code || row.id,
    name: row.name || '',
    category: row.category_name || '',
    brand: row.brand || '',
    description: row.description || '',
    price: Number(row.price || 0),
    offerPrice: Number(row.offer_price || 0),
    discount: Number(row.discount_percent || 0),
    stock: Number(row.stock || 0),
    rating: Number(row.rating_avg || 0),
    images,
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function findProductRowByAnyId(supabase: any, tenantId: string, productId: string, select = '*') {
  const textId = String(productId || '').trim()

  const byText = await supabase
    .from('products')
    .select(select)
    .eq('tenant_id', tenantId)
    .or(`sid.eq.${textId},product_code.eq.${textId},slug.eq.${textId}`)
    .limit(1)
    .maybeSingle()

  if (byText.error) throw new Error(byText.error.message)
  if (byText.data) return byText.data

  if (!isUuid(textId)) return null

  const byUuid = await supabase
    .from('products')
    .select(select)
    .eq('tenant_id', tenantId)
    .eq('id', textId)
    .limit(1)
    .maybeSingle()

  if (byUuid.error) throw new Error(byUuid.error.message)
  return byUuid.data || null
}

async function getTenantDb() {
  const supabase = getSupabaseAdmin()
  const tenant = await getTenantRowFromRequest()
  return { supabase, tenant }
}

async function loadTenantProducts(supabase: any, tenantId: string) {
  // Primary path: active products, while allowing legacy rows with null is_active.
  let query = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .or('is_active.eq.true,is_active.is.null')
    .order('created_at', { ascending: false })

  if (!query.error) return query

  const firstMessage = String(query.error.message || '')

  // Compatibility: some deployments may miss is_active and/or created_at columns.
  if (/column .*is_active.* does not exist|column .*created_at.* does not exist/i.test(firstMessage)) {
    query = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (!query.error) return query

    const secondMessage = String(query.error.message || '')
    if (/column .*created_at.* does not exist/i.test(secondMessage)) {
      query = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
    }
  }

  return query
}

export async function fetchProducts(_tenantKey?: string) {
  try {
    const { data, error } = await withTransientRetry(async () => {
      const { supabase, tenant } = await getTenantDb()
      return loadTenantProducts(supabase, tenant.id)
    })

    if (error) throw new Error(error.message)
    return (data || []).map(mapProduct)
  } catch (error) {
    console.error('fetchProducts failed:', error)
    return []
  }
}

export default { fetchProducts }

export async function fetchProductById(id: string, _tenantKey?: string) {
  try {
    const { supabase, tenant } = await getTenantDb()
    const data = await findProductRowByAnyId(supabase, tenant.id, id, '*')
    return data ? mapProduct(data) : null
  } catch {
    return null
  }
}

export async function searchProducts(query: string, _tenantKey?: string) {
  const q = (query || '').trim()
  if (!q) return []

  try {
    const queryRes = await withTransientRetry(async () => {
      const { supabase, tenant } = await getTenantDb()
      let result = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .or('is_active.eq.true,is_active.is.null')
        .or(`name.ilike.%${q}%,brand.ilike.%${q}%,category_name.ilike.%${q}%`)
        .order('created_at', { ascending: false })

      if (result.error && /column .*is_active.* does not exist|column .*created_at.* does not exist/i.test(String(result.error.message || ''))) {
        result = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenant.id)
          .or(`name.ilike.%${q}%,brand.ilike.%${q}%,category_name.ilike.%${q}%`)
          .order('created_at', { ascending: false })
      }

      if (result.error && /column .*created_at.* does not exist/i.test(String(result.error.message || ''))) {
        result = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenant.id)
          .or(`name.ilike.%${q}%,brand.ilike.%${q}%,category_name.ilike.%${q}%`)
      }

      return result
    })

    if (queryRes.error) throw new Error(queryRes.error.message)
    return (queryRes.data || []).map(mapProduct)
  } catch (error) {
    console.error('searchProducts failed:', error)
    return []
  }
}

export async function fetchSettings(_tenantKey?: string): Promise<{
  businessName: string
  businessAddress: string
  whatsappNumber: string
  themePreset: string
  offerLabel: string
  offerTitle: string
  offerSubtitle: string
  announcementMessages: string[]
  deliveryCharge: number
  logoUrl: string
}> {
  try {
    const { tenant } = await getTenantDb()
    const kv = await getTenantSettings(tenant.id)
    const rawBar = kv['AnnouncementBar'] ?? ''
    const announcementMessages = rawBar
      ? rawBar.split('|').map((s) => s.trim()).filter(Boolean)
      : []

    return {
      businessName: kv['BusinessName'] ?? '',
      businessAddress: kv['Address'] ?? '',
      whatsappNumber: kv['WhatsAppNumber'] ?? '',
      themePreset: kv['ThemePreset'] ?? 'classic',
      offerLabel: kv['OfferLabel'] ?? '',
      offerTitle: kv['OfferTitle'] ?? '',
      offerSubtitle: kv['OfferSubtitle'] ?? '',
      announcementMessages,
      deliveryCharge: Number(kv['DeliveryCharge']) || Number(tenant.default_delivery_charge || 40),
      logoUrl: toRenderableAssetUrl(kv['LogoURL'] || ''),
    }
  } catch {
    return {
      businessName: '',
      businessAddress: '',
      whatsappNumber: '',
      themePreset: 'classic',
      offerLabel: '',
      offerTitle: '',
      offerSubtitle: '',
      announcementMessages: [],
      deliveryCharge: 40,
      logoUrl: '',
    }
  }
}

export async function fetchBanners(_tenantKey?: string) {
  try {
    const { supabase, tenant } = await getTenantDb()
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) return []

    const businessName = String(tenant.business_name || tenant.tenant_code || 'Our store').trim()

    return (data || [])
      .map((r: any) => ({
        bannerId: String(r.sid || r.id || '').trim(),
        title: String(r.title || `Discover ${businessName}`).trim(),
        subtitle: String(r.subtitle || '').trim() || undefined,
        imageUrl: toRenderableAssetUrl(String(r.image_url || '').trim()),
        linkUrl: String(r.link_url || '').trim() || undefined,
        buttonText: String(r.button_text || '').trim() || undefined,
      }))
      .filter((b: any) => b.imageUrl)
  } catch {
    return []
  }
}

export async function fetchReviews(productId: string, _tenantKey?: string) {
  try {
    const { supabase, tenant } = await getTenantDb()

    const product = await findProductRowByAnyId(supabase, tenant.id, productId, 'id')

    if (!product?.id) return []

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('product_id', product.id)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })

    if (error) return []

    return (data || []).map((r: any) => ({
      reviewId: String(r.sid || r.id || '').trim(),
      productId,
      name: String(r.customer_name || '').trim(),
      rating: Math.min(5, Math.max(1, Number(r.rating || 5) || 5)),
      review: String(r.review || '').trim(),
      date: r.created_at || undefined,
    }))
  } catch {
    return []
  }
}

export async function addReview(input: { productId: string; name: string; rating: number; review: string }) {
  const { supabase, tenant } = await getTenantDb()
  const { productId, name, rating, review } = input

  const product = await findProductRowByAnyId(supabase, tenant.id, productId, 'id')

  if (!product?.id) throw new Error('Product not found')

  const reviewSid = `R${Date.now().toString().slice(-4)}`
  const { error } = await supabase.from('reviews').insert({
    sid: reviewSid.length <= 5 ? reviewSid : null,
    tenant_id: tenant.id,
    product_id: product.id,
    customer_name: String(name).slice(0, 100),
    rating: Math.min(5, Math.max(1, Number(rating))),
    review: String(review).slice(0, 1000),
    is_approved: true,
  })

  if (error) throw new Error(error.message)
}

export async function validateCoupon(code: string, _tenantKey?: string) {
  if (!code) return null
  try {
    const { supabase, tenant } = await getTenantDb()

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('tenant_id', tenant.id)
      .ilike('code', code.toUpperCase())
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    if (data.is_active === false) return null

    if (data.expires_at) {
      const exp = new Date(data.expires_at)
      if (!isNaN(exp.getTime()) && exp < new Date()) return null
    }

    return {
      code: data.code,
      type: (data.type === 'flat' ? 'flat' : 'percent') as 'percent' | 'flat',
      value: Number(data.value) || 0,
      minOrder: data.min_order ? Number(data.min_order) : undefined,
    }
  } catch {
    return null
  }
}

export interface Testimonial {
  name: string
  location: string
  review: string
  rating: number
  avatar: string
}

export async function fetchTestimonials(_tenantKey?: string): Promise<Testimonial[]> {
  try {
    const { supabase, tenant } = await getTenantDb()
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) return []

    return (data || [])
      .map((r: any) => ({
        name: String(r.name || '').trim(),
        location: String(r.location || '').trim(),
        review: String(r.review || '').trim(),
        rating: Math.min(5, Math.max(1, Number(r.rating || 5) || 5)),
        avatar: toRenderableAssetUrl(String(r.avatar_url || '').trim()),
      }))
      .filter((t: Testimonial) => t.name && t.review)
  } catch {
    return []
  }
}
