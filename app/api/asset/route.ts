import { NextResponse } from 'next/server'
import { normalizeAssetUrl } from '../../../lib/assetUrl'

function isAllowedRemote(url: URL) {
  return ['drive.google.com', 'drive.usercontent.google.com'].includes(url.hostname)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url') || ''
  const normalized = normalizeAssetUrl(rawUrl)

  if (!normalized) {
    return NextResponse.json({ error: 'Missing asset url' }, { status: 400 })
  }

  let remoteUrl: URL
  try {
    remoteUrl = new URL(normalized)
  } catch {
    return NextResponse.json({ error: 'Invalid asset url' }, { status: 400 })
  }

  if (!isAllowedRemote(remoteUrl)) {
    return NextResponse.json({ error: 'Asset host not allowed' }, { status: 400 })
  }

  try {
    const upstream = await fetch(remoteUrl.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to fetch remote asset' }, { status: upstream.status })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Remote asset is not an image' }, { status: 415 })
    }

    const buffer = await upstream.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load asset' }, { status: 502 })
  }
}