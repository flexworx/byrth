import type { Metadata } from 'next'
import { ServicesHero } from '@/components/services/ServicesHero'
import { ServiceOfferings } from '@/components/services/ServiceOfferings'
import { ServiceComparison } from '@/components/services/ServiceComparison'
import { CTASection } from '@/components/home/CTASection'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Managed network services powered by AI. From infrastructure provisioning to security operations, Roosk delivers autonomous intelligence at enterprise scale.',
}

export default function ServicesPage() {
  return (
    <>
      <ServicesHero />
      <ServiceOfferings />
      <ServiceComparison />
      <CTASection />
    </>
  )
}
