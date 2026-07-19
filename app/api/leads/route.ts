import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name, mobile, email } = await request.json()

    if (!name || !mobile) {
      return NextResponse.json({ error: 'Name and mobile are required' }, { status: 400 })
    }

    // In production, save to database or Google Sheets
    console.log('New lead:', { name, mobile, email, timestamp: new Date() })

    return NextResponse.json({ success: true, message: 'Lead saved successfully' })
  } catch (error) {
    console.error('Lead API error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }
}
