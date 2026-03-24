import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Roosk | AI-First Managed Network Intelligence Platform',
    template: '%s | Roosk',
  },
  description:
    'Roosk delivers autonomous network intelligence powered by CentralIntel.ai. Enterprise-grade infrastructure management with AI-driven monitoring, predictive analytics, and automated incident response.',
  keywords: [
    'managed network services',
    'AI infrastructure',
    'network intelligence',
    'CentralIntel.ai',
    'SOC 2',
    'NIST compliance',
    'enterprise networking',
    'predictive analytics',
    'automated incident response',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Roosk',
    title: 'Roosk | AI-First Managed Network Intelligence Platform',
    description:
      'Autonomous network intelligence powered by CentralIntel.ai. Enterprise infrastructure management reimagined.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roosk | AI-First Network Intelligence',
    description:
      'Autonomous network intelligence powered by CentralIntel.ai.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#06b6d4" />
      </head>
      <body className="bg-nexgen-bg text-nexgen-text font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Roosk',
              url: 'https://roosk.ai',
              description:
                'AI-First Managed Network Intelligence Platform powered by CentralIntel.ai',
              areaServed: 'US',
              knowsAbout: [
                'Network Management',
                'AI Infrastructure',
                'Cybersecurity',
                'Cloud Computing',
                'Compliance Automation',
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  )
}
