import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(filePath) {
  const out = {}
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function must(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required value: ${name}`)
  }
  return String(value).trim()
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeSid(prefix, tenantIndex, entityIndex = 0) {
  const base36 = Date.now().toString(36).toUpperCase()
  const suffix = base36.slice(-2)
  const a = String((tenantIndex + 1) % 36).toUpperCase()
  const b = String(entityIndex % 36).toUpperCase()
  return `${prefix}${a}${b}${suffix}`.slice(0, 5)
}

async function ensureTenantSetting(supabase, tenantId, key, value) {
  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, key, value }, { onConflict: 'tenant_id,key' })
  if (error) throw new Error(`tenant_settings upsert failed for ${key}: ${error.message}`)
}

async function ensureOwnerRole(supabase) {
  const existing = await supabase
    .from('roles')
    .select('id')
    .eq('scope', 'tenant')
    .eq('key', 'owner')
    .limit(1)
    .maybeSingle()

  if (!existing.error && existing.data?.id) return existing.data.id

  const inserted = await supabase
    .from('roles')
    .insert({
      scope: 'tenant',
      key: 'owner',
      name: 'Owner',
      is_system: true,
      is_active: true,
    })
    .select('id')
    .single()

  if (inserted.error) throw new Error(`Failed to create owner role: ${inserted.error.message}`)
  return inserted.data.id
}

async function main() {
  const cwd = process.cwd()
  const envPath = path.join(cwd, '.env.local')
  const env = loadEnvFile(envPath)

  const supabaseUrl = must(env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = must(env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id,sid,tenant_code,business_name,whatsapp_number,currency,default_delivery_charge,is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (tenantsError) throw new Error(`Failed to fetch tenants: ${tenantsError.message}`)
  if (!tenants || tenants.length === 0) throw new Error('No active tenants found')

  const ownerRoleId = await ensureOwnerRole(supabase)
  const credentialRows = []

  for (let i = 0; i < tenants.length; i += 1) {
    const tenant = tenants[i]
    const code = (tenant.tenant_code || tenant.sid || `tenant${i + 1}`).toLowerCase()
    const safeCode = slugify(code) || `tenant${i + 1}`
    const businessName = tenant.business_name || `Tenant ${i + 1}`

    const adminLoginId = `${safeCode}_admin`
    const adminPassword = `Imiqx@${String(i + 1).padStart(2, '0')}Admin`

    const tenantUsername = `${safeCode}.owner`
    const tenantEmail = `${safeCode}.owner@imiqx-demo.local`
    const tenantPassword = `Imiqx@${String(i + 1).padStart(2, '0')}User`
    const tenantPasswordHash = await bcrypt.hash(tenantPassword, 12)

    await ensureTenantSetting(supabase, tenant.id, 'AdminTenantID', safeCode)
    await ensureTenantSetting(supabase, tenant.id, 'AdminLoginID', adminLoginId)
    await ensureTenantSetting(supabase, tenant.id, 'AdminPassword', adminPassword)
    await ensureTenantSetting(supabase, tenant.id, 'OfferLabel', `${businessName} Special`) 
    await ensureTenantSetting(supabase, tenant.id, 'OfferTitle', `Welcome to ${businessName}`)
    await ensureTenantSetting(supabase, tenant.id, 'OfferSubtitle', `Curated deals from ${businessName}`)
    await ensureTenantSetting(supabase, tenant.id, 'AnnouncementBar', 'Fast delivery|Secure checkout|Tenant-isolated storefront')

    const sampleHost = `${safeCode}.mydomain.in`
    const existingDomain = await supabase
      .from('tenant_domains')
      .select('id')
      .eq('host', sampleHost)
      .limit(1)
      .maybeSingle()

    if (existingDomain.error) {
      throw new Error(`Failed reading tenant_domains for ${safeCode}: ${existingDomain.error.message}`)
    }

    if (!existingDomain.data) {
      const domainInsert = await supabase.from('tenant_domains').insert({
        tenant_id: tenant.id,
        host: sampleHost,
        is_primary: false,
      })
      if (domainInsert.error) throw new Error(`Failed inserting tenant domain for ${safeCode}: ${domainInsert.error.message}`)
    }

    const wantedProductCodes = [
      `${safeCode.toUpperCase()}-P001`,
      `${safeCode.toUpperCase()}-P002`,
      `${safeCode.toUpperCase()}-P003`,
    ]

    const existingProducts = await supabase
      .from('products')
      .select('id,product_code')
      .eq('tenant_id', tenant.id)
      .in('product_code', wantedProductCodes)

    if (existingProducts.error) throw new Error(`Failed reading products for ${safeCode}: ${existingProducts.error.message}`)

    const existingSet = new Set((existingProducts.data || []).map((p) => p.product_code))
    const nowSuffix = Date.now().toString().slice(-5)

    const productPayload = wantedProductCodes
      .map((productCode, idx) => {
        if (existingSet.has(productCode)) return null
        const price = 699 + idx * 350 + i * 120
        const offer = price - 100
        return {
          tenant_id: tenant.id,
          sid: makeSid('P', i, idx + 1),
          product_code: productCode,
          name: `${businessName} Demo Product ${idx + 1}`,
          slug: `${safeCode}-demo-product-${idx + 1}-${nowSuffix}`,
          category_name: idx % 2 === 0 ? 'Electronics' : 'Fashion',
          brand: idx % 2 === 0 ? 'Imiqx Tech' : 'Imiqx Style',
          description: `Dummy product ${idx + 1} for ${businessName}`,
          price,
          offer_price: offer,
          discount_percent: Math.round(((price - offer) / price) * 100),
          stock: 25 + idx * 10,
          rating_avg: 4.2 + idx * 0.2,
          featured: idx === 0,
          is_active: true,
          image_urls: [`https://picsum.photos/seed/${safeCode}-${idx + 1}/800/800`],
          metadata: { seeded_by: 'seed-tenant-dummy-data.mjs' },
        }
      })
      .filter(Boolean)

    if (productPayload.length > 0) {
      const insertProducts = await supabase.from('products').insert(productPayload)
      if (insertProducts.error) throw new Error(`Failed inserting products for ${safeCode}: ${insertProducts.error.message}`)
    }

    const chosenProduct = await supabase
      .from('products')
      .select('id,name,product_code,offer_price')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (chosenProduct.error || !chosenProduct.data) {
      throw new Error(`No product found for order seeding on tenant ${safeCode}`)
    }

    const mobile = `90000000${String(i + 1).padStart(2, '0')}`

    const existingCustomer = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('mobile', mobile)
      .limit(1)
      .maybeSingle()

    let customerId = existingCustomer.data?.id || null
    if (!customerId) {
      const customerInsert = await supabase
        .from('customers')
        .insert({
          tenant_id: tenant.id,
          sid: makeSid('C', i, 1),
          name: `${businessName} Demo Customer`,
          mobile,
        })
        .select('id')
        .single()

      if (customerInsert.error) throw new Error(`Failed inserting customer for ${safeCode}: ${customerInsert.error.message}`)
      customerId = customerInsert.data.id
    }

    const orderNumber = `ORD-${safeCode.toUpperCase()}-001`
    const existingOrder = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('order_number', orderNumber)
      .limit(1)
      .maybeSingle()

    if (existingOrder.error) throw new Error(`Failed reading order for ${safeCode}: ${existingOrder.error.message}`)

    if (!existingOrder.data) {
      const subtotal = Number(chosenProduct.data.offer_price || 499)
      const delivery = Number(tenant.default_delivery_charge || 40)
      const grandTotal = subtotal + delivery

      const orderInsert = await supabase
        .from('orders')
        .insert({
          tenant_id: tenant.id,
          sid: makeSid('O', i, 1),
          order_number: orderNumber,
          customer_id: customerId,
          customer_name: `${businessName} Demo Customer`,
          customer_mobile: mobile,
          door_number: '12A',
          full_address: `Demo Street, ${businessName}`,
          city: 'Hyderabad',
          pincode: '500001',
          subtotal,
          delivery_charge: delivery,
          coupon_code: '',
          coupon_discount: 0,
          grand_total: grandTotal,
          status: 'pending',
          payment_method: 'whatsapp',
          payment_status: 'unpaid',
          whatsapp_sent: false,
          metadata: {
            products: [
              {
                name: chosenProduct.data.name,
                qty: 1,
                price: subtotal,
                productCode: chosenProduct.data.product_code,
              },
            ],
            seeded_by: 'seed-tenant-dummy-data.mjs',
          },
        })
        .select('id')
        .single()

      if (orderInsert.error) throw new Error(`Failed inserting order for ${safeCode}: ${orderInsert.error.message}`)

      const orderItemInsert = await supabase.from('order_items').insert({
        tenant_id: tenant.id,
        sid: makeSid('I', i, 1),
        order_id: orderInsert.data.id,
        product_id: chosenProduct.data.id,
        product_name: chosenProduct.data.name,
        sku: chosenProduct.data.product_code,
        quantity: 1,
        unit_price: subtotal,
        line_total: subtotal,
      })

      if (orderItemInsert.error) throw new Error(`Failed inserting order item for ${safeCode}: ${orderItemInsert.error.message}`)
    }

    const existingUser = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('username', tenantUsername)
      .eq('user_type', 'tenant')
      .limit(1)
      .maybeSingle()

    let userId = existingUser.data?.id || null
    if (!userId) {
      const userInsert = await supabase
        .from('users')
        .insert({
          tenant_id: tenant.id,
          user_type: 'tenant',
          username: tenantUsername,
          email: tenantEmail,
          password_hash: tenantPasswordHash,
          display_name: `${businessName} Owner`,
          is_active: true,
        })
        .select('id')
        .single()

      if (userInsert.error) throw new Error(`Failed inserting tenant user for ${safeCode}: ${userInsert.error.message}`)
      userId = userInsert.data.id
    }

    if (userId) {
      const roleLink = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', userId)
        .eq('role_id', ownerRoleId)
        .limit(1)
        .maybeSingle()

      if (roleLink.error) throw new Error(`Failed reading user_roles for ${safeCode}: ${roleLink.error.message}`)

      if (!roleLink.data) {
        const linkInsert = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role_id: ownerRoleId })
        if (linkInsert.error) throw new Error(`Failed inserting user_roles for ${safeCode}: ${linkInsert.error.message}`)
      }
    }

    credentialRows.push({
      tenantCode: safeCode,
      businessName,
      storefrontHome: `/` + safeCode,
      storefrontProducts: `/${safeCode}/products`,
      storefrontCart: `/${safeCode}/cart`,
      adminDashboard: `/${safeCode}/admin`,
      adminLoginId,
      adminPassword,
      tenantUserUsername: tenantUsername,
      tenantUserEmail: tenantEmail,
      tenantUserPassword: tenantPassword,
      mappedHost: sampleHost,
      sampleOrderNumber: orderNumber,
    })
  }

  const credentialsPath = path.join(cwd, 'docs', 'tenant-dummy-credentials.json')
  fs.mkdirSync(path.dirname(credentialsPath), { recursive: true })
  fs.writeFileSync(credentialsPath, JSON.stringify(credentialRows, null, 2) + '\n', 'utf8')

  const { data: totals, error: totalsError } = await supabase
    .from('tenants')
    .select('tenant_code,business_name,products(count),orders(count),users(count)')

  if (totalsError) {
    console.warn('Totals query skipped:', totalsError.message)
  } else {
    console.log('Tenant totals snapshot:')
    console.log(JSON.stringify(totals, null, 2))
  }

  console.log(`Dummy seeding complete for ${credentialRows.length} tenant(s).`)
  console.log(`Credentials written to: ${credentialsPath}`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
