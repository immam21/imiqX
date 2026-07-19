import { NextResponse } from 'next/server'
import { fetchSettings } from '../../../services/productService'

export async function GET() {
  try {
    const settings = await fetchSettings()
    return NextResponse.json({ deliveryCharge: settings.deliveryCharge })
  } catch (err: any) {
    return NextResponse.json({ deliveryCharge: 40, error: err.message }, { status: 200 })
  }
}
