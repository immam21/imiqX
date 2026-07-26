import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getTenantSettings } from '../../../../lib/tenantDb'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

function slugify(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function syncTenantBrandFields(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantDbId: string,
  key: string,
  value: string
) {
  const normalizedValue = String(value ?? '').trim()

  if (key === 'BusinessName' || key === 'WhatsAppNumber' || key === 'DeliveryCharge' || key === 'LogoURL') {
    const tenantUpdates: Record<string, unknown> = {}
    if (key === 'BusinessName') {
      tenantUpdates.business_name = normalizedValue || null
      tenantUpdates.business_slug = normalizedValue ? slugify(normalizedValue) : null
    }
    if (key === 'WhatsAppNumber') tenantUpdates.whatsapp_number = normalizedValue || null
    if (key === 'DeliveryCharge') tenantUpdates.default_delivery_charge = Number(normalizedValue || 0)
    if (key === 'LogoURL') tenantUpdates.logo_url = normalizedValue || null

    let updateTenant = await supabase
      .from('tenants')
      .update(tenantUpdates)
      .eq('id', tenantDbId)

    if (updateTenant.error && /column .*business_slug.* does not exist/i.test(updateTenant.error.message || '')) {
      const { business_slug, ...withoutSlug } = tenantUpdates
      updateTenant = await supabase
        .from('tenants')
        .update(withoutSlug)
        .eq('id', tenantDbId)
    }

    if (updateTenant.error) throw new Error(updateTenant.error.message)
  }

  if (key === 'BusinessName' || key === 'LogoURL') {
    const profilePayload: Record<string, unknown> = { tenant_id: tenantDbId }
    if (key === 'BusinessName') profilePayload.business_name = normalizedValue || null
    if (key === 'LogoURL') profilePayload.logo_url = normalizedValue || null

    const existingProfile = await supabase
      .from('business_profiles')
      .select('tenant_id')
      .eq('tenant_id', tenantDbId)
      .limit(1)
      .maybeSingle()

    if (existingProfile.error && !/relation .*business_profiles.* does not exist/i.test(existingProfile.error.message || '')) {
      throw new Error(existingProfile.error.message)
    }

    if (existingProfile.data?.tenant_id) {
      const updateProfile = await supabase
        .from('business_profiles')
        .update(profilePayload)
        .eq('tenant_id', tenantDbId)

      if (updateProfile.error) throw new Error(updateProfile.error.message)
    } else if (!existingProfile.error) {
      const insertProfile = await supabase
        .from('business_profiles')
        .insert(profilePayload)

      if (insertProfile.error) throw new Error(insertProfile.error.message)
    }
  }
}

// GET all settings key-value pairs
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const kv = await getTenantSettings(auth.tenantDbId)
    return NextResponse.json({ settings: kv })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH update a single setting key
export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { key, value } = await request.json()
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
    const normalizedKey = String(key).trim()
    if (/^adminloginid$/i.test(normalizedKey) || /^admintenantid$/i.test(normalizedKey)) {
      return NextResponse.json({ error: 'Admin login ID can only be changed by platform admin' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const existing = await supabase
      .from('tenant_settings')
      .select('id')
      .eq('tenant_id', auth.tenantDbId)
      .eq('key', normalizedKey)
      .limit(1)
      .maybeSingle()

    if (existing.error) throw new Error(existing.error.message)

    if (existing.data?.id) {
      const updateRes = await supabase
        .from('tenant_settings')
        .update({ value: String(value ?? '') })
        .eq('tenant_id', auth.tenantDbId)
        .eq('key', normalizedKey)
      if (updateRes.error) throw new Error(updateRes.error.message)
    } else {
      const insertRes = await supabase
        .from('tenant_settings')
        .insert({
          tenant_id: auth.tenantDbId,
          key: normalizedKey,
          value: String(value ?? ''),
        })
      if (insertRes.error) throw new Error(insertRes.error.message)
    }

    await syncTenantBrandFields(supabase, auth.tenantDbId, normalizedKey, String(value ?? ''))

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
