import type { Metadata } from 'next'
import { HeroSection } from '@/components/home/HeroSection'
import { PlatformOverview } from '@/components/home/PlatformOverview'
import { CapabilitiesGrid } from '@/components/home/CapabilitiesGrid'
import { ArchitectureDiagram } from '@/components/home/ArchitectureDiagram'
import { ComplianceBanner } from '@/components/home/ComplianceBanner'
import { SocialProof } from '@/components/home/SocialProof'
import { CTASection } from '@/components/home/CTASection'

export const metadata: Metadata = {
  title: 'Roosk | AI-First Managed Network Intelligence Platform',
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <PlatformOverview />
      <CapabilitiesGrid />
      <ArchitectureDiagram />
      <ComplianceBanner />
      <SocialProof />
      <CTASection />
    </>
  )
}
