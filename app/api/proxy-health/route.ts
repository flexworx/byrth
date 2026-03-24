import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_HOSTS = [
  '10.20.0.10',
  '10.20.0.20',
  '10.20.0.21',
  '10.20.0.30',
  '10.20.0.40',
  '10.10.0.20',
  '10.10.0.30',
  '10.10.0.40',
  '10.10.0.50',
  '10.40.0.10',
]

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('target')
  if (!target) {
    return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 })
  }

  try {
    const url = new URL(target)
    const host = url.hostname
    if (!ALLOWED_HOSTS.includes(host)) {
      return NextResponse.json({ error: 'Target not allowed' }, { status: 403 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const resp = await fetch(target, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { Accept: 'text/html,application/json' },
    })
    clearTimeout(timeout)

    const isUp = resp.status < 500
    return NextResponse.json({ status: isUp ? 'online' : 'offline', code: resp.status })
  } catch {
    return NextResponse.json({ status: 'offline' }, { status: 200 })
  }
}
