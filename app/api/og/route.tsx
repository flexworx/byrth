import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const title = searchParams.get('title') || 'Roosk'
  const subtitle =
    searchParams.get('subtitle') || 'AI-First Managed Network Intelligence'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0a0e17 0%, #111827 50%, #0a0e17 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-10%',
            left: '-5%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
            marginBottom: '32px',
          }}
        >
          <span style={{ color: 'white', fontSize: '40px', fontWeight: 'bold' }}>
            B
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              background: 'linear-gradient(90deg, #f1f5f9, #94a3b8)',
              backgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
              maxWidth: '900px',
              lineHeight: 1.2,
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: '24px',
              color: '#64748b',
              textAlign: 'center',
              maxWidth: '700px',
            }}
          >
            {subtitle}
          </span>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: '#475569', fontSize: '16px', letterSpacing: '0.15em' }}>
            ROOSK.NET
          </span>
          <span style={{ color: '#334155', fontSize: '16px' }}>|</span>
          <span style={{ color: '#475569', fontSize: '14px' }}>
            Network Intelligence Platform
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
