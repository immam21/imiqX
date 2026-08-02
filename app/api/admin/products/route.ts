import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '../../../../lib/adminAuth'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { toRenderableAssetUrl } from '../../../../lib/assetUrl'
import { revalidatePath } from 'next/cache'

function imageArray(value: unknown) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/) 
      .map((v) => String(v).trim())
      .filter(Boolean)
  }
  return []
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', auth.tenantDbId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const products = (data || []).map((r: any) => {
      const imgs = imageArray(r.image_urls).map((image) => toRenderableAssetUrl(image)).filter(Boolean)
      return {
        productId: String(r.sid || r.product_code || r.id || '').trim(),
        name: String(r.name || '').trim(),
        category: String(r.category_name || '').trim(),
        brand: String(r.brand || '').trim(),
        description: String(r.description || '').trim(),
        price: Number(r.price || 0),
        offerPrice: Number(r.offer_price || 0),
        discount: Number(r.discount_percent || 0),
        stock: Number(r.stock || 0),
        rating: Number(r.rating_avg || 0),
        images: imgs,
        image: String(imgs[0] || '').trim(),
      }
    }).filter((p: any) => p.productId || p.name)

    return NextResponse.json({ products })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { product } = await request.json()
    if (!product?.name) return NextResponse.json({ error: 'Product name required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const productId = String(product.productId || `P${Date.now().toString().slice(-4)}`)
    const images = imageArray(product.imageUrls ?? product.image)
    const { error } = await supabase.from('products').insert({
      sid: productId.length <= 5 ? productId : null,
      tenant_id: auth.tenantDbId,
      product_code: productId,
      name: product.name,
      slug: String(product.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      category_name: product.category || '',
      brand: product.brand || '',
      description: product.description || '',
      price: Number(product.price || 0),
      offer_price: Number(product.offerPrice || product.price || 0),
      discount_percent: Number(product.discount || 0),
      stock: Number(product.stock || 0),
      rating_avg: Number(product.rating || 0),
      image_urls: images,
      is_active: true,
    })

    if (error) throw new Error(error.message)
      revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { productId, updates } = await request.json()
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const payload: Record<string, any> = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.category !== undefined) payload.category_name = updates.category
    if (updates.brand !== undefined) payload.brand = updates.brand
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.price !== undefined) payload.price = Number(updates.price)
    if (updates.offerPrice !== undefined) payload.offer_price = Number(updates.offerPrice)
    if (updates.discount !== undefined) payload.discount_percent = Number(updates.discount)
    if (updates.stock !== undefined) payload.stock = Number(updates.stock)
    if (updates.rating !== undefined) payload.rating_avg = Number(updates.rating)
    if (updates.imageUrls !== undefined || updates.image !== undefined) {
      payload.image_urls = imageArray(updates.imageUrls ?? updates.image)
    }
    if (updates.name !== undefined) {
      payload.slug = String(updates.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    }

    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('tenant_id', auth.tenantDbId)
      .or(`sid.eq.${productId},product_code.eq.${productId},id.eq.${productId}`)

    if (error) throw new Error(error.message)
      revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { productId } = await request.json()
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('tenant_id', auth.tenantDbId)
      .or(`sid.eq.${productId},product_code.eq.${productId},id.eq.${productId}`)
    if (error) throw new Error(error.message)
      revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
