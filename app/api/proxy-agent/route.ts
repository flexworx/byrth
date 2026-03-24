import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://10.20.0.10:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const command = body.command

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Missing command' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')

    const resp = await fetch(`${API_URL}/api/llm/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        prompt: command,
        context: { source: 'portal-command-bar' },
      }),
    })

    if (resp.ok) {
      const data = await resp.json()
      return NextResponse.json({ response: data.response, backend: data.backend })
    }

    // If LLM endpoint fails, try the agent command endpoint
    const agentResp = await fetch(`${API_URL}/api/agents/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        agent_id: 'platform-ops',
        command: command,
        parameters: {},
      }),
    })

    if (agentResp.ok) {
      const data = await agentResp.json()
      return NextResponse.json(data)
    }

    return NextResponse.json(
      { response: `Command received: "${command}". Backend services are starting up. Try again shortly.` },
      { status: 200 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
