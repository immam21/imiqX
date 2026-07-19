import { NextResponse } from 'next/server'
import gs from '../../../lib/googleSheets'

const SHEET_ID = process.env.GSHEET_ID ?? ''

export async function POST(request: Request) {
  try {
    const { name, mobile } = await request.json()

    if (!name || !mobile) {
      return NextResponse.json({ error: 'Name and mobile are required' }, { status: 400 })
    }

    if (SHEET_ID) {
      await gs.appendSheetRow(SHEET_ID, 'Leads', {
        Name: name,
        Mobile: mobile,
        Timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lead API error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }
}
