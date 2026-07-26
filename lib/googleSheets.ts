import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'

const CREDS = {
  client_email: process.env.SHEET_CLIENT_EMAIL ?? '',
  private_key: process.env.SHEET_PRIVATE_KEY ? process.env.SHEET_PRIVATE_KEY.replace(/\\n/g, '\n') : ''
}

async function accessSheet(sheetId: string) {
  if (!sheetId) throw new Error('Sheet ID not provided')
  if (!CREDS.client_email || !CREDS.private_key) throw new Error('Google Sheets service account credentials are not configured')
  if (!CREDS.private_key.includes('PRIVATE KEY')) {
    throw new Error('SHEET_PRIVATE_KEY must be a full PEM private key, including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----')
  }

  const auth = new JWT({
    email: CREDS.client_email,
    key: CREDS.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })

  const doc = new GoogleSpreadsheet(sheetId, auth)
  await doc.loadInfo()
  return doc
}

export async function readSheetRows(sheetId: string, sheetName: string) {
  const doc = await accessSheet(sheetId)
  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`)
  const rows = await sheet.getRows()
  return rows.map((r: any) => r._rawData || r)
}

export async function findSheetRow(
  sheetId: string,
  sheetName: string,
  criteria: Record<string, string>
): Promise<Record<string, string> | null> {
  const doc = await accessSheet(sheetId)
  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`)
  const rows = await sheet.getRows()
  const match = rows.find((row: any) =>
    Object.entries(criteria).every(([key, val]) => row.get(key) === val)
  )
  if (!match) return null
  const result: Record<string, string> = {}
  for (const h of sheet.headerValues) result[h] = match.get(h) ?? ''
  return result
}

export async function appendSheetRow(sheetId: string, sheetName: string, row: Record<string, any>) {
  const doc = await accessSheet(sheetId)
  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`)
  const added = await sheet.addRow(row)
  return added
}

/**
 * Reads a two-column Key/Value sheet and returns a plain object.
 * Silently returns {} if the sheet doesn't exist or can't be reached.
 * Expected sheet columns: Key | Value
 */
export async function readSheetKeyValues(
  sheetId: string,
  sheetName: string
): Promise<Record<string, string>> {
  try {
    const doc = await accessSheet(sheetId)
    const sheet = doc.sheetsByTitle[sheetName]
    if (!sheet) return {}
    const rows = await sheet.getRows()
    const result: Record<string, string> = {}
    for (const row of rows) {
      const key = row.get('Key') ?? row.get('key')
      const value = row.get('Value') ?? row.get('value') ?? ''
      if (key) result[String(key).trim()] = String(value).trim()
    }
    return result
  } catch {
    return {}
  }
}

export async function readSheetRowObjects(
  sheetId: string,
  sheetName: string
): Promise<Record<string, string>[]> {
  const doc = await accessSheet(sheetId)
  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`)
  const rows = await sheet.getRows()
  return rows.map((r: any) => {
    const obj: Record<string, string> = {}
    for (const h of sheet.headerValues) {
      obj[h] = String(r.get(h) ?? '').trim()
    }
    return obj
  })
}

export async function updateSheetRow(
  sheetId: string,
  sheetName: string,
  criteria: Record<string, string>,
  updates: Record<string, any>
): Promise<boolean> {
  const doc = await accessSheet(sheetId)
  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`)
  const rows = await sheet.getRows()
  const match = rows.find((row: any) =>
    Object.entries(criteria).every(([key, val]) => row.get(key) === val)
  )
  if (!match) return false
  for (const [key, val] of Object.entries(updates)) {
    match.set(key, val === null || val === undefined ? '' : String(val))
  }
  await match.save()
  return true
}

export async function updateSheetKeyValue(
  sheetId: string,
  sheetName: string,
  key: string,
  value: string
): Promise<void> {
  const doc = await accessSheet(sheetId)
  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`)
  const rows = await sheet.getRows()
  const match = rows.find((row: any) => {
    const k = row.get('Key') ?? row.get('key')
    return k && String(k).trim() === key
  })
  if (match) {
    match.set('Value', value)
    await match.save()
  } else {
    await sheet.addRow({ Key: key, Value: value })
  }
}

export async function deleteSheetRow(
  sheetId: string,
  sheetName: string,
  criteria: Record<string, string>
): Promise<boolean> {
  const doc = await accessSheet(sheetId)
  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`)
  const rows = await sheet.getRows()
  const match = rows.find((row: any) =>
    Object.entries(criteria).every(([key, val]) => row.get(key) === val)
  )
  if (!match) return false
  await match.delete()
  return true
}

export default {
  readSheetRows,
  readSheetRowObjects,
  findSheetRow,
  appendSheetRow,
  readSheetKeyValues,
  updateSheetRow,
  updateSheetKeyValue,
  deleteSheetRow,
}
