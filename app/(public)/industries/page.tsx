import type { Metadata } from 'next'
import { IndustriesHero } from '@/components/industries/IndustriesHero'
import { IndustryVerticals } from '@/components/industries/IndustryVerticals'
import { CTASection } from '@/components/home/CTASection'

export const metadata: Metadata = {
  title: 'Industries',
  description:
    'Roosk serves enterprises across healthcare, finance, energy, manufacturing, and government with AI-driven network intelligence tailored to vertical compliance needs.',
}

export default function IndustriesPage() {
  return (
    <>
      <IndustriesHero />
      <IndustryVerticals />
      <CTASection />
    </>
  )
}
