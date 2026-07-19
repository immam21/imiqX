import * as gs from '../lib/googleSheets'

const SHEET_ID = process.env.GSHEET_ID ?? ''

const sampleProducts = [
  {
    productId: 'P001',
    name: 'Aero Fold Travel Kit',
    brand: 'Glide',
    category: 'Travel',
    description: 'A lightweight travel kit with premium finishes and compact storage.',
    price: 2199,
    offerPrice: 1499,
    discount: 32,
    stock: 12,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1528701800489-20f7c94402b8?auto=format&fit=crop&w=900&q=80']
  },
  {
    productId: 'P002',
    name: 'Luna Smart Earbuds',
    brand: 'Nova',
    category: 'Audio',
    description: 'Noise-cancelling earbuds with active sound equalization and long battery life.',
    price: 3999,
    offerPrice: 2999,
    discount: 25,
    stock: 18,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1512499617640-c2f999019a4a?auto=format&fit=crop&w=900&q=80']
  },
  {
    productId: 'P003',
    name: 'Serene Skin Ritual Kit',
    brand: 'Bloom',
    category: 'Beauty',
    description: 'Daily essentials for a glowing, balanced skincare routine.',
    price: 2399,
    offerPrice: 1799,
    discount: 25,
    stock: 23,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80']
  },
  {
    productId: 'P004',
    name: 'Café Aroma Coffee Set',
    brand: 'BrewLab',
    category: 'Kitchen',
    description: 'A curated coffee kit for fresh brews and premium mornings.',
    price: 2899,
    offerPrice: 2199,
    discount: 24,
    stock: 16,
    rating: 4.5,
    images: ['https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80']
  },
  {
    productId: 'P005',
    name: 'Stellar Yoga Mat',
    brand: 'ZenMotion',
    category: 'Wellness',
    description: 'A cushioned yoga mat built for grip, comfort, and everyday flow.',
    price: 1799,
    offerPrice: 1299,
    discount: 28,
    stock: 21,
    rating: 4.9,
    images: ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80']
  },
  {
    productId: 'P006',
    name: 'Aurora Desk Lamp',
    brand: 'Lume',
    category: 'Home',
    description: 'A minimalist desk lamp with warm mood lighting and touch controls.',
    price: 1399,
    offerPrice: 999,
    discount: 29,
    stock: 14,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1496317556649-f930d733eea2?auto=format&fit=crop&w=900&q=80']
  },
  {
    productId: 'P007',
    name: 'Pulse Fitness Tracker',
    brand: 'Stride',
    category: 'Wearables',
    description: 'Track every workout with easy stats, sleep insights, and a crisp display.',
    price: 2999,
    offerPrice: 2199,
    discount: 26,
    stock: 9,
    rating: 4.4,
    images: ['https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=900&q=80']
  },
  {
    productId: 'P008',
    name: 'Breeze Outdoor Chair',
    brand: 'Haven',
    category: 'Outdoor',
    description: 'A lounge chair with breathable weave and weather-resistant detailing.',
    price: 3399,
    offerPrice: 2599,
    discount: 23,
    stock: 11,
    rating: 4.5,
    images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80']
  }
]

export async function fetchProducts() {
  if (!SHEET_ID) return []

  const rows = await gs.readSheetRows(SHEET_ID, 'Products')
  const products = rows.map((r: any) => ({
    productId: r[0] ?? r.ProductID,
    name: r[1] ?? r.Name,
    category: r[2] ?? r.Category,
    brand: r[3] ?? r.Brand,
    description: r[4] ?? r.Description,
    price: Number(r[5] ?? r.Price) || 0,
    offerPrice: Number(r[6] ?? r.OfferPrice) || 0,
    discount: Number(r[7] ?? r.Discount) || 0,
    stock: Number(r[8] ?? r.Stock) || 0,
    rating: Number(r[9] ?? r.Rating) || 0,
    images: [r[10], r[11], r[12], r[13]].filter(Boolean)
  }))

  return products
}

export default { fetchProducts }

export async function fetchProductById(id: string) {
  const products = await fetchProducts()
  return products.find((p: any) => p.productId === id || p.productId === String(id)) || null
}

export async function searchProducts(query: string) {
  const q = (query || '').toLowerCase()
  if (!q) return []
  const products = await fetchProducts()
  return products.filter((p: any) => (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q))
}

/**
 * Reads the "Settings" sheet (Key/Value columns) and returns
 * offer-banner fields used by LeadsPopup. Falls back to empty strings
 * so the component defaults kick in if the sheet isn't configured yet.
 */
export async function fetchSettings(): Promise<{
  offerLabel: string
  offerTitle: string
  offerSubtitle: string
  announcementMessages: string[]
  deliveryCharge: number
}> {
  const empty = { offerLabel: '', offerTitle: '', offerSubtitle: '', announcementMessages: [] as string[], deliveryCharge: 40 }
  if (!SHEET_ID) return empty
  const kv = await gs.readSheetKeyValues(SHEET_ID, 'Settings')
  const rawBar = kv['AnnouncementBar'] ?? ''
  const announcementMessages = rawBar
    ? rawBar.split('|').map((s) => s.trim()).filter(Boolean)
    : []
  return {
    offerLabel:          kv['OfferLabel']    ?? '',
    offerTitle:          kv['OfferTitle']    ?? '',
    offerSubtitle:       kv['OfferSubtitle'] ?? '',
    announcementMessages,
    deliveryCharge:      Number(kv['DeliveryCharge']) || 40,
  }
}

export interface Testimonial {
  name: string
  location: string
  review: string
  rating: number
  avatar: string
}

/**
 * Reads the "Testimonials" sheet.
 * Expected columns: Name | Location | Review | Rating | Avatar
 * Silently returns [] if the sheet doesn't exist yet.
 */
export async function fetchTestimonials(): Promise<Testimonial[]> {
  if (!SHEET_ID) return []
  try {
    const rows = await gs.readSheetRows(SHEET_ID, 'Testimonials')
    return rows
      .map((r: any) => ({
        name:     String(r[0] ?? r.Name     ?? '').trim(),
        location: String(r[1] ?? r.Location ?? '').trim(),
        review:   String(r[2] ?? r.Review   ?? '').trim(),
        rating:   Math.min(5, Math.max(1, Number(r[3] ?? r.Rating ?? 5) || 5)),
        avatar:   String(r[4] ?? r.Avatar   ?? '').trim(),
      }))
      .filter((t: Testimonial) => t.name && t.review)
  } catch {
    return []
  }
}
